package com.sekolah.edulock

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class PermissionCodeActivity : AppCompatActivity() {

    private lateinit var etPermissionCode: EditText
    private lateinit var btnSubmitCode: Button
    private lateinit var btnCancel: Button

    private lateinit var permissionManager: PermissionManager
    private lateinit var prefsManager: PreferencesManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_permission_code)

        // Initialize
        permissionManager = PermissionManager(this)
        prefsManager = PreferencesManager(this)

        // Initialize views
        etPermissionCode = findViewById(R.id.etPermissionCode)
        btnSubmitCode = findViewById(R.id.btnSubmitCode)
        btnCancel = findViewById(R.id.btnCancel)

        // Set listeners
        btnSubmitCode.setOnClickListener {
            validateAndSubmitCode()
        }

        btnCancel.setOnClickListener {
            finish()
        }
    }

    override fun onResume() {
        super.onResume()
        try {
            prefsManager.isUiForeground = true
            prefsManager.uiForegroundAt = System.currentTimeMillis()
        } catch (_: Exception) {
        }
    }

    override fun onPause() {
        super.onPause()
        try {
            prefsManager.isUiForeground = false
            prefsManager.uiForegroundAt = System.currentTimeMillis()
        } catch (_: Exception) {
        }
    }

    private fun validateAndSubmitCode() {
        val code = etPermissionCode.text.toString().trim()

        if (code.isEmpty()) {
            Toast.makeText(this, "Masukkan kode izin!", Toast.LENGTH_SHORT).show()
            return
        }

        // Disable button & show loading
        btnSubmitCode.isEnabled = false
        btnSubmitCode.text = "Memvalidasi..."

        // Validate code dari Firebase
        permissionManager.validateCode(code) { duration ->
            if (duration != null) {
                // Kode valid
                permissionManager.grantPermission(code, duration)

                // Log ke database
                val nisn = prefsManager.nisn
                permissionManager.logPermissionUsage(nisn, code, duration)

                // Start Session in Firebase (Active Monitoring)
                val name = prefsManager.studentName
                val studentClass = prefsManager.studentClass
                permissionManager.startSession(nisn, name, studentClass, duration)

                // Tampilkan success message
                val hours = duration / 60
                val minutes = duration % 60
                val message = if (hours > 0) {
                    "✅ Izin diberikan untuk $hours jam $minutes menit"
                } else {
                    "✅ Izin diberikan untuk $minutes menit"
                }

                Toast.makeText(this, message, Toast.LENGTH_LONG).show()

                // Kembali ke MainActivity dengan result OK
                setResult(RESULT_OK)
                finish()

            } else {
                // Kode invalid atau expired
                Toast.makeText(
                    this,
                    "❌ Kode tidak valid atau sudah kedaluwarsa!\nMinta kode baru dari guru.",
                    Toast.LENGTH_LONG
                ).show()

                // Log pelanggaran
                val nisn = prefsManager.nisn
                permissionManager.logViolation(
                    nisn,
                    "INVALID_PERMISSION_CODE",
                    "Mencoba input kode tidak valid: $code"
                )

                // Re-enable button & clear input
                btnSubmitCode.isEnabled = true
                btnSubmitCode.text = "Verifikasi Kode"
                etPermissionCode.text.clear()
            }
        }
    }

    override fun onBackPressed() {
        finish()
    }
}
