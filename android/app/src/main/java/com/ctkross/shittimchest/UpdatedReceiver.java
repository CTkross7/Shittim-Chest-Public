package com.ctkross.shittimchest;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 앱 업데이트 완료 알림 */
public class UpdatedReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        String act = i.getAction();
        if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(act)) {
            ShittimApp.prefs(c).edit().putString("justUpdated", BuildConfig.VERSION_NAME).remove("pending").apply();
            PendingIntent pi = PendingIntent.getActivity(c, 2, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
            c.getSystemService(NotificationManager.class).notify(2, new android.app.Notification.Builder(c, ShittimApp.CH_UPDATE)
                    .setSmallIcon(android.R.drawable.stat_sys_download_done)
                    .setContentTitle("[Unofficial] 싯딤의 상자 업데이트 완료")
                    .setContentText("v" + BuildConfig.VERSION_NAME + " 으로 업데이트되었어요, 선생님!")
                    .setContentIntent(pi).setAutoCancel(true).build());
        }
    }
}
