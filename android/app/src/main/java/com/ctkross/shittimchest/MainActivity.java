package com.ctkross.shittimchest;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.KeyEvent;
import android.webkit.WebView;

/**
 * 홈(런처). 웹앱(app/)을 전체 화면으로 띄운다.
 * - 바로 홈 화면 (부팅 연출 없음)
 */
public class MainActivity extends Activity {
    private static boolean foreground;
    private static MainActivity current;
    private WebView web;
    private Bridge bridge;
    private BroadcastReceiver sys;
    private boolean pendingLoad = true;
    private boolean wasLocked;
    boolean immersiveWanted = true;

    public static boolean isForeground() { return foreground; }
    public static MainActivity current() { return current; }
    public Bridge bridge() { return bridge; }

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        current = this;
        WebHost.immersive(this);
        bridge = new Bridge(this);
        web = WebHost.create(this, bridge);
        web.setBackgroundColor(0);                     // '기기 배경화면' 모드에서 시스템 배경이 비치도록
        bridge.attach(web);
        setContentView(web);
        // 시스템 바 높이 → 페이지 (런처 모드에서 상태바·내비게이션바를 피해서 배치)
        web.setOnApplyWindowInsetsListener((v, ins) -> {
            float d = getResources().getDisplayMetrics().density;
            int top = ins.getSystemWindowInsetTop(), bottom = ins.getSystemWindowInsetBottom();
            bridge.emit("insets", "{\"top\":" + (top / d) + ",\"bottom\":" + (bottom / d) + "}");
            return ins;
        });
        if (b != null) { web.restoreState(b); pendingLoad = false; }
        // 잠금 뒤에서 미리 불러 둔다 — 페이지는 잠금이 풀릴 때까지 연출을 시작하지 않고 기다린다(unlocked 이벤트)
        if (b == null) { pendingLoad = false; web.loadUrl(WebHost.BASE + "?native=1"); }

        // 기기 상태 → 페이지
        IntentFilter f = new IntentFilter();
        f.addAction(Intent.ACTION_BATTERY_CHANGED);
        f.addAction(Intent.ACTION_POWER_CONNECTED);
        f.addAction(Intent.ACTION_POWER_DISCONNECTED);
        f.addAction(Intent.ACTION_PACKAGE_ADDED);
        f.addAction(Intent.ACTION_PACKAGE_REMOVED);
        f.addAction("android.net.conn.CONNECTIVITY_CHANGE");
        f.addAction(Intent.ACTION_USER_PRESENT);
        sys = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) {
                String act = i.getAction() == null ? "" : i.getAction();
                if (Intent.ACTION_USER_PRESENT.equals(act)) { bridge.emit("unlocked", null); loadIfReady(); }
                else if (act.startsWith("android.intent.action.PACKAGE")) {
                    // 업데이트(교체) 중에는 '삭제 → 추가'가 연달아 오는데, 이때 홈 배치를 지우면 안 된다
                    String pkg = i.getData() == null ? "" : i.getData().getSchemeSpecificPart();
                    boolean replacing = i.getBooleanExtra(Intent.EXTRA_REPLACING, false);
                    String kind = Intent.ACTION_PACKAGE_REMOVED.equals(act) ? (replacing ? "updating" : "removed") : (replacing ? "updated" : "added");
                    bridge.emit("apps", "{\"pkg\":" + org.json.JSONObject.quote(pkg) + ",\"kind\":\"" + kind + "\"}");
                }
                else if (act.contains("CONNECTIVITY")) bridge.emit("network", bridge.device());
                else bridge.emit("battery", Bridge.batteryJson(c));
            }
        };
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(sys, f, Context.RECEIVER_EXPORTED);
        else registerReceiver(sys, f);
        IntentFilter pf = new IntentFilter();
        pf.addAction(Intent.ACTION_PACKAGE_ADDED); pf.addAction(Intent.ACTION_PACKAGE_REMOVED); pf.addDataScheme("package");
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(sys, pf, Context.RECEIVER_EXPORTED);
        else registerReceiver(sys, pf);

        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 7);
        handleIntent(getIntent());
    }

    private void handleIntent(Intent i) {
        if (i != null && i.getBooleanExtra("showUpdate", false)) bridge.emit("update", Updater.pendingJson(this));
    }

    @Override protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        // 홈 버튼을 다시 누르면 패널을 닫고 로비로
        if (Intent.ACTION_MAIN.equals(i.getAction()) && i.hasCategory(Intent.CATEGORY_HOME)) bridge.emit("home", null);
        handleIntent(i);
    }

    private void loadIfReady() {
        watchUnlock();
        if (!pendingLoad) return;
        pendingLoad = false;
        web.loadUrl(WebHost.BASE + "?native=1");
    }

    /** 잠금이 풀리는 순간을 바로 알린다 (USER_PRESENT 방송은 조금 늦게 오는 기기가 있어 0.15초마다 직접 확인) */
    private void watchUnlock() {
        android.app.KeyguardManager km = getSystemService(android.app.KeyguardManager.class);
        boolean locked = km != null && km.isKeyguardLocked();
        if (locked) { wasLocked = true; web.postDelayed(() -> { if (foreground) watchUnlock(); }, 150); }
        else if (wasLocked) { wasLocked = false; bridge.emit("unlocked", null); }
    }

    /** 런처 화면에서는 상태바·내비게이션바를 보이고, 부팅·스토리 연출 중에는 숨긴다 */
    void setBars(boolean show) {
        immersiveWanted = !show;
        if (show) WebHost.showBars(this); else WebHost.immersive(this);
    }

    @Override protected void onResume() {
        super.onResume();
        foreground = true; current = this;
        loadIfReady();
        if (immersiveWanted) WebHost.immersive(this); else WebHost.showBars(this);
        web.onResume(); web.resumeTimers();
        bridge.emit("resume", bridge.info());
        bridge.emit("battery", Bridge.batteryJson(this));
    }

    /** 다른 앱으로 가면 소리·타이머를 멈춘다 (런처가 아닐 때 뒤에서 캐릭터가 말하지 않게) */
    @Override protected void onPause() {
        super.onPause(); foreground = false;
        bridge.emit("pause", null);
        web.postDelayed(() -> { if (!foreground) { web.onPause(); web.pauseTimers(); } }, 150);
    }

    @Override public void onWindowFocusChanged(boolean has) { super.onWindowFocusChanged(has); if (has && immersiveWanted) WebHost.immersive(this); }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @Override protected void onDestroy() {
        try { unregisterReceiver(sys); } catch (Exception ignored) { }
        if (current == this) current = null;
        web.destroy();
        super.onDestroy();
    }

    /** 런처이므로 뒤로 가기로 앱이 닫히지 않는다 — 페이지에서 패널 닫기 등에 쓴다 */
    @Override public boolean onKeyDown(int code, KeyEvent e) {
        if (code == KeyEvent.KEYCODE_BACK) { bridge.emit("back", null); return true; }
        return super.onKeyDown(code, e);
    }

    @Override protected void onActivityResult(int req, int code, Intent data) {
        if (!WebHost.onFileResult(req, code, data)) super.onActivityResult(req, code, data);
    }

    @Override public void onRequestPermissionsResult(int rc, String[] p, int[] g) {
        super.onRequestPermissionsResult(rc, p, g);
        bridge.emit("resume", bridge.info());
    }
}
