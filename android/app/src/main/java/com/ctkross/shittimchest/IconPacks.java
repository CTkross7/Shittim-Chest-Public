package com.ctkross.shittimchest;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.LauncherActivityInfo;
import android.content.pm.LauncherApps;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.res.Resources;
import android.graphics.drawable.Drawable;
import android.os.Process;

import org.json.JSONArray;
import org.json.JSONObject;
import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserFactory;

import java.io.InputStream;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 아이콘 팩(노바 · ADW · Apex 등 런처용 아이콘 팩 앱)과 시스템 아이콘.
 * - 아이콘 팩: 팩 앱의 appfilter.xml 에서 "ComponentInfo{패키지/액티비티}" → 그림 이름을 찾는다.
 * - 팩을 고르지 않았거나 팩에 없는 앱: 런처가 쓰는 방식(LauncherApps)으로 시스템 아이콘을 받는다
 *   — 기기의 테마 · 아이콘 설정이 런처 쪽에도 적용되는 경로.
 */
final class IconPacks {
    private static final String[] PACK_ACTIONS = {
        "org.adw.launcher.THEMES", "com.novalauncher.THEME", "com.teslacoilsw.launcher.THEME",
        "com.gau.go.launcherex.theme", "com.anddoes.launcher.THEME", "com.fede.launcher.THEME_ICONPACK",
    };
    private static String loaded;                          // 지금 읽어 둔 팩
    private static Map<String, String> map = new HashMap<>();
    private static Resources packRes;

    /** 설치된 아이콘 팩 목록 */
    static String list(Context c) {
        PackageManager pm = c.getPackageManager();
        Set<String> seen = new HashSet<>();
        JSONArray arr = new JSONArray();
        for (String act : PACK_ACTIONS) {
            for (ResolveInfo r : pm.queryIntentActivities(new Intent(act), PackageManager.GET_META_DATA)) {
                String p = r.activityInfo.packageName;
                if (!seen.add(p)) continue;
                try { arr.put(new JSONObject().put("pkg", p).put("label", r.loadLabel(pm).toString())); } catch (Exception ignored) { }
            }
        }
        return arr.toString();
    }

    private static synchronized void load(Context c, String pack) {
        if (pack.equals(loaded)) return;
        map = new HashMap<>(); packRes = null; loaded = pack;
        try {
            packRes = c.getPackageManager().getResourcesForApplication(pack);
            XmlPullParser x = null; InputStream in = null;
            int id = packRes.getIdentifier("appfilter", "xml", pack);
            if (id != 0) x = packRes.getXml(id);
            else {
                in = packRes.getAssets().open("appfilter.xml");
                x = XmlPullParserFactory.newInstance().newPullParser(); x.setInput(in, "utf-8");
            }
            for (int ev = x.getEventType(); ev != XmlPullParser.END_DOCUMENT; ev = x.next()) {
                if (ev != XmlPullParser.START_TAG || !"item".equals(x.getName())) continue;
                String comp = x.getAttributeValue(null, "component"), dr = x.getAttributeValue(null, "drawable");
                if (comp == null || dr == null) continue;
                // ComponentInfo{com.app/com.app.Main} → com.app/com.app.Main
                String k = comp.replace("ComponentInfo{", "").replace("}", "").trim();
                map.put(k, dr);
                int s = k.indexOf('/'); if (s > 0 && !map.containsKey(k.substring(0, s))) map.put(k.substring(0, s), dr);   // 패키지만으로도 찾게
            }
            if (in != null) in.close();
        } catch (Exception ignored) { }
    }

    /** pkg 의 아이콘 (pack 이 비었으면 시스템 아이콘) */
    static Drawable icon(Context c, String pack, String pkg) {
        ComponentName cn = null; LauncherActivityInfo info = null;
        try {
            LauncherApps la = (LauncherApps) c.getSystemService(Context.LAUNCHER_APPS_SERVICE);
            List<LauncherActivityInfo> l = la.getActivityList(pkg, Process.myUserHandle());
            if (l != null && !l.isEmpty()) { info = l.get(0); cn = info.getComponentName(); }
        } catch (Exception ignored) { }
        if (pack != null && !pack.isEmpty()) {
            load(c, pack);
            String dr = null;
            if (cn != null) dr = map.get(cn.getPackageName() + "/" + cn.getClassName());
            if (dr == null) dr = map.get(pkg);
            if (dr != null && packRes != null) {
                int id = packRes.getIdentifier(dr, "drawable", pack);
                if (id == 0) id = packRes.getIdentifier(dr, "mipmap", pack);
                if (id != 0) try { return packRes.getDrawable(id, null); } catch (Exception ignored) { }
            }
        }
        if (info != null) try { return info.getIcon(c.getResources().getDisplayMetrics().densityDpi); } catch (Exception ignored) { }
        try { return c.getPackageManager().getApplicationIcon(pkg); } catch (Exception e) { return null; }
    }

    static void reset() { loaded = null; }
}
