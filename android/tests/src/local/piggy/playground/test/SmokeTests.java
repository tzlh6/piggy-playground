package local.piggy.playground.test;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageInfo;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;

/** Runs only against an explicitly installed QA emulator, never a user's phone. */
public class SmokeTests extends Instrumentation {
    private Activity activity;
    private WebView web;
    private final JSONArray results = new JSONArray();
    private File screenshots;

    @Override public void onCreate(Bundle arguments) {
        super.onCreate(arguments);
        start();
    }

    @Override public void onStart() {
        Bundle report = new Bundle();
        try {
            screenshots = new File(getContext().getExternalFilesDir(null), "qa");
            screenshots.mkdirs();
            launch();
            await("document.body.dataset.androidReady === 'true'", "packaged HTML loaded");
            execute("if(document.getElementById('notes-dialog').open)document.getElementById('notes-dialog').close(); document.querySelector('[data-category=all]').click()");
            check("document.querySelectorAll('.android-game-card').length === 19", "all 19 games in hall");
            check("document.getElementById('android-games').open", "hall shown at launch");
            check("document.documentElement.scrollWidth <= innerWidth", "portrait fits phone width");
            screenshot("hall.png");

            String[] games = {"mine","memory","merge","whack","snake","runner","blocks","breakout","flappy","stack","connect","sokoban","lights","match","slice","shooter","rhythm","roulette","doudizhu"};
            for (String game : games) {
                select(game);
                check("document.body.dataset.game === '" + game + "' && document.getElementById('board').childElementCount > 0", game + " initialized offline");
                check("document.documentElement.scrollWidth <= innerWidth + 1", game + " fits viewport");
            }

            select("mine");
            check("document.querySelectorAll('.mine-cell').length === 81", "touch-friendly 9x9 default");
            gesture(".mine-cell[data-i='0']", 650, false);
            check("document.querySelector('.mine-cell[data-i=\"0\"]').classList.contains('flag')", "native long press flags once");
            gesture(".mine-cell[data-i='0']", 650, false);
            check("!document.querySelector('.mine-cell[data-i=\"0\"]').classList.contains('flag') && !document.querySelector('.mine-cell[data-i=\"0\"]').classList.contains('open')", "second long press unflags without opening");
            gesture(".mine-cell[data-i='40']", 70, false);
            check("document.querySelector('.mine-cell[data-i=\"40\"]').classList.contains('open')", "native tap reveals safe first cell");
            check("Sound.ctx && Sound.ctx.state === 'running'", "audio unlocks from native touch");
            screenshot("mine.png");

            execute("document.getElementById('look-settings').click(); document.querySelector('#look-choices [data-look=taro]').click()");
            check("document.body.dataset.look === 'taro'", "pig costume setting applied");
            nativeBack();
            check("!document.getElementById('look-dialog').open && !document.getElementById('android-games').open", "native back closes settings first");
            nativeBack();
            check("document.getElementById('android-games').open", "native back opens hall");
            check("document.getElementById('pause-layer').hidden === false", "hall pauses current game");
            execute("document.querySelector('#android-games .close').click()");

            select("match");
            check("document.querySelectorAll('.match-cell').length === 64", "all match tiles render");
            screenshot("match.png");

            select("slice");
            gesture("#challenge-cv", 100, true);
            check("running && state.started", "native slice drag starts the game");
            screenshot("slice.png");
            runOnMainSync(() -> callActivityOnPause(activity));
            SystemClock.sleep(150);
            runOnMainSync(() -> callActivityOnResume(activity));
            await("paused && document.getElementById('pause-layer').hidden === false", "background and foreground preserve pause");
            execute("document.getElementById('resume').click()");
            check("!paused", "explicit resume restores game");
            execute("window.PigAndroid.pause()");
            runOnMainSync(() -> activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));
            await("innerWidth > innerHeight", "landscape layout");
            check("document.body.dataset.game === 'slice' && state.started && paused", "rotation preserves current game and pause");
            screenshot("landscape.png");
            runOnMainSync(() -> activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
            await("innerHeight > innerWidth", "portrait layout restored");

            PackageInfo info = getTargetContext().getPackageManager().getPackageInfo(getTargetContext().getPackageName(), android.content.pm.PackageManager.GET_PERMISSIONS);
            java.util.Set<String> permissions = new java.util.HashSet<>(java.util.Arrays.asList(info.requestedPermissions));
            if (!permissions.equals(new java.util.HashSet<>(java.util.Arrays.asList("android.permission.INTERNET", "android.permission.REQUEST_INSTALL_PACKAGES")))) throw new AssertionError("Unexpected permissions in release APK");
            pass("release APK requests only HTTPS update and user-confirmed install permissions");
            execute("document.getElementById('android-hall-button').click(); document.getElementById('android-update').click()");
            check("document.getElementById('android-updates').open && !document.getElementById('android-auto').disabled", "native update bridge and mobile update dialog");
            execute("document.getElementById('android-auto').checked=false; document.getElementById('android-auto').dispatchEvent(new Event('change'))");
            await("!JSON.parse(PiggyAndroidBridge.info()).auto", "auto-check preference persisted natively");
            execute("document.getElementById('android-auto').checked=true; document.getElementById('android-auto').dispatchEvent(new Event('change')); document.getElementById('android-updates').close()");

            select("mine");
            execute("document.querySelector('#level [data-level=medium]').click()");
            check("document.querySelectorAll('.mine-cell').length === 256", "higher difficulty supported");
            runOnMainSync(() -> activity.finish());
            SystemClock.sleep(250);
            launch();
            await("document.body.dataset.androidReady === 'true'", "relaunch after Activity shutdown");
            check("document.body.dataset.look === 'taro' && document.querySelectorAll('.mine-cell').length === 256", "costume and difficulty persist across relaunch");
            execute("document.querySelector('#android-games .close').click(); document.querySelector('#level [data-level=easy]').click(); document.getElementById('look-settings').click(); document.querySelector('#look-choices [data-look=peach]').click(); document.getElementById('look-dialog').close(); document.getElementById('android-hall-button').click()");
            screenshot("hall-final.png");
            report.putString("result", "PASS");
            report.putString("checks", results.toString());
            report.putString("screenshotDirectory", screenshots.getAbsolutePath());
            finish(Activity.RESULT_OK, report);
        } catch (Throwable error) {
            android.util.Log.e("PiggyTest", "Smoke test failed", error);
            report.putString("result", "FAIL");
            report.putString("error", error.toString());
            report.putString("checks", results.toString());
            try { screenshot("failure.png"); } catch (Throwable ignored) {}
            finish(Activity.RESULT_CANCELED, report);
        }
    }

