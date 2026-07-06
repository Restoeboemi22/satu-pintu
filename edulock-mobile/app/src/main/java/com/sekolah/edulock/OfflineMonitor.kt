package com.sekolah.edulock

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build

class OfflineMonitor(private val context: Context, private val prefsManager: PreferencesManager) {

    // Threshold 20 menit dalam milidetik
    private val OFFLINE_THRESHOLD_MS = 20 * 60 * 1000L
    // Warning di menit ke-15
    private val WARNING_THRESHOLD_MS = 15 * 60 * 1000L

    fun checkInternetAndTrack(onWarningTriggered: (Long) -> Unit, onLockdownTriggered: () -> Unit) {
        if (isInternetAvailable()) {
            // Jika online, reset timestamp dan akumulasi
            prefsManager.lastOnlineTimestamp = System.currentTimeMillis()
            prefsManager.offlineDurationAccumulated = 0
        } else {
            // Jika offline, hitung durasi
            val lastOnline = prefsManager.lastOnlineTimestamp
            val currentTime = System.currentTimeMillis()
            val currentOfflineDuration = currentTime - lastOnline
            
            // Cek apakah sudah melebihi batas waktu
            if (currentOfflineDuration > OFFLINE_THRESHOLD_MS) {
                onLockdownTriggered()
            } else if (currentOfflineDuration > WARNING_THRESHOLD_MS) {
                // Hitung sisa waktu dalam detik
                val remainingMs = OFFLINE_THRESHOLD_MS - currentOfflineDuration
                onWarningTriggered(remainingMs)
            }
        }
    }

    fun getOfflineDuration(): Long {
        if (isInternetAvailable()) return 0
        return System.currentTimeMillis() - prefsManager.lastOnlineTimestamp
    }

    fun isInternetAvailable(): Boolean {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = connectivityManager.activeNetwork ?: return false
            val activeNetwork = connectivityManager.getNetworkCapabilities(network) ?: return false
            return when {
                activeNetwork.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> true
                activeNetwork.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> true
                activeNetwork.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> true
                else -> false
            }
        } else {
            val networkInfo = connectivityManager.activeNetworkInfo ?: return false
            return networkInfo.isConnected
        }
    }
}