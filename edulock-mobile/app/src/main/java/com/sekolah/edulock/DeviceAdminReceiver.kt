package com.sekolah.edulock

import android.app.admin.DeviceAdminReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.Toast

class DeviceAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Toast.makeText(
            context,
            "✅ EduLock Device Admin Aktif - Aplikasi terlindungi",
            Toast.LENGTH_LONG
        ).show()

        // Log aktivasi
        logToDatabase(context, "DEVICE_ADMIN_ENABLED", "Device Admin diaktifkan")
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Toast.makeText(
            context,
            "⚠️ EduLock Device Admin Dinonaktifkan",
            Toast.LENGTH_LONG
        ).show()

        // Log deaktivasi
        logToDatabase(context, "DEVICE_ADMIN_DISABLED", "Device Admin dinonaktifkan")
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence? {
        // 0. Cek apakah uninstall diizinkan oleh admin (via Remote Command)
        val prefsManager = PreferencesManager(context)
        if (prefsManager.isUninstallAuthorized) {
            return null // Izinkan disable tanpa pesan/warning
        }

        // INTERCEPT: User mencoba disable device admin

        // 0. IMMEDIATE LOCK!
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as android.app.admin.DevicePolicyManager
        if (dpm.isAdminActive(ComponentName(context, DeviceAdminReceiver::class.java))) {
            dpm.lockNow()
        }

        // 1. Launch AdminPasswordActivity untuk verifikasi password (sebagai blocker)
        val passwordIntent = Intent(context, AdminPasswordActivity::class.java)
        passwordIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        context.startActivity(passwordIntent)

        // 2. Log percobaan disable
        logToDatabase(
            context,
            "DISABLE_ADMIN_ATTEMPTED",
            "User mencoba menonaktifkan Device Admin - Auto Lock Triggered"
        )

        // 3. Return pesan peringatan
        return """
            ⚠️ PERINGATAN KEAMANAN ⚠️
            
            Menonaktifkan EduLock Device Admin memerlukan PASSWORD ADMIN SEKOLAH.
            
            Hanya guru/admin yang memiliki password ini.
            
            Percobaan menonaktifkan tanpa izin akan dicatat sebagai PELANGGARAN.
        """.trimIndent()
    }

    override fun onPasswordChanged(context: Context, intent: Intent) {
        super.onPasswordChanged(context, intent)
        // Optional: Track password changes
    }

    override fun onPasswordFailed(context: Context, intent: Intent) {
        super.onPasswordFailed(context, intent)
        // Optional: Track failed password attempts
    }

    private fun logToDatabase(context: Context, type: String, description: String) {
        try {
            val prefsManager = PreferencesManager(context)
            val dbHelper = DatabaseHelper(context)
            val nisn = prefsManager.nisn

            if (nisn.isNotEmpty()) {
                dbHelper.logViolation(nisn, type, description)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}