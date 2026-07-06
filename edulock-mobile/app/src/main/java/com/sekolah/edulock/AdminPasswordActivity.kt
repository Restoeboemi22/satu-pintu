package com.sekolah.edulock

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener

class AdminPasswordActivity : AppCompatActivity() {

    private lateinit var tvTitle: TextView
    private lateinit var tvWarning: TextView
    private lateinit var etAdminPassword: EditText
    private lateinit var btnVerify: Button
    private lateinit var btnCancel: Button

    private lateinit var prefsManager: PreferencesManager
    private lateinit var dbHelper: DatabaseHelper
    private lateinit var devicePolicyManager: DevicePolicyManager
    private lateinit var compName: ComponentName

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_admin_password)

        // Prevent back button
        supportActionBar?.hide()

        // Initialize
        prefsManager = PreferencesManager(this)
        dbHelper = DatabaseHelper(this)
        devicePolicyManager = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        compName = ComponentName(this, DeviceAdminReceiver::class.java)

        initViews()
        setupListeners()
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

    private fun initViews() {
        tvTitle = findViewById(R.id.tvAdminTitle)
        tvWarning = findViewById(R.id.tvAdminWarning)
        etAdminPassword = findViewById(R.id.etAdminPassword)
        btnVerify = findViewById(R.id.btnVerifyPassword)
        btnCancel = findViewById(R.id.btnCancelAdmin)
    }

    private fun setupListeners() {
        btnVerify.setOnClickListener {
            verifyAdminPassword()
        }

        btnCancel.setOnClickListener {
            // Cancel - tidak izinkan disable admin
            finish()
        }
    }

    private fun verifyAdminPassword() {
        val inputPassword = etAdminPassword.text.toString().trim()

        if (inputPassword.isEmpty()) {
            Toast.makeText(this, "Masukkan password admin", Toast.LENGTH_SHORT).show()
            return
        }

        val nisn = prefsManager.nisn
        if (nisn.isEmpty()) {
            Toast.makeText(this, "NISN belum terdaftar.", Toast.LENGTH_SHORT).show()
            return
        }

        btnVerify.isEnabled = false
        btnVerify.text = "Memvalidasi..."

        if (prefsManager.isUninstallAuthorized) {
            allowDisableDeviceAdmin()
            return
        }

        val database = FirebaseDatabase.getInstance("https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app")
        val schoolIdRef = database.getReference("students").child(nisn).child("schoolId")

        schoolIdRef.addListenerForSingleValueEvent(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val schoolId = snapshot.getValue(String::class.java)?.trim()?.lowercase() ?: ""
                if (schoolId.isEmpty()) {
                    denyDisableDeviceAdmin(inputPassword, "Sekolah belum terdeteksi untuk siswa ini.")
                    return
                }

                val uninstallRef = database.getReference("schools").child(schoolId).child("uninstallAccess")
                uninstallRef.addListenerForSingleValueEvent(object : ValueEventListener {
                    override fun onDataChange(uninstallSnap: DataSnapshot) {
                        val serverCode = uninstallSnap.child("code").getValue(String::class.java)?.trim() ?: ""
                        val expiresAt = uninstallSnap.child("expiresAt").getValue(Long::class.java) ?: 0L
                        val now = System.currentTimeMillis()

                        if (serverCode.isEmpty() || expiresAt <= 0L) {
                            denyDisableDeviceAdmin(inputPassword, "Kode uninstall belum tersedia. Hubungi admin sekolah/super admin.")
                            return
                        }

                        if (now > expiresAt) {
                            denyDisableDeviceAdmin(inputPassword, "Kode uninstall sudah kedaluwarsa. Minta kode baru.")
                            return
                        }

                        if (inputPassword.trim().equals(serverCode, ignoreCase = true)) {
                            allowDisableDeviceAdmin()
                        } else {
                            denyDisableDeviceAdmin(inputPassword, "Kode uninstall salah!")
                        }
                    }

                    override fun onCancelled(error: DatabaseError) {
                        denyDisableDeviceAdmin(inputPassword, "Gagal memvalidasi kode. Periksa koneksi internet.")
                    }
                })
            }

            override fun onCancelled(error: DatabaseError) {
                denyDisableDeviceAdmin(inputPassword, "Gagal memuat data sekolah. Periksa koneksi internet.")
            }
        })
    }

    private fun allowDisableDeviceAdmin() {
        Toast.makeText(this, "✅ Akses diterima. Device Admin akan dinonaktifkan.", Toast.LENGTH_LONG).show()

        val nisn = prefsManager.nisn
        dbHelper.logViolation(
            nisn,
            "ADMIN_DEACTIVATED",
            "Device Admin dinonaktifkan dengan akses uninstall yang valid oleh admin"
        )

        if (devicePolicyManager.isAdminActive(compName)) {
            devicePolicyManager.removeActiveAdmin(compName)
        }

        finish()
    }

    private fun denyDisableDeviceAdmin(inputPassword: String, message: String) {
        Toast.makeText(this, "❌ $message", Toast.LENGTH_LONG).show()

        val nisn = prefsManager.nisn
        dbHelper.logViolation(
            nisn,
            "UNAUTHORIZED_ADMIN_DISABLE",
            "Mencoba menonaktifkan Device Admin tanpa akses valid: $inputPassword"
        )

        etAdminPassword.setText("")
        btnVerify.isEnabled = true
        btnVerify.text = "Verifikasi"

        incrementFailedAttempts()
    }

    private fun incrementFailedAttempts() {
        val failedAttempts = prefsManager.prefs.getInt("admin_failed_attempts", 0) + 1
        prefsManager.prefs.edit().putInt("admin_failed_attempts", failedAttempts).apply()

        if (failedAttempts >= 3) {
            // Lock device setelah 3x percobaan gagal
            Toast.makeText(
                this,
                "⚠️ Terlalu banyak percobaan gagal! Perangkat dikunci.",
                Toast.LENGTH_LONG
            ).show()

            // Lock device
            if (devicePolicyManager.isAdminActive(compName)) {
                devicePolicyManager.lockNow()
            }

            // Reset counter
            prefsManager.prefs.edit().putInt("admin_failed_attempts", 0).apply()

            finish()
        } else {
            Toast.makeText(
                this,
                "Percobaan ${failedAttempts}/3",
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    override fun onBackPressed() {
        // Disable back button
        Toast.makeText(this, "Klik tombol Batal untuk keluar", Toast.LENGTH_SHORT).show()
    }
}