    private void launch() {
        Intent intent = new Intent(Intent.ACTION_MAIN).setClassName("local.piggy.playground", "local.piggy.playground.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity = startActivitySync(intent);
        web = findWeb(activity.getWindow().getDecorView());
        if (web == null) throw new AssertionError("WebView unavailable");
    }

    private WebView findWeb(View view) {
        if (view instanceof WebView) return (WebView)view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup)view;
            for (int index=0; index<group.getChildCount(); index++) {
                WebView found = findWeb(group.getChildAt(index));
                if (found != null) return found;
            }
        }
        return null;
    }

    private String js(String script) throws Exception {
        CountDownLatch ready = new CountDownLatch(1);
        AtomicReference<String> value = new AtomicReference<>();
        runOnMainSync(() -> web.evaluateJavascript(script, result -> { value.set(result); ready.countDown(); }));
        if (!ready.await(45, TimeUnit.SECONDS)) throw new AssertionError("WebView script timeout");
        return value.get();
    }

    private void execute(String script) throws Exception { js(script); }
    private void check(String expression, String label) throws Exception {
        if (!"true".equals(js(expression))) throw new AssertionError(label + " [" + js("typeof state !== 'undefined' ? document.body.dataset.game : 'not ready'") + "]");
        pass(label);
    }
    private void pass(String label) {
        results.put(label);
        Bundle progress = new Bundle();
        progress.putString("stream", "PASS: " + label + "\n");
        sendStatus(0, progress);
    }
    private void await(String expression, String label) throws Exception {
        long deadline = SystemClock.uptimeMillis() + 60000;
        do {
            if ("true".equals(js(expression))) { pass(label); return; }
            SystemClock.sleep(200);
        } while (SystemClock.uptimeMillis() < deadline);
        throw new AssertionError(label + " timed out");
    }
    private void select(String game) throws Exception {
        execute("if(!document.getElementById('android-games').open) document.getElementById('android-hall-button').click(); document.querySelector('[data-mobile-game=\"" + game + "\"]').click()");
    }
    private void nativeBack() throws Exception {
        runOnMainSync(() -> activity.onBackPressed());
        // JS completion is ordered after the callback from the native WebView back handler.
        SystemClock.sleep(200);
        js("true");
    }
    private void gesture(String selector, int holdMs, boolean drag) throws Exception {
        JSONObject rect = new JSONObject(js("JSON.stringify((()=>{const r=document.querySelector('" + selector.replace("'", "\\'") + "').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height}})())").replaceFirst("^\"", "").replaceFirst("\"$", "").replace("\\\"", "\""));
        float density = getTargetContext().getResources().getDisplayMetrics().density;
        int[] offset = new int[2];
        runOnMainSync(() -> web.getLocationOnScreen(offset));
        float x = offset[0] + (float)rect.getDouble("x") * density;
        float y = offset[1] + (float)rect.getDouble("y") * density;
        long down = SystemClock.uptimeMillis();
        pointer(down, down, MotionEvent.ACTION_DOWN, x, y);
        SystemClock.sleep(holdMs);
        if (drag) {
            for (int step=1; step<=6; step++) {
                pointer(down, SystemClock.uptimeMillis(), MotionEvent.ACTION_MOVE, x + step * 14, y - step * 9);
                SystemClock.sleep(20);
            }
            x += 84; y -= 54;
        }
        pointer(down, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, x, y);
        SystemClock.sleep(120);
    }
    private void pointer(long down, long time, int action, float x, float y) {
        MotionEvent event = MotionEvent.obtain(down, time, action, x, y, 0);
        event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        sendPointerSync(event);
        event.recycle();
    }
    private void screenshot(String name) throws Exception {
        Bitmap bitmap = getUiAutomation().takeScreenshot();
        if (bitmap == null) throw new AssertionError("Screenshot unavailable");
        try (FileOutputStream output = new FileOutputStream(new File(screenshots, name))) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, output);
        }
        bitmap.recycle();
    }
}
