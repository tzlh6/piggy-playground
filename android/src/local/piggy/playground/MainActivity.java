package local.piggy.playground;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.RenderProcessGoneDetail;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.window.OnBackInvokedDispatcher;
import android.content.ClipData;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/** Offline game launcher with narrow native bridges (updates, study banks); no external storage access. */
public class MainActivity extends Activity {
    private static final int CREAM = Color.rgb(255, 251, 241);
    private static final int PICK_STUDY_BANKS = 4701;
    private static final long MAX_BANK_BYTES = StudyBankImporter.MAX_BANK_BYTES;
    private static final String ORIGIN = OfflineAssets.ORIGIN;
    private FrameLayout root;
    private WebView web;
    private boolean foreground;
    private boolean wasBackground;
    private AlertDialog exitDialog;
    private UpdateManager updater;
    private boolean checkedOnLaunch;
    private LanNetwork lan;
    private final java.util.concurrent.ExecutorService lanCommands = java.util.concurrent.Executors.newSingleThreadExecutor();
    private android.net.wifi.WifiManager.MulticastLock lanWifiLock;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        root = new FrameLayout(this);
        root.setBackgroundColor(CREAM);
        setContentView(root);
        configureInsets();
        try {
            updater = new UpdateManager(this, status -> {
                if (web != null) web.evaluateJavascript(
                    "if(window.PigAndroid)window.PigAndroid.onUpdate(" + status.toString() + ")", null);
            });
        } catch (Exception error) { android.util.Log.e("PiggyUpdate", "Unable to initialize updater", error); }
        createGame();
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::requestBack);
        }
    }

    private void configureInsets() {
        getWindow().setStatusBarColor(CREAM);
        getWindow().setNavigationBarColor(CREAM);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets safe = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, Math.max(safe.bottom, keyboard.bottom));
                return insets;
            });
        }
        root.requestApplyInsets();
    }

    private void createGame() {
        try {
            web = new WebView(this);
            web.setBackgroundColor(CREAM);
            web.setKeepScreenOn(true);
            web.setOverScrollMode(View.OVER_SCROLL_NEVER);
            // The page implements long-press flags; do not show the system image selection menu.
            web.setOnLongClickListener(view -> true);
            WebSettings settings = web.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setAllowFileAccess(false);
            settings.setAllowContentAccess(false);
            settings.setBlockNetworkLoads(true);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            settings.setGeolocationEnabled(false);
            settings.setSupportMultipleWindows(false);
            settings.setSupportZoom(false);
            settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
            settings.setMediaPlaybackRequiresUserGesture(true);
            WebView.setWebContentsDebuggingEnabled(false);
            if (updater != null) web.addJavascriptInterface(new UpdateBridge(), "PiggyAndroidBridge");
            web.addJavascriptInterface(new StudyBridge(), "PiggyStudyAndroid");
            if (lan != null) lan.close();
            lan = new LanNetwork(event -> runOnUiThread(() -> {
                if (web != null && !isDestroyed()) web.evaluateJavascript(
                    "if(window.PiggyLan)window.PiggyLan._event(" + event.toString() + ")", null);
            }));
            web.addJavascriptInterface(new LanBridge(), "PiggyLanAndroid");
            web.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    return true; // Game and attribution content have no external navigation.
                }
                @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    String asset = "GET".equals(request.getMethod()) ? OfflineAssets.path(request.getUrl().toString()) : null;
                    if (asset != null) {
                        try {
                            // Stream APK assets on WebView's I/O thread. Never duplicate the whole
                            // game and engine payload in the Activity's bounded Java heap.
                            Map<String, String> headers = new LinkedHashMap<>();
                            headers.put("Cache-Control", "no-store");
                            headers.put("X-Content-Type-Options", "nosniff");
                            return new WebResourceResponse(OfflineAssets.mime(asset), "UTF-8", 200, "OK", headers,
                                getAssets().open(asset));
                        } catch (IOException error) {
                            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null,
                                new ByteArrayInputStream(new byte[0]));
                        }
                    }
                    String scheme = request.getUrl().getScheme();
                    if ("https".equals(scheme) || "http".equals(scheme)) {
                        return new WebResourceResponse("text/plain", "UTF-8", 403, "Offline", null,
                            new ByteArrayInputStream(new byte[0]));
                    }
                    return null;
                }
                @Override public void onPageFinished(WebView view, String url) {
                    if (view != web || isDestroyed()) return;
                    view.evaluateJavascript("typeof window.PigAndroid === 'object'", ready -> {
                        if (view != web || isDestroyed()) return;
                        if (!"true".equals(ready)) {
                            showProblem("请先启用并更新手机的 Android System WebView，再重新打开游乐场。", false);
                        } else if (!foreground || wasBackground) {
                            pauseGame();
                        }
                        if ("true".equals(ready) && updater != null && !checkedOnLaunch) {
                            checkedOnLaunch = true;
                            root.postDelayed(() -> { if (!isDestroyed()) updater.autoCheck(); }, 1800);
                        }
                    });
                }
                @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                    boolean active = web == view;
                    if (active) { web = null; if (lan != null) { lan.close(); lan = null; } updateLanWifiLock(new JSONObject()); }
                    root.removeView(view);
                    view.destroy();
                    if (active && !isDestroyed()) showProblem("小猪需要重新整理一下游乐场。已保存的成绩和设置还在。", true);
                    return true;
                }
            });
            web.setWebChromeClient(new WebChromeClient() {
                @Override public boolean onConsoleMessage(ConsoleMessage message) {
                    if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                        android.util.Log.e("PiggyWeb", message.message() + " [line " + message.lineNumber() + "]");
                    }
                    return true;
                }
            });
            root.addView(web, new FrameLayout.LayoutParams(-1, -1));
            // Keep the previous HTTPS origin so upgrades preserve localStorage and scores.
            web.loadUrl(ORIGIN + "game.html");
        } catch (Exception problem) {
            android.util.Log.e("PiggyApp", "Unable to load packaged game", problem);
            showProblem("游乐场暂时打不开。请检查系统 WebView 是否启用，再重新打开。", false);
        }
    }

    private void showProblem(String message, boolean canRetry) {
        root.removeAllViews();
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(android.view.Gravity.CENTER);
        int padding = (int)(24 * getResources().getDisplayMetrics().density);
        box.setPadding(padding, padding, padding, padding);
        TextView text = new TextView(this);
        text.setText("猪猪游乐场\n\n" + message);
        text.setTextSize(18);
        text.setTextColor(Color.rgb(82, 98, 75));
        box.addView(text);
        if (canRetry) {
            Button button = new Button(this);
            button.setText("重新打开");
            button.setOnClickListener(view -> {
                root.removeAllViews();
                createGame();
            });
            box.addView(button);
        }
        root.addView(box, new FrameLayout.LayoutParams(-1, -1));
    }

    private void pauseGame() {
        if (web != null) web.evaluateJavascript(
            "if(window.PigAndroid) window.PigAndroid.pause()", null);
    }

    public final class UpdateBridge {
        @JavascriptInterface public String info() { return updater.info(); }
        @JavascriptInterface public void check() { updater.check(); }
        @JavascriptInterface public void setAuto(boolean on) { updater.setAuto(on); }
        @JavascriptInterface public void download() { updater.download(); }
        @JavascriptInterface public void install() { runOnUiThread(() -> { pauseGame(); updater.install(); }); }
        @JavascriptInterface public void openPage() { updater.openPage(); }
    }

    /** Only our packaged page can invoke this bridge; WebView itself stays offline. */
    public final class LanBridge {
        @JavascriptInterface public void call(int id, String operation, String payload) {
            if (id < 1 || payload == null || payload.length() > LanNetwork.MAX_LINE) return;
            final LanNetwork network = lan;
            if (network == null || lanCommands.isShutdown()) return;
            lanCommands.execute(() -> {
                Object result;
                try {
                    JSONObject data = new JSONObject(payload);
                    switch (operation) {
                        case "host": result = network.host(data); break;
                        case "join": result = network.join(data.optString("host"), data.optInt("port")); break;
                        case "room": result = network.setRoom(data); break;
                        case "scan": result = network.scan(data.optBoolean("on")); break;
                        case "send": result = network.send(data.optString("to"), data.getJSONObject("msg")); break;
                        case "kick": result = network.kick(data.optString("id")); break;
                        case "leave": network.scan(false); result = network.leave(); break;
                        case "info": result = network.info(); break;
                        default: result = LanNetwork.json("ok", false, "error", "未知联机操作");
                    }
                } catch (Exception error) { result = LanNetwork.json("ok", false, "error", "联机操作未完成，请重试"); }
                final JSONObject response = LanNetwork.json("id", id, "result", result);
                runOnUiThread(() -> {
                    if (network != lan || web == null || isDestroyed()) return;
                    updateLanWifiLock(network.info());
                    web.evaluateJavascript("if(window.PiggyLan)window.PiggyLan._reply(" + response.toString() + ")", null);
                });
            });
        }
    }

    private void updateLanWifiLock(JSONObject info) {
        boolean active = info.optBoolean("hosting") || info.optBoolean("joined") || info.optBoolean("scanning");
        try {
            if (active && lanWifiLock == null) {
                android.net.wifi.WifiManager wifi = (android.net.wifi.WifiManager)getApplicationContext().getSystemService(WIFI_SERVICE);
                if (wifi != null) { lanWifiLock = wifi.createMulticastLock("PiggyLanDiscovery"); lanWifiLock.setReferenceCounted(false); lanWifiLock.acquire(); }
            } else if (!active && lanWifiLock != null) {
                if (lanWifiLock.isHeld()) lanWifiLock.release(); lanWifiLock = null;
            }
        } catch (RuntimeException error) { android.util.Log.w("PiggyLan", "Wi-Fi discovery lock unavailable"); }
    }

    /**
     * 猪猪爱学习题库：用户选择 JSON 或 ZIP，验证后复制到应用内部的 study 文件夹，
     * 页面只能按相对文件名列出、读取或移除这里的文件。
     */
    private File studyDir() {
        File dir = new File(getFilesDir(), "study");
        if (!dir.isDirectory()) dir.mkdirs();
        return dir;
    }

    private File studyFile(String rel) {
        if (rel == null || !rel.toLowerCase().endsWith(".json") || rel.contains("..") || rel.startsWith("/")) return null;
        try {
            File base = studyDir().getCanonicalFile();
            File f = new File(base, rel).getCanonicalFile();
            return f.getPath().startsWith(base.getPath() + File.separator) ? f : null;
        } catch (Exception e) { return null; }
    }

    private static String readAll(InputStream in, long limit) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[65536];
        int n;
        long total = 0;
        while ((n = in.read(buffer)) != -1) {
            total += n;
            if (total > limit) throw new Exception("too large");
            out.write(buffer, 0, n);
        }
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }

    public final class StudyBridge {
        @JavascriptInterface public String list() {
            JSONArray rows = new JSONArray();
            File base = studyDir();
            File[] subs = base.listFiles();
            if (subs == null) return "[]";
            for (File sub : subs) {
                File[] files = sub.isDirectory() ? sub.listFiles() : new File[] { sub };
                if (files == null) continue;
                for (File f : files) {
                    if (!f.isFile() || !f.getName().toLowerCase().endsWith(".json")) continue;
                    try {
                        String rel = sub.isDirectory() ? sub.getName() + "/" + f.getName() : f.getName();
                        rows.put(new JSONObject().put("file", rel).put("size", f.length()));
                    } catch (Exception ignored) { }
                }
            }
            return rows.toString();
        }
        @JavascriptInterface public String head(String rel) {
            File f = studyFile(rel);
            if (f == null || !f.isFile()) return "";
            try (InputStream in = new java.io.FileInputStream(f)) {
                byte[] b = new byte[4096];
                int n = in.read(b);
                return n > 0 ? new String(b, 0, n, StandardCharsets.UTF_8) : "";
            } catch (Exception e) { return ""; }
        }
        @JavascriptInterface public String read(String rel) {
            File f = studyFile(rel);
            if (f == null || !f.isFile()) return "";
            try (InputStream in = new java.io.FileInputStream(f)) { return readAll(in, MAX_BANK_BYTES); }
            catch (Exception e) { return ""; }
        }
        @JavascriptInterface public boolean remove(String rel) {
            File f = studyFile(rel);
            return f != null && f.isFile() && f.delete();
        }
        @JavascriptInterface public void pick() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                    intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "application/json", "application/zip", "application/x-zip-compressed", "application/octet-stream", "text/plain", "text/json" });
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    startActivityForResult(intent, PICK_STUDY_BANKS);
                } catch (Exception e) {
                    studyPicked(0, 0);
                }
            });
        }
    }

    private void studyPicked(int added, int skipped) {
        if (web != null) web.evaluateJavascript("window.PigStudyHost&&window.PigStudyHost.onPicked('{\"added\":" + added + ",\"skipped\":" + skipped + "}')", null);
    }

    private String displayName(Uri uri) {
        try (Cursor c = getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) { }
        String last = uri.getLastPathSegment();
        return last == null ? "题库.json" : last;
    }

    private static String safeStudyName(String name, String fallback, int maxBytes) {
        String safe = String.valueOf(name).replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        while (safe.contains("..")) safe = safe.replace("..", "_");
        while (safe.getBytes(StandardCharsets.UTF_8).length > maxBytes)
            safe = safe.substring(0, safe.offsetByCodePoints(safe.length(), -1));
        return safe.isEmpty() || safe.equals(".") ? fallback : safe;
    }

    private boolean stageStudyBank(String name, byte[] bytes, Map<String, File> staged) throws IOException {
        String text = new String(bytes, StandardCharsets.UTF_8);
        if (text.startsWith("\uFEFF")) text = text.substring(1);
        String subject;
        try {
            JSONObject bank = new JSONObject(text);
            JSONArray units = bank.optJSONArray("units");
            if (!"piggy-study-bank".equals(bank.optString("format")) || bank.optInt("version", 1) > 2 || units == null)
                return false;
            boolean hasQuestions = false;
            for (int i = 0; i < units.length(); i++) {
                JSONObject unit = units.optJSONObject(i);
                JSONArray questions = unit == null ? null : unit.optJSONArray("questions");
                if (questions != null && questions.length() > 0) { hasQuestions = true; break; }
            }
            if (!hasQuestions) return false;
            subject = safeStudyName(bank.optString("subjectName", "其他"), "其他", 60);
        } catch (org.json.JSONException error) { return false; }
        String fileName = safeStudyName(name, "题库.json", 220);
        if (!fileName.toLowerCase(java.util.Locale.ROOT).endsWith(".json")) fileName += ".json";
        File temp = File.createTempFile("study-bank-", ".json", getCacheDir());
        boolean saved = false;
        try {
            try (FileOutputStream output = new FileOutputStream(temp)) {
                output.write(text.getBytes(StandardCharsets.UTF_8));
            }
            File old = staged.put(subject + "/" + fileName, temp);
            if (old != null) old.delete();
            saved = true;
        } finally { if (!saved) temp.delete(); }
        return true;
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_STUDY_BANKS) return;
        final ArrayList<Uri> uris = new ArrayList<>();
        if (resultCode == RESULT_OK && data != null) {
            ClipData clip = data.getClipData();
            if (clip != null) for (int i = 0; i < clip.getItemCount(); i++) uris.add(clip.getItemAt(i).getUri());
            else if (data.getData() != null) uris.add(data.getData());
        }
        new Thread(() -> {
            int added = 0, skipped = 0;
            ArrayList<String> errors = new ArrayList<>();
            for (Uri uri : uris) {
                Map<String, File> staged = new LinkedHashMap<>();
                try (InputStream in = getContentResolver().openInputStream(uri)) {
                    StudyBankImporter.Result imported = StudyBankImporter.read(in, displayName(uri),
                        (name, bytes) -> stageStudyBank(name, bytes, staged));
                    skipped += imported.skipped;
                    // Complete and verify the archive first; a damaged ZIP leaves existing banks intact.
                    for (Map.Entry<String, File> entry : staged.entrySet()) {
                        File target = studyFile(entry.getKey());
                        if (target == null) throw new IOException("题库文件名无法保存。");
                        File parent = target.getParentFile();
                        if (!parent.isDirectory() && !parent.mkdirs()) throw new IOException("题库文件夹无法创建。");
                        Files.move(entry.getValue().toPath(), target.toPath(),
                            StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
                        added++;
                    }
                } catch (Exception error) {
                    errors.add(displayName(uri) + "：" + (error instanceof java.util.zip.ZipException ?
                        "ZIP 已损坏或加密，请重新获取未加密的压缩包。" :
                        error instanceof IOException ? error.getMessage() : "未能导入，请重新选择题库文件。"));
                } finally {
                    for (File temp : staged.values()) temp.delete();
                }
            }
            final int a = added, s = skipped;
            runOnUiThread(() -> {
                studyPicked(a, s);
                if (!errors.isEmpty() && !isDestroyed()) new AlertDialog.Builder(this)
                    .setTitle("部分题库未能导入")
                    .setMessage((a > 0 ? "已导入 " + a + " 套题库。\n\n" : "") + String.join("\n", errors))
                    .setPositiveButton("知道了", (dialog, which) -> {}).show();
            });
        }).start();
    }

    private void requestBack() {
        if (web == null) { finish(); return; }
        web.evaluateJavascript("window.PigAndroid ? window.PigAndroid.back() : 'exit'", value -> {
            if ("\"exit\"".equals(value)) confirmExit();
        });
    }

    private void confirmExit() {
        if (exitDialog != null && exitDialog.isShowing()) return;
        pauseGame();
        exitDialog = new AlertDialog.Builder(this)
            .setTitle("先休息一下？")
            .setMessage("成绩、造型和声音设置已经自动保存。")
            .setNegativeButton("继续玩", (dialog, which) -> {})
            .setPositiveButton("退出", (dialog, which) -> finish())
            .create();
        exitDialog.show();
    }

    @Override public void onBackPressed() { requestBack(); }

    @Override protected void onResume() {
        super.onResume();
        foreground = true;
        if (updater != null) updater.resume();
        if (web != null) {
            web.resumeTimers();
            web.onResume();
            if (wasBackground) pauseGame();
            web.evaluateJavascript("if(window.PigAndroid&&window.PigAndroid.onLanForeground)window.PigAndroid.onLanForeground(true)", null);
        }
    }

    @Override protected void onPause() {
        foreground = false;
        wasBackground = true;
        pauseGame();
        if (web != null) {
            web.evaluateJavascript("if(window.PigAndroid&&window.PigAndroid.onLanForeground)window.PigAndroid.onLanForeground(false)", null);
            web.onPause();
            web.pauseTimers();
        }
        super.onPause();
    }

    @Override public void onConfigurationChanged(Configuration config) {
        super.onConfigurationChanged(config);
        root.requestApplyInsets();
    }

    @Override protected void onDestroy() {
        if (lan != null) { lan.close(); lan = null; }
        lanCommands.shutdownNow();
        updateLanWifiLock(new JSONObject());
        if (updater != null) updater.close();
        if (exitDialog != null) exitDialog.dismiss();
        if (web != null) {
            root.removeView(web);
            web.stopLoading();
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
