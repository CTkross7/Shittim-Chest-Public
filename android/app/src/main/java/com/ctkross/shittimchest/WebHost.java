package com.ctkross.shittimchest;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.URISyntaxException;

/**
 * WebView 공통 설정.
 *  https://appassets.androidplatform.net/assets/...  → APK 안의 app/ 폴더 (오프라인)
 *  https://appassets.androidplatform.net/icon/<패키지>  → 설치된 앱 아이콘 PNG
 */
public final class WebHost {
    public static final String BASE = "https://appassets.androidplatform.net/assets/index.html";

    private WebHost() { }

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    static final int FILE_REQ = 4242;
    private static android.webkit.ValueCallback<Uri[]> fileCb;
    /** 파일 선택 결과 → 페이지 (MainActivity.onActivityResult 에서 부른다) */
    static boolean onFileResult(int req, int code, Intent data) {
        if (req != FILE_REQ || fileCb == null) return false;
        fileCb.onReceiveValue(android.webkit.WebChromeClient.FileChooserParams.parseResult(code, data));
        fileCb = null; return true;
    }

    public static WebView create(Activity a, Bridge bridge) {
        WebView web = new WebView(a);
        web.setBackgroundColor(0xFF000000);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);   // 부팅 연출의 효과음·BGM 자동 재생
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setLongClickable(false);
        web.setOnLongClickListener(v -> true);           // 길게 누르기 메뉴 없음
        web.setHapticFeedbackEnabled(false);

        // <input type="file"> (아이콘용 갤러리 이미지 · 백업 파일 가져오기) — 안드로이드 파일 선택 창을 띄운다
        web.setWebChromeClient(new android.webkit.WebChromeClient() {
            // 페이지의 confirm() / alert(): 기본은 창 없이 '취소'가 되므로 직접 띄운다 (백업 복원 · 모모톡 초기화 등)
            @Override public boolean onJsConfirm(WebView v, String url, String msg, android.webkit.JsResult r) {
                try {
                    new android.app.AlertDialog.Builder(v.getContext()).setMessage(msg)
                        .setPositiveButton("확인", (d, w) -> r.confirm()).setNegativeButton("취소", (d, w) -> r.cancel())
                        .setOnCancelListener((d) -> r.cancel()).show();
                } catch (Exception e) { r.cancel(); }
                return true;
            }
            @Override public boolean onJsAlert(WebView v, String url, String msg, android.webkit.JsResult r) {
                try {
                    new android.app.AlertDialog.Builder(v.getContext()).setMessage(msg)
                        .setPositiveButton("확인", (d, w) -> r.confirm()).setOnCancelListener((d) -> r.confirm()).show();
                } catch (Exception e) { r.confirm(); }
                return true;
            }
            @Override public boolean onShowFileChooser(WebView v, android.webkit.ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try { a.startActivityForResult(p.createIntent(), FILE_REQ); }
                catch (Exception e) { fileCb = null; cb.onReceiveValue(null); return false; }
                return true;
            }
        });

        PackageManager pm = a.getPackageManager();

        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (!"appassets.androidplatform.net".equals(u.getHost())) return null;
                String path = u.getPath() == null ? "" : u.getPath();
                if (path.startsWith("/icon/")) return iconResponse(a, path.substring(6));
                if (path.startsWith("/assets/")) return asset(a, path.substring(8));
                return null;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                openExternal(a, u.toString());
                return true;
            }
        });
        web.addJavascriptInterface(bridge, "ShittimNative");
        return web;
    }

    /** 웹 주소·intent:// 주소를 바깥 앱으로 연다 */
    public static void openExternal(Activity a, String url) {
        try {
            Intent i = url.startsWith("intent:") ? Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                    : new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            a.startActivity(i);
        } catch (URISyntaxException | ActivityNotFoundException | SecurityException e) {
            // 열 수 없는 주소
        }
    }

    private static final java.util.Map<String, String> MIME = new java.util.HashMap<>();
    static {
        String[][] m = {{"html", "text/html"}, {"js", "text/javascript"}, {"css", "text/css"}, {"json", "application/json"},
                {"webmanifest", "application/manifest+json"}, {"png", "image/png"}, {"jpg", "image/jpeg"}, {"jpeg", "image/jpeg"},
                {"svg", "image/svg+xml"}, {"webp", "image/webp"}, {"gif", "image/gif"}, {"ogg", "audio/ogg"}, {"wav", "audio/wav"},
                {"mp3", "audio/mpeg"}, {"woff2", "font/woff2"}, {"woff", "font/woff"}, {"ttf", "font/ttf"}, {"otf", "font/otf"},
                {"txt", "text/plain"}, {"atlas", "text/plain"}, {"skel", "application/octet-stream"}};
        for (String[] e : m) MIME.put(e[0], e[1]);
    }

    /** APK 안의 app/ 파일 (assets/) */
    private static WebResourceResponse asset(Activity a, String path) {
        if (path.isEmpty() || path.endsWith("/")) path += "index.html";
        String ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase(java.util.Locale.ROOT);
        String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";
        try {
            java.io.InputStream in = a.getAssets().open(path);
            boolean text = mime.startsWith("text/") || mime.contains("json") || mime.contains("svg");
            WebResourceResponse res = new WebResourceResponse(mime, text ? "UTF-8" : null, in);
            java.util.Map<String, String> h = new java.util.HashMap<>();
            h.put("Access-Control-Allow-Origin", "*");
            res.setResponseHeaders(h);
            return res;
        } catch (java.io.IOException e) {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
        }
    }

    private static WebResourceResponse iconResponse(Activity a, String path) {
        String pkg = path.replace(".png", "");
        try {
            // 고른 아이콘 팩 → 없으면 런처용 시스템 아이콘 (기기 아이콘 테마 반영)
            Drawable d = IconPacks.icon(a, ShittimApp.prefs(a).getString("iconPack", ""), pkg);
            if (d == null) return null;
            Bitmap b;
            if (d instanceof BitmapDrawable && ((BitmapDrawable) d).getBitmap() != null) b = ((BitmapDrawable) d).getBitmap();
            else {
                int w = Math.max(1, Math.min(192, d.getIntrinsicWidth() > 0 ? d.getIntrinsicWidth() : 192));
                b = Bitmap.createBitmap(w, w, Bitmap.Config.ARGB_8888);
                Canvas c = new Canvas(b); d.setBounds(0, 0, w, w); d.draw(c);
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            b.compress(Bitmap.CompressFormat.PNG, 100, out);
            WebResourceResponse res = new WebResourceResponse("image/png", null, new ByteArrayInputStream(out.toByteArray()));
            java.util.Map<String, String> h = new java.util.HashMap<>();
            h.put("Cache-Control", "max-age=86400");
            res.setResponseHeaders(h);
            return res;
        } catch (Exception e) {
            return null;
        }
    }

    /** 상태바·내비게이션바 보이기 (내용은 그 뒤까지 그린다 — 투명 바) */
    public static void showBars(Activity a) {
        if (Build.VERSION.SDK_INT >= 30) {
            a.getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = a.getWindow().getInsetsController();
            if (c != null) c.show(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
        } else {
            a.getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
        a.getWindow().getDecorView().requestApplyInsets();
    }

    /** 상태바·내비게이션바 숨김 (스와이프하면 잠깐 보임) */
    public static void immersive(Activity a) {
        View d = a.getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= 30) {
            a.getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = a.getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }
}
