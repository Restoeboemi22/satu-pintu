package com.sekolah.edulock

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class ScreenReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // Hanya fokus restart service jika mati
        // Logika bisnis (Permission/Session) ditangani oleh MonitoringService
        if (intent.action == Intent.ACTION_USER_PRESENT || intent.action == Intent.ACTION_SCREEN_ON) {
            Log.d("ScreenReceiver", "User Present / Screen On. Ensuring Service is running.")
            
            val serviceIntent = Intent(context, MonitoringService::class.java)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
        }
    }
}
