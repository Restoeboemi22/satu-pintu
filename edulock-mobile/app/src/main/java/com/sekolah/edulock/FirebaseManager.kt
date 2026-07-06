package com.sekolah.edulock

import com.google.firebase.database.FirebaseDatabase
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class FirebaseManager private constructor() {

    // Gunakan URL eksplisit untuk memastikan koneksi ke server Asia Southeast 1
    private val database = FirebaseDatabase.getInstance("https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app")
    private val permissionsRef = database.getReference("permissions")
    private val violationsRef = database.getReference("violations")
    private val violationsBySchoolRef = database.getReference("violations_by_school")

    companion object {
        @Volatile
        private var instance: FirebaseManager? = null

        fun getInstance(): FirebaseManager {
            return instance ?: synchronized(this) {
                instance ?: FirebaseManager().also { instance = it }
            }
        }
    }

    /**
     * Mencatat log pemberian izin ke Firebase
     */
    fun logPermission(nisn: String, code: String, durationMinutes: Int) {
        val timestamp = System.currentTimeMillis()
        val date = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date(timestamp))

        val log = mapOf(
            "nisn" to nisn,
            "code" to code,
            "duration" to durationMinutes,
            "timestamp" to timestamp,
            "date" to date
        )

        permissionsRef.push().setValue(log)
    }

    /**
     * Mencatat log pelanggaran ke Firebase
     */
    fun logViolation(nisn: String, schoolId: String, violationType: String, description: String, lat: Double, lng: Double) {
        val timestamp = System.currentTimeMillis()
        val date = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date(timestamp))
        val normalizedSchoolId = schoolId.trim().lowercase()
        val violationId = violationsRef.push().key ?: return

        val log = mutableMapOf<String, Any>(
            "nisn" to nisn,
            "type" to violationType,
            "description" to description,
            "latitude" to lat,
            "longitude" to lng,
            "timestamp" to timestamp,
            "date" to date
        )
        if (normalizedSchoolId.isNotEmpty()) {
            log["schoolId"] = normalizedSchoolId
        }

        val updates = mutableMapOf<String, Any>(
            "/violations/$violationId" to log
        )
        if (normalizedSchoolId.isNotEmpty()) {
            updates["/violations_by_school/$normalizedSchoolId/$violationId"] = log
        }

        database.reference.updateChildren(updates)
    }
}
