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
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/** Offline game launcher with a narrow native update bridge; no external storage access. */
public class MainActivity extends Activity {
    private static final int CREAM = Color.rgb(255, 251, 241);
    private static final String ORIGIN = "https://appassets.androidplatform.net/";
    private FrameLayout root;
    private WebView web;
    private boolean foreground;
    private boolean wasBackground;
    private AlertDialog exitDialog;
    private UpdateManager updater;
    private boolean checkedOnLaunch;

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
            web.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    return true; // Game and attribution content have no external navigation.
                }
                @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    String scheme = request.getUrl().getScheme();
                    if ("https".equals(scheme) || "http".equals(scheme)) {
                        return new WebResourceResponse("text/plain", "UTF-8", 403, "Offline", null,
                            new ByteArrayInputStream(new byte[0]));
                    }
                    return null;
                }
                @Override public void onPageFinished(WebView view, String url) {
                    view.evaluateJavascript("typeof window.PigAndroid === 'object'", ready -> {
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
                    root.removeView(view);
                    view.destroy();
                    web = null;
                    showProblem("小猪需要重新整理一下游乐场。已保存的成绩和设置还在。", true);
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
            String html;
            try (InputStream input = getAssets().open("game.html");
                 ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
                html = new String(bytes.toByteArray(), StandardCharsets.UTF_8);
            }
            // A stable HTTPS virtual origin permits private localStorage, with all assets inline.
            web.loadDataWithBaseURL(ORIGIN, html, "text/html", "UTF-8", ORIGIN);
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
        }
    }

    @Override protected void onPause() {
        foreground = false;
        wasBackground = true;
        pauseGame();
        if (web != null) {
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
        if (updater != null) updater.close();
        if (exitDialog != null) exitDialog.dismiss();
        if (web != null) {
            root.removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
