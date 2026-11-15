package local.piggy.playground.test;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import java.io.File;
import java.io.FileOutputStream;
import java.io.ByteArrayInputStream;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;

/** Run only on a disposable QA emulator. Uses the installed, signed release APK. */
public class StartupTests extends Instrumentation {
    private Activity activity;
    private WebView web;
    private boolean requirePreserved;
    private final JSONArray checks = new JSONArray();

    @Override public void onCreate(Bundle args) {
        super.onCreate(args);
        requirePreserved = args != null && "true".equals(args.getString("preserved"));
        start();
    }
    @Override public void onStart() {
        Bundle report = new Bundle();
        try {
            launch();
            awaitReady();
            check("location.origin === 'https://appassets.androidplatform.net'", "stable save origin");
            boolean homeMode = "true".equals(js("!!(window.PigShell && PigShell.started)"));
            if (homeMode) check("PigShell.view === 'home' && document.body.dataset.view === 'home'", "cold launch reaches home");
            else check("document.getElementById('android-games').open", "cold launch reaches legacy hall");
            check("PigCatalog.GAMES.length === 32 && PigAndroidLan.games.length === 10", "games and native LAN adapter initialized");
            if (requirePreserved) check("localStorage.getItem('piggy-startup-qa') === 'keep-after-upgrade'", "in-place APK upgrade preserves storage");
            js("localStorage.setItem('piggy-startup-qa','keep-after-upgrade');PiggyAndroidBridge.setAuto(false)");
            screenshot("startup-home.png");
            js("document.querySelectorAll('dialog[open]').forEach(d=>d.close())");
            js(homeMode ? "PigShell.go('park')" : "document.getElementById('android-hall-button').click()");
            check("document.getElementById('android-games').open", "home opens game hall");
            check("document.querySelectorAll('[data-mobile-game]').length === 32", "all game entries render");
            js("document.querySelector('[data-mobile-game=mine]').click()");
            check("document.querySelectorAll('.mine-cell').length === 81", "offline game initializes");
            back();
            check("document.getElementById('android-games').open", "native back returns to hall");
            if (homeMode) {
                back();
                check("PigShell.view === 'home' && !document.getElementById('android-games').open", "native back returns home");
            }

            AtomicReference<WebViewClient> client = new AtomicReference<>();
            runOnMainSync(() -> client.set(web.getWebViewClient()));
            response(client.get(), "https://appassets.androidplatform.net/game.html", "GET", 200);
            response(client.get(), "https://appassets.androidplatform.net/assets/engines/stockfish/part-0.js", "GET", 200);
            response(client.get(), "https://example.invalid/private", "GET", 403);
            response(client.get(), "http://example.invalid/private", "GET", 403);
            response(client.get(), "https://appassets.androidplatform.net/not-packaged", "GET", 403);
            response(client.get(), "https://appassets.androidplatform.net/game.html", "POST", 403);
            pass("unlisted and external requests remain blocked");

            WebView failed = web;
            runOnMainSync(() -> client.get().onReceivedHttpError(failed,
                new Request("https://appassets.androidplatform.net/game.html", "GET"),
                new WebResourceResponse("text/plain", "UTF-8", 500, "Injected QA failure", null,
                    new ByteArrayInputStream(new byte[0]))));
            if (find(activity.getWindow().getDecorView(), WebView.class) != null) throw new AssertionError("Failed renderer remains attached");
            Button retry = find(activity.getWindow().getDecorView(), Button.class);
            if (retry == null || !"重新打开".contentEquals(retry.getText())) throw new AssertionError("Retry unavailable");
            screenshot("startup-retry.png");
            runOnMainSync(() -> retry.performClick());
            web = find(activity.getWindow().getDecorView(), WebView.class);
            if (web == null || web == failed) throw new AssertionError("Retry reused the failed renderer");
            awaitReady();
            check("localStorage.getItem('piggy-startup-qa') === 'keep-after-upgrade'", "retry preserves saved data");
            screenshot("startup-recovered.png");
            runOnMainSync(() -> activity.finish());
            launch();
            awaitReady();
            check("localStorage.getItem('piggy-startup-qa') === 'keep-after-upgrade'", "activity recreation preserves saved data");
            report.putString("result", "PASS");
            report.putString("checks", checks.toString());
            finish(Activity.RESULT_OK, report);
        } catch (Throwable error) {
            try { screenshot("startup-failure.png"); } catch (Throwable ignored) { }
            android.util.Log.e("PiggyStartupTest", "Startup regression failed", error);
            report.putString("result", "FAIL");
            report.putString("error", error.toString());
            report.putString("checks", checks.toString());
            finish(Activity.RESULT_CANCELED, report);
        }
    }
    private void launch() {
        activity = startActivitySync(new Intent(Intent.ACTION_MAIN)
            .setClassName("local.piggy.playground", "local.piggy.playground.MainActivity")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        web = find(activity.getWindow().getDecorView(), WebView.class);
        if (web == null) throw new AssertionError("Packaged WebView not attached");
    }
    private static <T> T find(View view, Class<T> type) {
        if (type.isInstance(view)) return type.cast(view);
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup)view;
            for (int i = 0; i < group.getChildCount(); i++) {
                T found = find(group.getChildAt(i), type);
                if (found != null) return found;
            }
        }
        return null;
    }
    private String js(String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> value = new AtomicReference<>();
        runOnMainSync(() -> web.evaluateJavascript(script, result -> { value.set(result); done.countDown(); }));
        if (!done.await(45, TimeUnit.SECONDS)) throw new AssertionError("JavaScript response timed out");
        return value.get();
    }
    private void awaitReady() throws Exception {
        long deadline = SystemClock.uptimeMillis() + 60000;
        do {
            if ("true".equals(js("!!(window.PigAndroid && document.body.dataset.androidReady === 'true')"))) {
                pass("packaged page ready in native WebView"); return;
            }
            SystemClock.sleep(200);
        } while (SystemClock.uptimeMillis() < deadline);
        throw new AssertionError("Packaged page did not initialize");
    }
    private void back() throws Exception {
        runOnMainSync(() -> activity.onBackPressed());
        SystemClock.sleep(250);
        js("true");
    }
    private void check(String expression, String label) throws Exception {
        if (!"true".equals(js(expression))) throw new AssertionError(label);
        pass(label);
    }
    private void pass(String label) {
        checks.put(label);
        Bundle progress = new Bundle(); progress.putString("stream", "PASS: " + label + "\n"); sendStatus(0, progress);
    }
    private void response(WebViewClient client, String url, String method, int expected) throws Exception {
        WebResourceResponse result = client.shouldInterceptRequest(web, new Request(url, method));
        if (result == null || result.getStatusCode() != expected) throw new AssertionError("Wrong response for " + method + " " + url);
        result.getData().close();
    }
    private void screenshot(String name) throws Exception {
        File directory = new File(getContext().getExternalFilesDir(null), "qa"); directory.mkdirs();
        Bitmap bitmap = getUiAutomation().takeScreenshot();
        if (bitmap == null) throw new AssertionError("Screenshot unavailable");
        try (FileOutputStream out = new FileOutputStream(new File(directory, name))) { bitmap.compress(Bitmap.CompressFormat.PNG, 100, out); }
        bitmap.recycle();
    }
    private static class Request implements WebResourceRequest {
        private final Uri uri; private final String method;
        Request(String url, String method) { this.uri = Uri.parse(url); this.method = method; }
        public Uri getUrl() { return uri; }
        public boolean isForMainFrame() { return true; }
        public boolean isRedirect() { return false; }
        public boolean hasGesture() { return false; }
        public String getMethod() { return method; }
        public Map<String, String> getRequestHeaders() { return Collections.emptyMap(); }
    }
}
