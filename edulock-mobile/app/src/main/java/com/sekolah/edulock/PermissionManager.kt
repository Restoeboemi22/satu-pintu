package com.sekolah.edulock

import android.content.Context
import android.content.SharedPreferences
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener

class PermissionManager(private val context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(
        "EduLockPermissions", Context.MODE_PRIVATE
    )

    // Gunakan URL eksplisit untuk memastikan koneksi ke server Asia Southeast 1
    private val database = FirebaseDatabase.getInstance("https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app")
    private val activeCodesRef = database.getReference("active_codes")
    private val activeSessionsRef = database.getReference("active_sessions")
    private val activeSessionsBySchoolRef = database.getReference("active_sessions_by_school")

    private var revocationListener: ValueEventListener? = null
    private var currentNisn: String? = null

    companion object {
        private const val KEY_PERMISSION_GRANTED = "permission_granted"
        private const val KEY_PERMISSION_START_TIME = "permission_start_time"
        private const val KEY_PERMISSION_DURATION = "permission_duration"
        private const val KEY_PERMISSION_CODE_USED = "permission_code_used"
    }

    /**
     * Validasi kode dari Firebase (Dynamic Code)
     * Kode hanya valid jika ada di Firebase dan belum expired
     */
    fun validateCode(code: String, callback: (Int?) -> Unit) {
        activeCodesRef.child(code.uppercase().trim()).addListenerForSingleValueEvent(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                if (snapshot.exists()) {
                    val prefsManager = PreferencesManager(context)
                    val localSchoolId = prefsManager.schoolId.trim().lowercase()
                    val codeSchoolId = snapshot.child("schoolId").getValue(String::class.java)
                        ?.trim()
                        ?.lowercase()
                        .orEmpty()
                    val expiresAt = snapshot.child("expiresAt").getValue(Long::class.java) ?: 0
                    val duration = snapshot.child("duration").getValue(Int::class.java) ?: 0
                    val currentTime = System.currentTimeMillis()

                    if (codeSchoolId.isNotEmpty() && localSchoolId.isNotEmpty() && codeSchoolId != localSchoolId) {
                        callback(null)
                        return
                    }

                    // Check if code is still valid (not expired)
                    if (currentTime < expiresAt && duration > 0) {
                        callback(duration)
                    } else {
                        // Code expired
                        callback(null)
                    }
                } else {
                    // Code not found
                    callback(null)
                }
            }

            override fun onCancelled(error: DatabaseError) {
                callback(null)
            }
        })
    }

    /**
     * Start Active Session in Firebase
     * Ini membuat siswa muncul di Dashboard Guru
     */
    fun startSession(nisn: String, name: String, studentClass: String, durationMinutes: Int) {
        val endTime = System.currentTimeMillis() + (durationMinutes * 60 * 1000)
        val prefsManager = PreferencesManager(context)
        val schoolId = prefsManager.schoolId.trim().lowercase()
        
        val sessionData = mapOf(
            "nisn" to nisn,
            "name" to name,
            "class" to studentClass,
            "schoolId" to schoolId,
            "startTime" to System.currentTimeMillis(),
            "endTime" to endTime,
            "duration" to durationMinutes,
            "deviceModel" to android.os.Build.MODEL,
            "deviceId" to prefsManager.deviceId
        )
        
        activeSessionsRef.child(nisn).setValue(sessionData)
            .addOnFailureListener { e ->
                android.widget.Toast.makeText(context, "Gagal lapor aktif: ${e.message}. Cek aturan database.", android.widget.Toast.LENGTH_LONG).show()
            }
        if (schoolId.isNotEmpty()) {
            activeSessionsBySchoolRef.child(schoolId).child(nisn).setValue(sessionData)
        }
        startListeningForRevocation(nisn)
    }

    /**
     * End Active Session
     * Menghapus siswa dari Dashboard Guru
     */
    fun endSession(nisn: String) {
        activeSessionsRef.child(nisn).removeValue()
        val schoolId = PreferencesManager(context).schoolId.trim().lowercase()
        if (schoolId.isNotEmpty()) {
            activeSessionsBySchoolRef.child(schoolId).child(nisn).removeValue()
        }
        stopListeningForRevocation()
    }

    /**
     * Resume Session Monitoring (called on app start if permission active)
     */
    fun resumeSession(nisn: String) {
        startListeningForRevocation(nisn)
    }

    private var pollingHandler: android.os.Handler? = null
    private var pollingRunnable: Runnable? = null

    /**
     * Listen for Revocation (Pembatalan Izin oleh Guru)
     * Menggunakan Dual-Mechanism: Realtime Listener + Polling (Backup)
     */
    private fun startListeningForRevocation(nisn: String) {
        if (nisn.isEmpty()) {
            android.util.Log.e("PermissionManager", "Cannot listen: NISN is empty")
            return
        }

        // 1. Setup Realtime Listener
        setupRealtimeListener(nisn)

        // 2. Setup Polling (Backup jika realtime gagal)
        startPolling(nisn)
    }

    private fun setupRealtimeListener(nisn: String) {
        if (currentNisn == nisn && revocationListener != null) {
            // Already listening, but let's refresh just in case
            activeSessionsRef.child(nisn).keepSynced(true)
            return
        }

        stopListeningForRevocation()
        currentNisn = nisn

        activeSessionsRef.child(nisn).keepSynced(true)

        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                checkSessionExistence(snapshot.exists(), "Realtime")
            }

            override fun onCancelled(error: DatabaseError) {
                android.util.Log.e("PermissionManager", "Listener cancelled: ${error.message}")
            }
        }

        revocationListener = listener
        activeSessionsRef.child(nisn).addValueEventListener(listener)
    }

    private fun startPolling(nisn: String) {
        stopPolling() // Stop old polling if any

        pollingHandler = android.os.Handler(android.os.Looper.getMainLooper())
        pollingRunnable = object : Runnable {
            override fun run() {
                if (!isPermissionActive()) {
                    stopPolling()
                    return
                }

                // Debug Toast setiap polling (Temporary)
                // android.widget.Toast.makeText(context, "Cek status izin untuk: $nisn...", android.widget.Toast.LENGTH_SHORT).show()

                // Cek manual ke database
                activeSessionsRef.child(nisn).get().addOnSuccessListener { snapshot ->
                    // Debug Toast hasil
                    // android.widget.Toast.makeText(context, "Status di server: ${if (snapshot.exists()) "Masih Aktif" else "DIBATALKAN"}", android.widget.Toast.LENGTH_SHORT).show()
                    
                    checkSessionExistence(snapshot.exists(), "Polling")
                }.addOnFailureListener {
                    // Ignore error silently in production
                }

                // Ulangi setiap 10 detik
                pollingHandler?.postDelayed(this, 10000)
            }
        }
        pollingHandler?.post(pollingRunnable!!)
    }

    private fun stopPolling() {
        pollingRunnable?.let { pollingHandler?.removeCallbacks(it) }
        pollingHandler = null
        pollingRunnable = null
    }

    private fun checkSessionExistence(exists: Boolean, source: String) {
        if (!exists) {
            android.util.Log.d("PermissionManager", "Session missing detected via $source")
            
            // Cek apakah permission aktif di preferences
            val isGranted = prefs.getBoolean(KEY_PERMISSION_GRANTED, false)
            
            if (isGranted) {
                val handler = android.os.Handler(android.os.Looper.getMainLooper())
                handler.post {
                     // Double check inside main thread
                     if (prefs.getBoolean(KEY_PERMISSION_GRANTED, false)) {
                         revokePermission()
                         android.widget.Toast.makeText(context, "Izin dicabut oleh Guru!", android.widget.Toast.LENGTH_LONG).show()
                     }
                }
            }
        }
    }

    private fun stopListeningForRevocation() {
        currentNisn?.let { nisn ->
            revocationListener?.let { listener ->
                activeSessionsRef.child(nisn).removeEventListener(listener)
            }
        }
        revocationListener = null
        currentNisn = null
        stopPolling()
    }

    /**
     * Grant permission dengan kode
     */
    fun grantPermission(code: String, durationMinutes: Int) {
        prefs.edit().apply {
            putBoolean(KEY_PERMISSION_GRANTED, true)
            putLong(KEY_PERMISSION_START_TIME, System.currentTimeMillis())
            putInt(KEY_PERMISSION_DURATION, durationMinutes)
            putString(KEY_PERMISSION_CODE_USED, code)
            apply()
        }

        try {
            val intent = android.content.Intent("com.sekolah.edulock.ACTION_DISMISS_LOCKSCREEN")
            intent.setPackage(context.packageName)
            context.sendBroadcast(intent)
        } catch (_: Exception) {
        }

        try {
            val intent = android.content.Intent("com.sekolah.edulock.ACTION_STOP_KIOSK")
            intent.setPackage(context.packageName)
            context.sendBroadcast(intent)
        } catch (_: Exception) {
        }
    }

    /**
     * Cek apakah permission masih aktif
     */
    fun isPermissionActive(): Boolean {
        if (!prefs.getBoolean(KEY_PERMISSION_GRANTED, false)) {
            return false
        }

        val startTime = prefs.getLong(KEY_PERMISSION_START_TIME, 0)
        val duration = prefs.getInt(KEY_PERMISSION_DURATION, 0)
        val currentTime = System.currentTimeMillis()

        val elapsedMinutes = (currentTime - startTime) / 1000 / 60

        // Jika sudah lewat durasi, revoke permission
        if (elapsedMinutes >= duration) {
            revokePermission()
            return false
        }

        return true
    }

    /**
     * Get remaining time in minutes
     */
    fun getRemainingMinutes(): Int {
        if (!isPermissionActive()) {
            return 0
        }

        val startTime = prefs.getLong(KEY_PERMISSION_START_TIME, 0)
        val duration = prefs.getInt(KEY_PERMISSION_DURATION, 0)
        val currentTime = System.currentTimeMillis()

        val elapsedMinutes = (currentTime - startTime) / 1000 / 60
        val remaining = duration - elapsedMinutes.toInt()

        return if (remaining > 0) remaining else 0
    }

    /**
     * Get remaining time as formatted string (HH:mm)
     */
    fun getRemainingTimeFormatted(): String {
        val totalMinutes = getRemainingMinutes()
        val hours = totalMinutes / 60
        val minutes = totalMinutes % 60
        return String.format("%02d:%02d", hours, minutes)
    }

    /**
     * Revoke permission
     */
    fun revokePermission() {
        // Remove from Firebase active sessions
        val prefsManager = PreferencesManager(context)
        val nisn = prefsManager.nisn
        if (nisn.isNotEmpty()) {
            endSession(nisn)
        }

        prefs.edit().apply {
            putBoolean(KEY_PERMISSION_GRANTED, false)
            remove(KEY_PERMISSION_START_TIME)
            remove(KEY_PERMISSION_DURATION)
            remove(KEY_PERMISSION_CODE_USED)
            apply()
        }

        // Force user back to MainActivity (Lock Screen)
        try {
            val intent = android.content.Intent(context, MainActivity::class.java)
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK)
            context.startActivity(intent)
        } catch (e: Exception) {
            android.util.Log.e("PermissionManager", "Failed to launch MainActivity: ${e.message}")
        }
    }

    /**
     * Get permission details
     */
    fun getPermissionDetails(): PermissionDetails? {
        if (!isPermissionActive()) {
            return null
        }

        return PermissionDetails(
            codeUsed = prefs.getString(KEY_PERMISSION_CODE_USED, "") ?: "",
            startTime = prefs.getLong(KEY_PERMISSION_START_TIME, 0),
            durationMinutes = prefs.getInt(KEY_PERMISSION_DURATION, 0),
            remainingMinutes = getRemainingMinutes()
        )
    }

    /**
     * Log permission usage ke database
     */
    fun logPermissionUsage(nisn: String, code: String, durationMinutes: Int) {
        try {
            val dbHelper = DatabaseHelper(context)
            val prefsManager = PreferencesManager(context)
            val studentId = prefsManager.studentId

            if (studentId > 0) {
                dbHelper.insertViolation(
                    studentId,
                    "PERMISSION_GRANTED",
                    "Izin penggunaan HP diberikan dengan kode: $code untuk durasi: $durationMinutes menit"
                )
            }

            // Log to Firebase
            val firebaseManager = FirebaseManager.getInstance()
            firebaseManager.logPermission(nisn, code, durationMinutes)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Log pelanggaran ke database
     */
    fun logViolation(nisn: String, violationType: String, description: String) {
        try {
            val dbHelper = DatabaseHelper(context)
            val prefsManager = PreferencesManager(context)
            val studentId = prefsManager.studentId
            val schoolId = prefsManager.schoolId

            if (studentId > 0) {
                dbHelper.insertViolation(studentId, violationType, description)
            }

            // Log to Firebase
            val firebaseManager = FirebaseManager.getInstance()
            firebaseManager.logViolation(nisn, schoolId, violationType, description, 0.0, 0.0)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

}

// Data class untuk detail permission
data class PermissionDetails(
    val codeUsed: String,
    val startTime: Long,
    val durationMinutes: Int,
    val remainingMinutes: Int
)
