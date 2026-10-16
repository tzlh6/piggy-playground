package local.piggy.playground.test;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;

/** Isolated-emulator test: real packaged WebView, real Java bridge, intercepted browser intent. */
public final class UpdaterTests extends Instrumentation {
    private WebView web;
    private boolean baseline, preserved;
    private final JSONArray checks = new JSONArray();
    @Override public void onCreate(Bundle arguments) {
        super.onCreate(arguments);
        baseline = "true".equals(arguments.getString("baseline"));
        preserved = "true".equals(arguments.getString("preserved"));
        start();
    }
    @Override public void onStart() {
        Bundle report = new Bundle();
        try {
            // QA emulator preferences only; prevent the startup request from masking manual-button failures.
            getTargetContext().getSharedPreferences("piggy-updater", 0).edit().putBoolean("auto", false).commit();
            Activity activity = startActivitySync(new Intent(Intent.ACTION_MAIN)
                .setClassName("local.piggy.playground", "local.piggy.playground.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            web = find(activity.getWindow().getDecorView());
            await("document.body.dataset.androidReady==='true'", 60000);
            await("Store.get('seen-android-version',null)==='4.4.4' || document.getElementById('notes-dialog').open", 60000);
            js("document.getElementById('notes-dialog').close(); document.getElementById('android-update').click()");
            check("document.getElementById('android-updates').open", "update dialog opens");
            check("JSON.parse(PiggyAndroidBridge.info()).status==='idle'", "automatic check disabled for manual regression");
            AtomicReference<String> browser = new AtomicReference<>();
            ActivityMonitor monitor = new ActivityMonitor() {
                @Override public ActivityResult onStartActivity(Intent intent) {
                    if (Intent.ACTION_VIEW.equals(intent.getAction())) {
                        browser.set(intent.getDataString());
                        return new ActivityResult(Activity.RESULT_OK, new Intent());
                    }
                    return null;
                }
            };
            addMonitor(monitor);
            js("document.getElementById('android-release-page').click()");
            for (int retry = 0; retry < 50 && browser.get() == null; retry++) SystemClock.sleep(100);
            if (baseline) {
                if (browser.get() != null) throw new AssertionError("4.4.1 browser bug not reproduced");
                pass("4.4.1 download-page button reproduces missing native call");
                js("document.getElementById('android-check').click()");
                SystemClock.sleep(1000);
                check("JSON.parse(PiggyAndroidBridge.info()).status==='idle'", "4.4.1 check button reproduces missing native call");
                js("localStorage.setItem('piggy-qa-preserve','stored-in-4.4.1')");
            } else {
                if (!"https://github.com/tzlh6/piggy-playground/releases".equals(browser.get()))
                    throw new AssertionError("Browser ACTION_VIEW intent did not reach native code");
                pass("download-page button launches correct native browser intent");
                check("document.querySelector('.android-current').textContent.includes('4.4.4') && PigAndroid.version==='4.4.4'", "independent Android version displayed");
                if (preserved) check("localStorage.getItem('piggy-qa-preserve')==='stored-in-4.4.1'", "same-signature upgrade preserves WebView storage");
                js("document.getElementById('android-check').click()");
                await("JSON.parse(PiggyAndroidBridge.info()).status!=='idle'", 10000);
                pass("manual check button reaches native updater");
                await("!['idle','checking'].includes(JSON.parse(PiggyAndroidBridge.info()).status)", 30000);
                check("!document.getElementById('android-check').disabled", "check completes and retry button is enabled");
                check("!document.querySelector('.android-update-error').textContent.includes('Failed to connect')", "raw socket error is not exposed");
                js("document.getElementById('android-auto').checked=true; document.getElementById('android-auto').dispatchEvent(new Event('change'))");
                await("JSON.parse(PiggyAndroidBridge.info()).auto===true", 10000);
                pass("one-argument auto-check preference still works");
            }
            removeMonitor(monitor);
            report.putString("result", "PASS"); report.putString("checks", checks.toString());
            finish(Activity.RESULT_OK, report);
        } catch (Throwable error) {
            android.util.Log.e("PiggyTest", "Updater test failed", error);
            report.putString("result", "FAIL"); report.putString("error", error.toString());
            report.putString("checks", checks.toString()); finish(Activity.RESULT_CANCELED, report);
        }
    }
    private WebView find(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) for (int i=0; i<((ViewGroup)view).getChildCount(); i++) {
            WebView found = find(((ViewGroup)view).getChildAt(i)); if (found != null) return found;
        }
        return null;
    }
    private String js(String script) throws Exception {
        CountDownLatch ready = new CountDownLatch(1); AtomicReference<String> result = new AtomicReference<>();
        runOnMainSync(() -> web.evaluateJavascript(script, value -> { result.set(value); ready.countDown(); }));
        if (!ready.await(45, TimeUnit.SECONDS)) throw new AssertionError("WebView response timed out");
        return result.get();
    }
    private void check(String expression, String label) throws Exception {
        if (!"true".equals(js(expression))) throw new AssertionError(label); pass(label);
    }
    private void await(String expression, long timeout) throws Exception {
        long deadline = SystemClock.uptimeMillis() + timeout;
        do { if ("true".equals(js(expression))) return; SystemClock.sleep(100); }
        while (SystemClock.uptimeMillis() < deadline);
        throw new AssertionError("Timed out: " + expression);
    }
    private void pass(String label) {
        checks.put(label); Bundle progress = new Bundle(); progress.putString("stream", "PASS: " + label + "\n"); sendStatus(0, progress);
    }
}
