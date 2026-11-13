package com.ctkross.shittimchest;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 웹 페이지(js/native.js)에서 window.ShittimNative 로 부르는 기능.
 * 기기 → 페이지 알림은 emit(): window.__native(type, data)
 */
public class Bridge {
    private final Activity a;
    private WebView web;

    public Bridge(Activity a) { this.a = a; }
    public void attach(WebView w) { web = w; }

    /** 기기 → 페이지 이벤트 */
    public void emit(String type, String json) {
        if (web == null) return;
        String js = "window.__native&&window.__native(" + JSONObject.quote(type) + "," + (json == null ? "null" : json) + ")";
        web.post(() -> web.evaluateJavascript(js, null));
    }

    private SharedPreferences p() { return ShittimApp.prefs(a); }

    // ───────── 정보 ─────────
    @JavascriptInterface public String info() {
        try {
            JSONObject o = new JSONObject();
            o.put("version", BuildConfig.VERSION_NAME);
            o.put("versionCode", BuildConfig.VERSION_CODE);
            o.put("commit", BuildConfig.COMMIT);
            o.put("model", Build.MANUFACTURER + " " + Build.MODEL);
            o.put("android", Build.VERSION.RELEASE);
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("isDefaultLauncher", isDefaultLauncher());
            o.put("canInstall", a.getPackageManager().canRequestPackageInstalls());
            o.put("canOverlay", Settings.canDrawOverlays(a));
            o.put("notify", Build.VERSION.SDK_INT < 33 || a.checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED);
            o.put("lockscreen", p().getBoolean("lockscreen", false));
            o.put("autoCheck", p().getBoolean("autoCheck", true));
            o.put("autoInstall", p().getBoolean("autoInstall", false));
            o.put("hasToken", !p().getString("ghToken", "").isEmpty());
            o.put("repo", BuildConfig.UPDATE_REPO);
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    @JavascriptInterface public String battery() { return batteryJson(a); }

    public static String batteryJson(Context c) {
        try {
            Intent b = c.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            JSONObject o = new JSONObject();
            if (b != null) {
                int lv = b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1), sc = b.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
                int st = b.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                o.put("level", lv >= 0 ? Math.round(lv * 100f / sc) : -1);
                o.put("charging", st == BatteryManager.BATTERY_STATUS_CHARGING || st == BatteryManager.BATTERY_STATUS_FULL);
                o.put("plugged", b.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0);
                o.put("temp", b.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) / 10.0);
            }
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    @JavascriptInterface public String device() {
        try {
            JSONObject o = new JSONObject();
            StatFs fs = new StatFs(Environment.getDataDirectory().getPath());
            o.put("storageFree", fs.getAvailableBytes());
            o.put("storageTotal", fs.getTotalBytes());
            android.app.ActivityManager am = a.getSystemService(android.app.ActivityManager.class);
            android.app.ActivityManager.MemoryInfo mi = new android.app.ActivityManager.MemoryInfo();
            am.getMemoryInfo(mi);
            o.put("ramFree", mi.availMem); o.put("ramTotal", mi.totalMem);
            ConnectivityManager cm = a.getSystemService(ConnectivityManager.class);
            NetworkCapabilities nc = cm.getNetworkCapabilities(cm.getActiveNetwork());
            String net = "none";
            if (nc != null) {
                if (nc.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) net = "wifi";
                else if (nc.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) net = "cellular";
                else if (nc.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) net = "ethernet";
                else net = "other";
            }
            o.put("network", net);
            o.put("model", Build.MANUFACTURER + " " + Build.MODEL);
            o.put("android", Build.VERSION.RELEASE);
            o.put("uptime", android.os.SystemClock.elapsedRealtime());
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    // ───────── 앱 ─────────
    @JavascriptInterface public String apps() {
        PackageManager pm = a.getPackageManager();
        Intent q = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> list = pm.queryIntentActivities(q, 0);
        List<JSONObject> out = new ArrayList<>();
        for (ResolveInfo r : list) {
            String pkg = r.activityInfo.packageName;
            if (pkg.equals(a.getPackageName())) continue;
            try {
                JSONObject o = new JSONObject();
                o.put("pkg", pkg);
                o.put("label", r.loadLabel(pm).toString());
                o.put("system", (r.activityInfo.applicationInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0);
                o.put("cat", r.activityInfo.applicationInfo.category);
                out.add(o);
            } catch (Exception ignored) { }
        }
        Collections.sort(out, (x, y) -> x.optString("label").compareToIgnoreCase(y.optString("label")));
        JSONArray arr = new JSONArray();
        for (JSONObject o : out) arr.put(o);
        return arr.toString();
    }

    @JavascriptInterface public boolean launch(String pkg) {
        Intent i = a.getPackageManager().getLaunchIntentForPackage(pkg);
        if (i == null) return false;
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        a.runOnUiThread(() -> {
            try { a.startActivity(i); a.overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out); }
            catch (Exception ignored) { }
        });
        return true;
    }

    @JavascriptInterface public void openUrl(String url) { a.runOnUiThread(() -> WebHost.openExternal(a, url)); }

    @JavascriptInterface public void appInfo(String pkg) {
        start(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg)));
    }

    /** 앱 제거: 시스템 제거 확인창 (REQUEST_DELETE_PACKAGES 필요). 시스템 앱 등 막히면 앱 정보 화면으로 */
    @JavascriptInterface public void uninstall(String pkg) {
        a.runOnUiThread(() -> {
            try {
                Intent i = new Intent(Intent.ACTION_DELETE, Uri.parse("package:" + pkg)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                i.putExtra(Intent.EXTRA_RETURN_RESULT, false);
                a.startActivity(i);
            } catch (Exception e) {
                try { a.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
            }
        });
    }

    /** 알림창 내리기 */
    @SuppressWarnings({"WrongConstant", "JavaReflectionMemberAccess"})
    @JavascriptInterface public void notifications() {
        try {
            Object sb = a.getSystemService("statusbar");
            Class.forName("android.app.StatusBarManager").getMethod("expandNotificationsPanel").invoke(sb);
        } catch (Exception ignored) { }
    }

    // ───────── 시스템 설정 바로가기 ─────────
    @JavascriptInterface public void openSettings(String which) {
        Intent i;
        switch (which) {
            case "home": i = new Intent(Settings.ACTION_HOME_SETTINGS); break;
            case "install": i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + a.getPackageName())); break;
            case "overlay": i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + a.getPackageName())); break;
            case "notify":
                if (Build.VERSION.SDK_INT >= 33) { a.runOnUiThread(() -> a.requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 7)); return; }
                i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, a.getPackageName()); break;
            case "wifi": i = new Intent(Settings.ACTION_WIFI_SETTINGS); break;
            case "bluetooth": i = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS); break;
            case "display": i = new Intent(Settings.ACTION_DISPLAY_SETTINGS); break;
            case "sound": i = new Intent(Settings.ACTION_SOUND_SETTINGS); break;
            case "battery": i = new Intent(Intent.ACTION_POWER_USAGE_SUMMARY); break;
            case "storage": i = new Intent(Settings.ACTION_INTERNAL_STORAGE_SETTINGS); break;
            case "wallpaper": i = new Intent(Intent.ACTION_SET_WALLPAPER); break;
            case "security": i = new Intent(Settings.ACTION_SECURITY_SETTINGS); break;
            default: i = new Intent(Settings.ACTION_SETTINGS);
        }
        start(i);
    }

    private void start(Intent i) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        a.runOnUiThread(() -> { try { a.startActivity(i); } catch (Exception e) { try { a.startActivity(new Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { } } });
    }

    public boolean isDefaultLauncher() {
        Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        ResolveInfo r = a.getPackageManager().resolveActivity(home, PackageManager.MATCH_DEFAULT_ONLY);
        return r != null && r.activityInfo != null && a.getPackageName().equals(r.activityInfo.packageName);
    }

    // ───────── 설정값 ─────────
    @JavascriptInterface public String getPref(String k) { return String.valueOf(p().getAll().get(k)); }
    @JavascriptInterface public void setBool(String k, boolean v) {
        p().edit().putBoolean(k, v).apply();
    }
    @JavascriptInterface public void clearPref(String k) { p().edit().remove(k).apply(); }
    @JavascriptInterface public void setToken(String t) { p().edit().putString("ghToken", t == null ? "" : t.trim()).apply(); }

    // ───────── 업데이트 ─────────
    @JavascriptInterface public void checkUpdate() { Updater.check(a, true); }
    @JavascriptInterface public void installUpdate() { Updater.downloadAndInstall(a); }
    @JavascriptInterface public String pendingUpdate() { return Updater.pendingJson(a); }

    // ───────── 화면 ─────────
    @JavascriptInterface public void setBars(boolean show) {
        a.runOnUiThread(() -> { if (a instanceof MainActivity) ((MainActivity) a).setBars(show); });
    }
    @JavascriptInterface public boolean isLocked() {
        KeyguardManager km = a.getSystemService(KeyguardManager.class);
        return km != null && km.isKeyguardLocked();
    }

    // ───────── 잠금 화면 ─────────
    @JavascriptInterface public void unlock() {
        a.runOnUiThread(() -> {
            KeyguardManager km = a.getSystemService(KeyguardManager.class);
            if (km != null && km.isKeyguardLocked()) {
                km.requestDismissKeyguard(a, new KeyguardManager.KeyguardDismissCallback() {
                    @Override public void onDismissSucceeded() { a.finish(); }
                });
            } else a.finish();
        });
    }

    /** 부팅 연출을 다시 보고 싶을 때 (설정 → 미리 보기) */

    @JavascriptInterface public void toast(String msg) {
        a.runOnUiThread(() -> android.widget.Toast.makeText(a, msg, android.widget.Toast.LENGTH_SHORT).show());
    }

    @JavascriptInterface public void openSelfInfo() {
        start(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + a.getPackageName())));
    }

    // ───────── 런처 기능 (One UI 홈처럼) ─────────
    /** 문자열 설정 (홈 배치 백업 등) */
    @JavascriptInterface public void setStr(String k, String v) { p().edit().putString("s_" + k, v).apply(); }
    @JavascriptInterface public String getStr(String k) { return p().getString("s_" + k, ""); }

    /** 앱 바로가기 (길게 누르기 메뉴) — 기본 홈 앱일 때만 시스템이 허락한다 */
    @JavascriptInterface public String shortcuts(String pkg) {
        JSONArray arr = new JSONArray();
        try {
            android.content.pm.LauncherApps la = (android.content.pm.LauncherApps) a.getSystemService(Context.LAUNCHER_APPS_SERVICE);
            if (la == null || !la.hasShortcutHostPermission()) return arr.toString();
            android.content.pm.LauncherApps.ShortcutQuery q = new android.content.pm.LauncherApps.ShortcutQuery();
            q.setPackage(pkg);
            q.setQueryFlags(android.content.pm.LauncherApps.ShortcutQuery.FLAG_MATCH_DYNAMIC
                | android.content.pm.LauncherApps.ShortcutQuery.FLAG_MATCH_MANIFEST
                | android.content.pm.LauncherApps.ShortcutQuery.FLAG_MATCH_PINNED);
            List<android.content.pm.ShortcutInfo> list = la.getShortcuts(q, android.os.Process.myUserHandle());
            if (list != null) for (android.content.pm.ShortcutInfo si : list) {
                if (!si.isEnabled()) continue;
                JSONObject o = new JSONObject();
                o.put("id", si.getId());
                CharSequence l = si.getShortLabel(); if (l == null) l = si.getLongLabel();
                o.put("label", l == null ? si.getId() : l.toString());
                arr.put(o);
                if (arr.length() >= 5) break;
            }
        } catch (Exception ignored) { }
        return arr.toString();
    }
    @JavascriptInterface public boolean startShortcut(String pkg, String id) {
        try {
            android.content.pm.LauncherApps la = (android.content.pm.LauncherApps) a.getSystemService(Context.LAUNCHER_APPS_SERVICE);
            a.runOnUiThread(() -> { try { la.startShortcut(pkg, id, null, null, android.os.Process.myUserHandle()); } catch (Exception ignored) { } });
            return true;
        } catch (Exception e) { return false; }
    }

    /** 아이콘 팩: 목록 · 고르기 (빈 문자열 = 시스템 아이콘) */
    @JavascriptInterface public String iconPacks() { return IconPacks.list(a); }
    @JavascriptInterface public void setIconPack(String pkg) { p().edit().putString("iconPack", pkg == null ? "" : pkg).apply(); IconPacks.reset(); }
    @JavascriptInterface public String iconPack() { return p().getString("iconPack", ""); }

    /** 글자를 클립보드로 (오류 기록 복사 등) */
    @JavascriptInterface public void copy(String text) {
        a.runOnUiThread(() -> {
            android.content.ClipboardManager cm = (android.content.ClipboardManager) a.getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(android.content.ClipData.newPlainText("싯딤의 상자", text));
        });
    }
    /** 다운로드 폴더에 파일 저장 (설정 백업) → 저장한 위치 */
    @JavascriptInterface public String saveFile(String name, String text) {
        try {
            byte[] bytes = text.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            if (Build.VERSION.SDK_INT >= 29) {
                android.content.ContentValues v = new android.content.ContentValues();
                v.put(android.provider.MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(android.provider.MediaStore.Downloads.MIME_TYPE, "application/json");
                v.put(android.provider.MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/ShittimChest");
                Uri u = a.getContentResolver().insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                try (java.io.OutputStream o = a.getContentResolver().openOutputStream(u)) { o.write(bytes); }
                return "다운로드/ShittimChest/" + name;
            }
            java.io.File dir = a.getExternalFilesDir(null); java.io.File f = new java.io.File(dir, name);
            try (java.io.FileOutputStream o = new java.io.FileOutputStream(f)) { o.write(bytes); }
            return f.getAbsolutePath();
        } catch (Exception e) { return "ERR:" + e.getMessage(); }
    }
    /** 앱 설정(SharedPreferences) 전체 — 백업용 (토큰 같은 비밀 값은 뺀다) */
    @JavascriptInterface public String prefsDump() {
        JSONObject o = new JSONObject();
        try { for (java.util.Map.Entry<String, ?> e : p().getAll().entrySet()) { if (e.getKey().toLowerCase().contains("token")) continue; o.put(e.getKey(), e.getValue()); } } catch (Exception ignored) { }
        return o.toString();
    }
    @JavascriptInterface public void prefsLoad(String json) {
        try {
            JSONObject o = new JSONObject(json); SharedPreferences.Editor ed = p().edit();
            for (java.util.Iterator<String> it = o.keys(); it.hasNext(); ) {
                String k = it.next(); Object v = o.get(k);
                if (k.toLowerCase().contains("token") || k.equals("bootCount") || k.equals("bootAt")) continue;
                if (v instanceof Boolean) ed.putBoolean(k, (Boolean) v); else if (v instanceof Integer) ed.putInt(k, (Integer) v);
                else if (v instanceof Long) ed.putLong(k, (Long) v); else ed.putString(k, String.valueOf(v));
            }
            ed.apply();
        } catch (Exception ignored) { }
    }

    /** 부팅 연출이 화면에 떴다 → 네이티브 덮개 걷기 */

    // ───────── 기기 배경화면을 싯딤 배경과 같게 (최근 앱 화면 · 잠금 화면 뒤에도 같은 그림) ─────────
    /** path: 앱 안 그림 경로 (예: assets/cg/BG_AronaRoom.jpg). lock: 잠금 화면 배경도 */
    @JavascriptInterface public void setWallpaper(String path, boolean lock) {
        new Thread(() -> {
            try (java.io.InputStream in = a.getAssets().open(path)) {
                android.app.WallpaperManager wm = android.app.WallpaperManager.getInstance(a);
                int which = android.app.WallpaperManager.FLAG_SYSTEM | (lock ? android.app.WallpaperManager.FLAG_LOCK : 0);
                wm.setStream(in, null, true, which);
                emit("wallpaperSet", JSONObject.quote(path));
            } catch (Exception e) { emit("wallpaperError", JSONObject.quote(String.valueOf(e.getMessage()))); }
        }).start();
    }

    // ───────── 기존 홈 앱(One UI 홈 · Launcher3)의 배치 불러오기 ─────────
    // 런처의 favorites 표: container -100 = 홈 화면, -101 = 독(핫시트), -102 = 앱스 화면(삼성), 그 밖의 숫자 = 폴더 _id
    // itemType 0 = 앱, 1 = 바로가기, 2 = 폴더, 4 = 위젯, 6 = 앱 바로가기(딥 숏컷)
    private static final String[][] LAUNCHERS = {
        {"com.sec.android.app.launcher.settings", "com.sec.android.app.launcher.permission.READ_SETTINGS", "One UI 홈"},
        {"com.android.launcher3.settings", "com.android.launcher3.permission.READ_SETTINGS", "Launcher3"},
        {"com.google.android.apps.nexuslauncher.settings", "com.google.android.apps.nexuslauncher.permission.READ_SETTINGS", "Pixel 런처"},
        {"com.android.launcher2.settings", "com.android.launcher.permission.READ_SETTINGS", "안드로이드 런처"},
    };
    @JavascriptInterface public String importLayout() {
        JSONObject out = new JSONObject();
        JSONArray tried = new JSONArray();
        android.content.ContentResolver cr = a.getContentResolver();
        for (String[] L : LAUNCHERS) {
            JSONObject t = new JSONObject();
            try {
                t.put("name", L[2]);
                android.content.pm.ProviderInfo pi = a.getPackageManager().resolveContentProvider(L[0], 0);
                if (pi == null) { t.put("result", "없음"); tried.put(t); continue; }
                t.put("granted", a.checkSelfPermission(L[1]) == PackageManager.PERMISSION_GRANTED);
                for (String table : new String[]{"favorites", "appOrder"}) {
                    android.database.Cursor c = null;
                    try {
                        c = cr.query(Uri.parse("content://" + L[0] + "/" + table), null, null, null, null);
                        if (c == null) continue;
                        JSONArray rows = new JSONArray();
                        String[] cols = c.getColumnNames();
                        while (c.moveToNext()) {
                            JSONObject r = new JSONObject();
                            for (int k = 0; k < cols.length; k++) {
                                int ty = c.getType(k);
                                if (ty == android.database.Cursor.FIELD_TYPE_INTEGER) r.put(cols[k], c.getLong(k));
                                else if (ty == android.database.Cursor.FIELD_TYPE_STRING) r.put(cols[k], c.getString(k));
                            }
                            String in = r.optString("intent", "");
                            if (!in.isEmpty()) try {
                                Intent it = Intent.parseUri(in, 0);
                                String pk = it.getComponent() != null ? it.getComponent().getPackageName() : it.getPackage();
                                if (pk != null) r.put("pkg", pk);
                            } catch (Exception ignored) { }
                            r.remove("icon");
                            rows.put(r);
                        }
                        out.put(table, rows);
                    } catch (SecurityException se) { t.put("result", "권한 없음"); }
                    catch (Exception e) { if (!t.has("result")) t.put("result", e.getClass().getSimpleName()); }
                    finally { if (c != null) c.close(); }
                }
                if (out.has("favorites")) { out.put("source", L[2]); t.put("result", "성공"); tried.put(t); break; }
                tried.put(t);
            } catch (Exception ignored) { }
        }
        try { out.put("tried", tried); } catch (Exception ignored) { }
        return out.toString();
    }

    @SuppressWarnings("unused")
    private static ComponentName self(Context c) { return new ComponentName(c, MainActivity.class); }
}
