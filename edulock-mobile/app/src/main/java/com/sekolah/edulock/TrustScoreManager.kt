package com.sekolah.edulock

import android.content.Context
import java.util.Calendar

class TrustScoreManager(private val context: Context, private val prefsManager: PreferencesManager) {

    // Logika sederhana: skor berkurang jika melanggar, bertambah jika patuh
    
    fun getTrustScore(): Int {
        return prefsManager.trustScore
    }
    
    fun decreaseScore(amount: Int) {
        var currentScore = prefsManager.trustScore
        currentScore -= amount
        if (currentScore < 0) currentScore = 0
        prefsManager.trustScore = currentScore
    }
    
    fun increaseScore(amount: Int) {
        var currentScore = prefsManager.trustScore
        currentScore += amount
        if (currentScore > 100) currentScore = 100
        prefsManager.trustScore = currentScore
    }

    /**
     * Mengecek apakah hari sudah berganti. Jika ya, berikan reward poin karena
     * berhasil melewati hari sebelumnya (asumsi sederhana).
     * Idealnya bisa dicek apakah kemarin ada pelanggaran atau tidak.
     */
    fun checkAndApplyDailyReward() {
        val calendar = Calendar.getInstance()
        // Set ke jam 00:00:00 hari ini
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        
        val todayStartMillis = calendar.timeInMillis
        val lastUpdate = prefsManager.lastDailyScoreUpdate
        
        // Jika terakhir update sebelum hari ini (artinya ini hari baru)
        if (lastUpdate < todayStartMillis) {
            // Berikan reward harian (+5 poin)
            increaseScore(5)
            
            // Reset violation streak karena hari baru (opsional, atau bisa di-reset hanya jika score 100)
            // Di sini kita reset agar siswa punya kesempatan memperbaiki diri
            prefsManager.violationStreak = 0
            
            // Simpan waktu update
            prefsManager.lastDailyScoreUpdate = System.currentTimeMillis()
        }
    }
    
    fun applyGraduatedPenalty() {
        val streak = prefsManager.violationStreak
        val penalty = when {
            streak == 0 -> 5
            streak == 1 -> 10
            streak == 2 -> 20
            else -> 30
        }
        decreaseScore(penalty)
        prefsManager.violationStreak = streak + 1
    }

    fun determineGracePeriod(): Long {
        val score = getTrustScore()
        return when {
            score >= 90 -> 15 * 60 * 1000L // 15 menit untuk user terpercaya
            score >= 70 -> 5 * 60 * 1000L  // 5 menit
            else -> 0L // Tidak ada toleransi
        }
    }
}