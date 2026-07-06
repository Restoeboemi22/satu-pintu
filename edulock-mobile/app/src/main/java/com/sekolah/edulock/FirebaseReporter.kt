package com.sekolah.edulock

import android.content.Context
import android.util.Log
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ServerValue
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class FirebaseReporter(private val context: Context, private val prefsManager: PreferencesManager) {

    // Gunakan URL eksplisit (Asia Southeast 1) agar sinkron dengan Web Dashboard
    private val db = FirebaseDatabase.getInstance("https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app")
    private val studentsRef = db.getReference("students")
    private val presenceRef = db.getReference("presence")
    
    // Throttling variables
    private var lastReportTime: Long = 0
    private var lastReportedData: Map<String, Any?> = emptyMap()
    private val HEARTBEAT_INTERVAL = 5 * 60 * 1000L // 5 Menit Heartbeat (Wajib Lapor)
    private val MIN_UPDATE_INTERVAL = 30 * 1000L    // 30 Detik Min Jeda (Jika Data Berubah)

    fun sendStatusUpdate(
        latitude: Double?,
        longitude: Double?,
        isInsideZone: Boolean,
        trustScore: Int,
        isGpsActive: Boolean,
        isInternetActive: Boolean,
        statusMessage: String
    ) {
        val nisn = prefsManager.nisn
        val name = prefsManager.studentName
        val studentClass = prefsManager.studentClass
        val schoolId = prefsManager.schoolId.trim().lowercase()

        if (nisn.isEmpty()) return

        // Setup OnDisconnect Hook (Memastikan status Offline saat aplikasi mati/force close)
        // Kita set ini setiap update agar selalu aktif untuk session ini
        val studentNode = studentsRef.child(nisn)
        studentNode.child("deviceStatus").onDisconnect().setValue("Offline")
        studentNode.child("isInternetActive").onDisconnect().setValue(false)
        studentNode.child("statusMessage").onDisconnect().setValue("Offline / Disconnected")

        if (schoolId.isNotEmpty()) {
            val presenceNode = presenceRef.child(schoolId).child(nisn)
            presenceNode.child("deviceStatus").onDisconnect().setValue("Offline")
            presenceNode.child("isInternetActive").onDisconnect().setValue(false)
            presenceNode.child("statusMessage").onDisconnect().setValue("Offline / Disconnected")
        }

        // Data saat ini
        val currentData: Map<String, Any> = mapOf(
            "name" to name,
            "class" to studentClass,
            "latitude" to (latitude ?: 0.0),
            "longitude" to (longitude ?: 0.0),
            "isInsideZone" to isInsideZone,
            "trustScore" to trustScore,
            "isGpsActive" to isGpsActive,
            "isInternetActive" to isInternetActive,
            "statusMessage" to statusMessage,
            "deviceStatus" to "Online"
        )

        // THROTTLING CHECK:
        // Kirim update HANYA jika:
        // 1. Sudah waktunya heartbeat (> 5 menit) -> WAJIB KIRIM
        // 2. ATAU (Data Berubah DAN Sudah lewat jeda minimum 30 detik)
        
        val currentTime = System.currentTimeMillis()
        val timeSinceLastReport = currentTime - lastReportTime
        
        val isHeartbeatDue = timeSinceLastReport > HEARTBEAT_INTERVAL
        val isDataChanged = hasDataChanged(currentData)
        val isMinIntervalPassed = timeSinceLastReport > MIN_UPDATE_INTERVAL

        if (!isHeartbeatDue && !(isDataChanged && isMinIntervalPassed)) {
            // Skip update untuk menghemat kuota & koneksi Firebase
            return
        }

        // Tambahkan timestamp server saat kirim
        val updateData = currentData.toMutableMap()
        updateData["lastUpdated"] = ServerValue.TIMESTAMP

        studentNode.updateChildren(updateData)
            .addOnSuccessListener {
                // Update cache lokal setelah sukses kirim
                lastReportTime = currentTime
                lastReportedData = currentData
            }
            .addOnFailureListener {
                Log.e("FirebaseReporter", "Failed to update status: ${it.message}")
            }

        if (schoolId.isNotEmpty()) {
            val presenceData = currentData.toMutableMap()
            presenceData["nisn"] = nisn
            presenceData["schoolId"] = schoolId
            presenceData["lastUpdated"] = ServerValue.TIMESTAMP
            presenceRef.child(schoolId).child(nisn).updateChildren(presenceData)
        }
    }
    
    private fun hasDataChanged(newData: Map<String, Any?>): Boolean {
        // Cek field penting saja
        val keysToCheck = listOf(
            "latitude", "longitude", "isInsideZone", "trustScore", 
            "isGpsActive", "isInternetActive", "statusMessage", "deviceStatus"
        )
        
        for (key in keysToCheck) {
            if (newData[key] != lastReportedData[key]) {
                return true
            }
        }
        return false
    }

    fun reportOffline() {
        val nisn = prefsManager.nisn
        val schoolId = prefsManager.schoolId.trim().lowercase()
        if (nisn.isEmpty()) return

        val studentNode = studentsRef.child(nisn)
        val offlineData = mapOf(
            "deviceStatus" to "Offline",
            "isInternetActive" to false,
            "statusMessage" to "App Uninstalled / Stopped",
            "lastUpdated" to ServerValue.TIMESTAMP
        )
        
        studentNode.updateChildren(offlineData)
        if (schoolId.isNotEmpty()) {
            presenceRef.child(schoolId).child(nisn).updateChildren(offlineData)
        }
    }
}
