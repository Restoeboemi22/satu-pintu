package com.sekolah.edulock

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class ServiceRestarter : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.d("ServiceRestarter", "Restarting MonitoringService...")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(Intent(context, MonitoringService::class.java))
        } else {
            context.startService(Intent(context, MonitoringService::class.java))
        }
    }
}
