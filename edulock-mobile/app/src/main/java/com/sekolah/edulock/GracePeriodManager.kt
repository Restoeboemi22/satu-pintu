package com.sekolah.edulock

import android.content.Context

class GracePeriodManager(private val context: Context, private val prefsManager: PreferencesManager) {

    fun startGracePeriod(durationMs: Long) {
        val endTime = System.currentTimeMillis() + durationMs
        prefsManager.gracePeriodEndTime = endTime
    }
    
    fun isGracePeriodActive(): Boolean {
        val endTime = prefsManager.gracePeriodEndTime
        return System.currentTimeMillis() < endTime
    }
    
    fun getRemainingTime(): Long {
        val endTime = prefsManager.gracePeriodEndTime
        val remaining = endTime - System.currentTimeMillis()
        return if (remaining > 0) remaining else 0
    }
    
    fun resetGracePeriod() {
        prefsManager.gracePeriodEndTime = 0
    }
}
