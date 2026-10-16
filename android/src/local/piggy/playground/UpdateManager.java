package local.piggy.playground;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.net.ssl.HttpsURLConnection;

/** Native HTTPS updater. The WebView remains offline and receives only status snapshots. */
public final class UpdateManager {
    private static final int NATIVE_REVISION = 2;
    public interface Listener { void changed(JSONObject state); }
    private final Activity activity;
    private final Listener listener;
    private final SharedPreferences prefs;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final String current;
    private final long currentCode;
    private final JSONObject state = new JSONObject();
    private JSONObject release;
    private volatile UpdateNetwork network;
    private boolean busy, closed, awaitingPermission;

    public UpdateManager(Activity activity, Listener listener) throws Exception {
        this.activity = activity;
        this.listener = listener;
        prefs = activity.getSharedPreferences("piggy-updater", 0);
        PackageInfo own = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
        current = own.versionName;
        currentCode = code(own);
        put("current", current); put("currentCode", currentCode); put("nativeRevision", NATIVE_REVISION);
        put("auto", prefs.getBoolean("auto", true)); put("status", "idle");
    }
    private static long code(PackageInfo info) { return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode; }
    private synchronized void put(String key, Object value) { try { state.put(key, value); } catch (Exception ignored) {} }
    public synchronized String info() { return state.toString(); }
    private void emit() {
        final JSONObject snapshot;
        synchronized (this) {
            if (closed) return;
            try { snapshot = new JSONObject(state.toString()); } catch (Exception ignored) { return; }
        }
        activity.runOnUiThread(() -> { synchronized (UpdateManager.this) { if (closed) return; } listener.changed(snapshot); });
    }
    private void status(String value) { put("status", value); emit(); }
    public void setAuto(boolean on) {
        prefs.edit().putBoolean("auto", on).apply(); put("auto", on); emit();
    }
    public void autoCheck() { if (prefs.getBoolean("auto", true)) check(); }
    private synchronized boolean begin() { if (busy || closed) return false; busy = true; return true; }
    private synchronized void end() { busy = false; }
    public void check() {
        if (!begin()) return;
        put("error", ""); status("checking");
        worker.execute(() -> {
            try (UpdateNetwork requests = new UpdateNetwork()) {
                network = requests;
                final long nonce = System.currentTimeMillis();
                UpdateNetwork.Selection<JSONObject> selected = UpdateNetwork.select(UpdateNetwork.MANIFESTS, route -> {
                    JSONObject candidate = manifest(requests.text(UpdateNetwork.freshManifestUrl(route.url, nonce), route.accept, 65536));
                    validate(candidate);
                    return candidate;
                }, candidate -> candidate.getLong("versionCode"), 12000);
                JSONObject found = selected.value;
                put("source", selected.source);
                put("checkedRoutes", selected.successfulRoutes); put("totalRoutes", selected.totalRoutes);
                synchronized (this) { release = found; }
                put("checkedAt", System.currentTimeMillis()); put("latest", found.getString("version"));
                put("notes", found.optString("notes", "发现新版本，可下载后覆盖安装。"));
                put("total", found.getLong("bytes")); put("done", 0);
                put("latestCode", found.getLong("versionCode"));
                if (UpdatePolicy.needsUpdate(current, currentCode, NATIVE_REVISION, found.getString("version"),
                        found.getLong("versionCode"), found.optInt("nativeRevision", 0))) {
                    File saved = UpdateProvider.apk(activity);
                    boolean ready = false;
                    if (saved.isFile()) {
                        try { verify(saved, found); ready = true; } catch (Exception ignored) {}
                    }
                    status(ready ? "ready" : "available");
                } else if (found.getLong("versionCode") < currentCode && !current.equals(found.getString("version"))) status("stale");
                else status("latest");
            } catch (Exception error) { fail(error); }
            finally { network = null; end(); }
        });
    }
    private static void validate(JSONObject manifest) throws Exception {
        if (manifest.getInt("schema") != 1 || !"local.piggy.playground".equals(manifest.getString("package")))
            throw new IOException("更新清单不是本应用的版本");
        UpdatePolicy.validate(manifest.getString("version"), manifest.getLong("versionCode"),
            manifest.getLong("bytes"), manifest.getString("sha256"), manifest.getString("url"));
        if (manifest.optString("notes", "").length() > 12000) throw new IOException("更新说明过长");
    }
    private static JSONObject manifest(String body) throws Exception {
        JSONObject result = new JSONObject(body);
        if (!result.has("schema") && "base64".equals(result.optString("encoding")) &&
                "android/update-v2.json".equals(result.optString("path"))) {
            byte[] decoded = java.util.Base64.getMimeDecoder().decode(result.getString("content"));
            if (decoded.length > 65536) throw new IOException("更新清单过大");
            result = new JSONObject(new String(decoded, java.nio.charset.StandardCharsets.UTF_8));
        }
        return result;
    }
    public void download() {
        final JSONObject target;
        synchronized (this) { target = release; }
        if (target == null || target.optLong("versionCode") <= currentCode || !begin()) return;
        put("error", ""); put("done", 0); status("downloading");
        worker.execute(() -> {
            File apk = UpdateProvider.apk(activity), part = new File(apk.getParentFile(), "download.part.apk");
            try (UpdateNetwork requests = new UpdateNetwork()) {
                network = requests;
                validate(target);
                if (!apk.getParentFile().isDirectory() && !apk.getParentFile().mkdirs()) throw new IOException("无法创建更新目录");
                long done;
                try { done = transfer(requests, target.getString("url"), "application/octet-stream", part, target); }
                catch (Exception primary) {
                    if (Thread.currentThread().isInterrupted()) throw primary;
                    put("done", 0); emit();
                    // The official API resolves the same asset; size, hash and signing checks still apply.
                    done = transfer(requests, assetApi(requests, target), "application/octet-stream", part, target);
                }
                verifyPackage(part, target);
                java.nio.file.Files.move(part.toPath(), apk.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                put("done", done); status("ready");
            } catch (Exception error) { fail(error); }
            finally { network = null; if (part.exists()) part.delete(); end(); }
        });
    }
    private long transfer(UpdateNetwork requests, String url, String accept, File part, JSONObject target) throws Exception {
        HttpsURLConnection connection = requests.open(url, accept);
        long expected = target.getLong("bytes"), done = 0, lastProgress = 0;
        long deadline = System.nanoTime() + java.util.concurrent.TimeUnit.MINUTES.toNanos(5);
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(part)) {
            byte[] buffer = new byte[32768]; int count;
            while ((count = input.read(buffer)) != -1) {
                if (Thread.currentThread().isInterrupted() || System.nanoTime() > deadline) throw new IOException("下载已中止，可稍后重试");
                done += count;
                if (done > expected || done > UpdatePolicy.MAX_APK_BYTES) throw new IOException("下载大小与更新清单不一致");
                output.write(buffer, 0, count); digest.update(buffer, 0, count);
                if (done - lastProgress >= 65536) { put("done", done); emit(); lastProgress = done; }
            }
            output.getFD().sync();
        } finally { requests.disconnect(connection); }
        UpdatePolicy.verifyDigest(done, expected, digest.digest(), target.getString("sha256"));
        return done;
    }
    private String assetApi(UpdateNetwork requests, JSONObject target) throws Exception {
        String[] parts = java.net.URI.create(target.getString("url")).getPath().split("/");
        JSONObject published = new JSONObject(requests.text("https://api.github.com/repos/tzlh6/piggy-playground/releases/tags/" + parts[5],
            "application/vnd.github+json", 262144));
        if (published.optBoolean("draft") || published.optBoolean("prerelease") || !parts[5].equals(published.getString("tag_name")))
            throw new IOException("正式更新版本暂不可用");
        org.json.JSONArray assets = published.getJSONArray("assets");
        for (int index = 0; index < assets.length(); index++) {
            JSONObject asset = assets.getJSONObject(index);
            if (parts[6].equals(asset.optString("name")) && "uploaded".equals(asset.optString("state")) &&
                    asset.optLong("size") == target.getLong("bytes") && asset.optLong("id") > 0)
                return "https://api.github.com/repos/tzlh6/piggy-playground/releases/assets/" + asset.getLong("id");
        }
        throw new IOException("新版安装包尚未就绪，请稍后重试");
    }
    private void verify(File apk, JSONObject target) throws Exception {
        if (apk.length() != target.getLong("bytes")) throw new IOException("更新文件大小不一致");
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(apk)) {
            byte[] buffer = new byte[32768]; int count;
            while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        UpdatePolicy.verifyDigest(apk.length(), target.getLong("bytes"), digest.digest(), target.getString("sha256"));
        verifyPackage(apk, target);
    }
    private void verifyPackage(File apk, JSONObject target) throws Exception {
        PackageManager pm = activity.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo candidate = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        PackageInfo own = pm.getPackageInfo(activity.getPackageName(), flags);
        if (candidate == null || !own.packageName.equals(candidate.packageName) || code(candidate) != target.getLong("versionCode") ||
            !target.getString("version").equals(candidate.versionName) || code(candidate) <= currentCode)
            throw new IOException("安装包身份或版本不一致");
        if (!signatures(own).equals(signatures(candidate)) || signatures(own).isEmpty())
            throw new IOException("安装包签名与当前应用不同，已拒绝安装");
    }
    private static Set<String> signatures(PackageInfo info) throws Exception {
        Signature[] signatures = Build.VERSION.SDK_INT >= 28 && info.signingInfo != null ?
            info.signingInfo.getApkContentsSigners() : info.signatures;
        Set<String> result = new HashSet<>();
        if (signatures != null) for (Signature signature : signatures)
            result.add(UpdatePolicy.hex(MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())));
        return result;
    }
    public void install() {
        final JSONObject target;
        synchronized (this) { target = release; }
        if (target == null || !"ready".equals(newStateStatus()) || !begin()) return;
        worker.execute(() -> {
            try {
                verify(UpdateProvider.apk(activity), target);
                activity.runOnUiThread(() -> {
                    synchronized (UpdateManager.this) { if (closed) return; }
                    try {
                        if (!activity.getPackageManager().canRequestPackageInstalls()) {
                            awaitingPermission = true;
                            activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + activity.getPackageName())));
                        } else {
                            Intent intent = new Intent(Intent.ACTION_VIEW)
                                .setDataAndType(UpdateProvider.URI, "application/vnd.android.package-archive")
                                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            intent.setClipData(ClipData.newRawUri("Piggy update", UpdateProvider.URI));
                            activity.startActivity(intent);
                        }
                    } catch (Exception error) { fail(new IOException("系统安装界面暂时打不开，可在 GitHub 下载后手动安装")); }
                });
            } catch (Exception error) { fail(error); }
            finally { end(); }
        });
    }
    private synchronized String newStateStatus() { return state.optString("status"); }
    public void resume() {
        if (!awaitingPermission) return;
        awaitingPermission = false;
        if (activity.getPackageManager().canRequestPackageInstalls()) install();
        else { put("error", "尚未允许本应用安装更新；可再次点安装，或从 GitHub 手动安装。"); emit(); }
    }
    public void openPage() {
        activity.runOnUiThread(() -> {
            try { activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(UpdatePolicy.RELEASES))); }
            catch (Exception error) { put("error", "手机未找到浏览器，请稍后重试。"); emit(); }
        });
    }
    private void fail(Exception error) {
        put("error", UpdateNetwork.message(error));
        status("error");
    }
    public synchronized void close() {
        closed = true; worker.shutdownNow();
        UpdateNetwork requests = network;
        if (requests != null) requests.close();
    }
}
