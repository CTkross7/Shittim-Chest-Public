package com.ctkross.shittimchest;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

/**
 * 앱 전체 상태.
 * - 설정값(SharedPreferences)
 * - 몇 시간마다 새 버전 확인
 */
public class ShittimApp extends Application {
    public static final String CH_UPDATE = "update";
    private static ShittimApp self;
    private final Handler main = new Handler(Looper.getMainLooper());

    public static ShittimApp get() { return self; }

    public static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("shittim", MODE_PRIVATE);
    }

    @Override public void onCreate() {
        super.onCreate();
        self = this;
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel ch = new NotificationChannel(CH_UPDATE, "업데이트", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("[Unofficial] 싯딤의 상자 새 버전 알림");
        nm.createNotificationChannel(ch);


        scheduleUpdateCheck(60_000);
    }

    /** 자동 업데이트 확인: 켜져 있으면 3시간마다 */
    public void scheduleUpdateCheck(long delay) {
        main.postDelayed(() -> {
            if (prefs(this).getBoolean("autoCheck", true)) Updater.check(this, false);
            scheduleUpdateCheck(3 * 60 * 60 * 1000L);
        }, delay);
    }
}
