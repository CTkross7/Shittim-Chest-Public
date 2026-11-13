package com.ctkross.shittimchest;

import android.app.Activity;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 자동 업데이트 — GitHub Actions 가 main 에 커밋될 때마다 Release(build-N) 로 APK 를 올린다.
 * 1) releases/latest 확인 → build-N 이 지금 버전보다 크면 새 버전
 * 2) 알림 + 페이지 팝업 (자동 설치가 켜져 있으면 바로 받기)
 * 3) APK 받기 → PackageInstaller 로 설치 (설치 확인 창은 안드로이드가 띄운다)
 * 저장소가 비공개라 GitHub 토큰(읽기 전용)이 필요하다 — 설정에서 입력.
 */
public final class Updater {
    private static volatile boolean busy;

    private Updater() { }

    static void emit(String type, String msg) {
        MainActivity m = MainActivity.current();
        if (m == null) return;
        try { m.bridge().emit(type, msg == null ? "null" : (msg.startsWith("{") ? msg : JSONObject.quote(msg))); }
        catch (Exception ignored) { }
    }

    private static HttpURLConnection open(String url, String token, String accept) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000); c.setReadTimeout(30000);
        c.setRequestProperty("Accept", accept);
        c.setRequestProperty("User-Agent", "ShittimChest-Updater");
        c.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
        if (token != null && !token.isEmpty()) c.setRequestProperty("Authorization", "Bearer " + token);
        c.setInstanceFollowRedirects(false);
        return c;
    }

    private static String readAll(InputStream in) throws Exception {
        ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] b = new byte[8192]; int n;
        while ((n = in.read(b)) > 0) o.write(b, 0, n);
        return o.toString("UTF-8");
    }

    static int codeOf(String tag) {
        try { return Integer.parseInt(tag.replaceAll("\\D+", "")); } catch (Exception e) { return 0; }
    }

    public static String pendingJson(Context c) {
        return ShittimApp.prefs(c).getString("pending", "null");
    }

    /** 새 버전 확인. manual=true 면 결과(최신/오류)를 페이지에 알려 준다 */
    public static void check(Context ctx, boolean manual) {
        Context c = ctx.getApplicationContext();
        new Thread(() -> {
            SharedPreferences p = ShittimApp.prefs(c);
            String token = p.getString("ghToken", "");
            try {
                HttpURLConnection h = open("https://api.github.com/repos/" + BuildConfig.UPDATE_REPO + "/releases/latest", token, "application/vnd.github+json");
                int rc = h.getResponseCode();
                if (rc == 401 || rc == 403 || rc == 404) {
                    if (manual) emit("updateError", token.isEmpty()
                            ? "비공개 저장소라 GitHub 토큰이 필요해요. 설정 → 업데이트에서 입력해 주세요."
                            : "업데이트 정보를 볼 수 없어요 (" + rc + "). 토큰 권한을 확인해 주세요.");
                    return;
                }
                if (rc != 200) { if (manual) emit("updateError", "업데이트 서버 응답 " + rc); return; }
                JSONObject r = new JSONObject(readAll(h.getInputStream()));
                String tag = r.optString("tag_name");
                int code = codeOf(tag);
                JSONArray assets = r.optJSONArray("assets");
                JSONObject apk = null;
                for (int i = 0; assets != null && i < assets.length(); i++)
                    if (assets.getJSONObject(i).optString("name").endsWith(".apk")) apk = assets.getJSONObject(i);
                if (code <= BuildConfig.VERSION_CODE || apk == null) {
                    p.edit().remove("pending").apply();
                    if (manual) emit("updateNone", "{\"version\":" + JSONObject.quote(BuildConfig.VERSION_NAME) + "}");
                    return;
                }
                JSONObject info = new JSONObject();
                info.put("tag", tag); info.put("code", code);
                info.put("version", "1.0." + code);
                info.put("notes", r.optString("body"));
                info.put("published", r.optString("published_at"));
                info.put("asset", apk.optString("url"));
                info.put("size", apk.optLong("size"));
                String prev = p.getString("pending", "");
                p.edit().putString("pending", info.toString()).apply();
                emit("update", info.toString());
                if (!prev.contains("\"code\":" + code)) notifyUpdate(c, info);
                if (p.getBoolean("autoInstall", false)) downloadAndInstall(c);
            } catch (Exception e) {
                if (manual) emit("updateError", "인터넷 연결을 확인해 주세요. (" + e.getClass().getSimpleName() + ")");
            }
        }).start();
    }

    private static void notifyUpdate(Context c, JSONObject info) {
        Intent open = new Intent(c, MainActivity.class).putExtra("showUpdate", true).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pi = PendingIntent.getActivity(c, 1, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        c.getSystemService(NotificationManager.class).notify(1, new android.app.Notification.Builder(c, ShittimApp.CH_UPDATE)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle("[Unofficial] 싯딤의 상자 새 버전 v" + info.optString("version"))
                .setContentText("선생님, 새 업데이트가 도착했어요! 눌러서 설치하기")
                .setStyle(new android.app.Notification.BigTextStyle().bigText(info.optString("notes")))
                .setContentIntent(pi).setAutoCancel(true).build());
    }

    /** 받기 + 설치 */
    public static void downloadAndInstall(Context ctx) {
        Context c = ctx.getApplicationContext();
        if (busy) return;
        if (!c.getPackageManager().canRequestPackageInstalls()) {
            emit("updateError", "먼저 '이 출처의 앱 설치 허용'을 켜 주세요. 설정 화면을 열게요.");
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, android.net.Uri.parse("package:" + c.getPackageName()))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try { c.startActivity(i); } catch (Exception ignored) { }
            return;
        }
        busy = true;
        new Thread(() -> {
            try {
                JSONObject info = new JSONObject(pendingJson(c));
                String token = ShittimApp.prefs(c).getString("ghToken", "");
                // 1) 자산 API → S3 로 리디렉트 (S3 에는 토큰을 보내지 않는다)
                HttpURLConnection h = open(info.getString("asset"), token, "application/octet-stream");
                int rc = h.getResponseCode();
                if (rc / 100 == 3) {
                    String loc = h.getHeaderField("Location");
                    h.disconnect();
                    h = (HttpURLConnection) new URL(loc).openConnection();
                    h.setConnectTimeout(15000); h.setReadTimeout(60000);
                    rc = h.getResponseCode();
                }
                if (rc != 200) throw new Exception("HTTP " + rc);
                long total = h.getContentLengthLong() > 0 ? h.getContentLengthLong() : info.optLong("size", 1);
                File f = new File(c.getCacheDir(), "update.apk");
                try (InputStream in = h.getInputStream(); OutputStream out = new FileOutputStream(f)) {
                    byte[] b = new byte[64 * 1024]; long got = 0; int n, last = -1;
                    while ((n = in.read(b)) > 0) {
                        out.write(b, 0, n); got += n;
                        int pct = (int) (got * 100 / Math.max(1, total));
                        if (pct != last) { last = pct; emit("updateProgress", "{\"p\":" + pct + "}"); }
                    }
                }
                install(c, f);
            } catch (Exception e) {
                emit("updateError", "받지 못했어요: " + e.getMessage());
            } finally { busy = false; }
        }).start();
    }

    private static void install(Context c, File apk) throws Exception {
        PackageInstaller pi = c.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams sp = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        sp.setAppPackageName(c.getPackageName());
        if (android.os.Build.VERSION.SDK_INT >= 31) sp.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        int id = pi.createSession(sp);
        try (PackageInstaller.Session s = pi.openSession(id)) {
            try (InputStream in = new FileInputStream(apk); OutputStream out = s.openWrite("base.apk", 0, apk.length())) {
                byte[] b = new byte[64 * 1024]; int n;
                while ((n = in.read(b)) > 0) out.write(b, 0, n);
                s.fsync(out);
            }
            Intent done = new Intent(c, InstallReceiver.class);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            s.commit(PendingIntent.getBroadcast(c, id, done, flags).getIntentSender());
        }
        emit("updateInstalling", null);
    }

    @SuppressWarnings("unused")
    static void unused(Activity a) { }
}
