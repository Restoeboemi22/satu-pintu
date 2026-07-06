package com.sekolah.edulock

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener

class RegistrationActivity : AppCompatActivity() {

    private lateinit var etNISN: EditText
    private lateinit var etName: EditText
    private lateinit var etClass: EditText
    private lateinit var btnRegister: Button

    private lateinit var prefsManager: PreferencesManager
    private lateinit var dbHelper: DatabaseHelper

    companion object {
        private const val SCHOOL_DISABLED_TITLE = "Layanan Sekolah Nonaktif"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (BuildConfig.FLAVOR == "admin") {
            startActivity(Intent(this, AdminWebActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_registration)

        prefsManager = PreferencesManager(this)
        dbHelper = DatabaseHelper(this)

        // Cek apakah user sudah register
        if (prefsManager.isRegistered) {
            verifyCurrentSchoolStatusAndProceed()
            return
        }
        
        // Cek Error Message dari Intent (misal logout paksa)
        val errorMessage = intent.getStringExtra("ERROR_MESSAGE")
        if (errorMessage != null) {
            androidx.appcompat.app.AlertDialog.Builder(this)
                .setTitle("Peringatan Keamanan")
                .setMessage(errorMessage)
                .setPositiveButton("OK", null)
                .setCancelable(false)
                .show()
        }

        initViews()
        setupListeners()
    }

    private fun initViews() {
        etNISN = findViewById(R.id.etNISN)
        etName = findViewById(R.id.etName)
        etClass = findViewById(R.id.etClass)
        btnRegister = findViewById(R.id.btnRegister)
    }

    private fun setupListeners() {
        btnRegister.setOnClickListener {
            val nisn = etNISN.text.toString().trim()
            val name = etName.text.toString().trim()
            val studentClass = etClass.text.toString().trim()

            if (validateInput(nisn, name, studentClass)) {
                verifyStudentWithFirebase(nisn, name, studentClass)
            }
        }
    }

    private fun verifyStudentWithFirebase(nisn: String, name: String, studentClass: String) {
        // Show loading state
        btnRegister.isEnabled = false
        btnRegister.text = "Memverifikasi..."

        val database = SchoolServiceGuard.database()
        val normalizedNisn = nisn.trim()

        database.getReference("students_by_school").addListenerForSingleValueEvent(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val resolvedSchoolId = snapshot.children
                    .firstOrNull { schoolNode -> schoolNode.child(normalizedNisn).exists() }
                    ?.key
                    ?.trim()
                    ?.lowercase()
                    .orEmpty()

                if (resolvedSchoolId.isBlank()) {
                    btnRegister.isEnabled = true
                    btnRegister.text = "Daftar"
                    Toast.makeText(
                        this@RegistrationActivity,
                        "NISN tidak terdaftar pada tenant sekolah yang valid.",
                        Toast.LENGTH_LONG
                    ).show()
                    return
                }

                database.getReference("students").child(normalizedNisn)
                    .addListenerForSingleValueEvent(object : ValueEventListener {
                        override fun onDataChange(studentSnapshot: DataSnapshot) {
                            if (!studentSnapshot.exists()) {
                                btnRegister.isEnabled = true
                                btnRegister.text = "Daftar"
                                Toast.makeText(
                                    this@RegistrationActivity,
                                    "Data siswa tidak ditemukan di database sekolah.",
                                    Toast.LENGTH_LONG
                                ).show()
                                return
                            }

                            val dbName = studentSnapshot.child("name").getValue(String::class.java)
                            val dbClass = studentSnapshot.child("class").getValue(String::class.java)
                            val studentSchoolId = studentSnapshot.child("schoolId").getValue(String::class.java)
                                ?.trim()
                                ?.lowercase()
                                .orEmpty()

                            if (studentSchoolId.isBlank() || studentSchoolId != resolvedSchoolId) {
                                btnRegister.isEnabled = true
                                btnRegister.text = "Daftar"
                                Toast.makeText(
                                    this@RegistrationActivity,
                                    "Data siswa tidak konsisten dengan tenant sekolah.",
                                    Toast.LENGTH_LONG
                                ).show()
                                return
                            }

                            if (dbName != null && dbClass != null &&
                                dbName.equals(name, ignoreCase = true) &&
                                dbClass.equals(studentClass, ignoreCase = true)
                            ) {
                                ensureSchoolServiceActive(resolvedSchoolId) {
                                    prefsManager.schoolId = resolvedSchoolId

                                    val existingDeviceUuid = studentSnapshot.child("device_uuid").getValue(String::class.java)
                                    val currentDeviceId = prefsManager.deviceId

                                    if (!existingDeviceUuid.isNullOrEmpty() && existingDeviceUuid != currentDeviceId) {
                                        showDeviceBoundDialog()
                                        btnRegister.isEnabled = true
                                        btnRegister.text = "Daftar"
                                        return@ensureSchoolServiceActive
                                    }

                                    registerStudent(normalizedNisn, dbName, dbClass)
                                }
                            } else {
                                btnRegister.isEnabled = true
                                btnRegister.text = "Daftar"
                                Toast.makeText(
                                    this@RegistrationActivity,
                                    "Data tidak sesuai dengan database sekolah!",
                                    Toast.LENGTH_LONG
                                ).show()
                            }
                        }

                        override fun onCancelled(error: DatabaseError) {
                            btnRegister.isEnabled = true
                            btnRegister.text = "Daftar"
                            Toast.makeText(
                                this@RegistrationActivity,
                                "Gagal verifikasi data siswa: ${error.message}",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    })
            }

            override fun onCancelled(error: DatabaseError) {
                btnRegister.isEnabled = true
                btnRegister.text = "Daftar"
                Toast.makeText(this@RegistrationActivity, "Gagal verifikasi tenant sekolah: ${error.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun verifyCurrentSchoolStatusAndProceed() {
        val schoolId = SchoolServiceGuard.normalizeSchoolId(prefsManager.schoolId)
        if (schoolId.isBlank()) {
            prefsManager.isRegistered = false
            initViews()
            setupListeners()
            return
        }

        ensureSchoolServiceActive(schoolId, onDenied = {
            prefsManager.isRegistered = false
            prefsManager.isSetupCompleted = false
            initViews()
            setupListeners()
            showSchoolInactiveDialog()
        }) {
            checkSetupAndProceed()
        }
    }

    private fun ensureSchoolServiceActive(
        schoolId: String,
        onDenied: (() -> Unit)? = null,
        onAllowed: () -> Unit
    ) {
        val normalizedSchoolId = SchoolServiceGuard.normalizeSchoolId(schoolId)
        if (normalizedSchoolId.isBlank()) {
            onAllowed()
            return
        }

        val database = SchoolServiceGuard.database()
        database.getReference("schools").child(normalizedSchoolId)
            .addListenerForSingleValueEvent(object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    val isAllowed = !snapshot.exists() || SchoolServiceGuard.isSchoolServiceActive(snapshot)
                    if (isAllowed) {
                        onAllowed()
                        return
                    }

                    btnRegister.isEnabled = true
                    btnRegister.text = "Daftar"
                    onDenied?.invoke() ?: showSchoolInactiveDialog()
                }

                override fun onCancelled(error: DatabaseError) {
                    btnRegister.isEnabled = true
                    btnRegister.text = "Daftar"
                    Toast.makeText(
                        this@RegistrationActivity,
                        "Gagal memeriksa status layanan sekolah: ${error.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun showSchoolInactiveDialog() {
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle(SCHOOL_DISABLED_TITLE)
            .setMessage(SchoolServiceGuard.inactiveMessage())
            .setPositiveButton("OK", null)
            .setCancelable(false)
            .show()
    }

    private fun validateInput(nisn: String, name: String, studentClass: String): Boolean {
        if (nisn.isEmpty()) {
            etNISN.error = "NISN tidak boleh kosong"
            return false
        }
        if (name.isEmpty()) {
            etName.error = "Nama tidak boleh kosong"
            return false
        }
        if (studentClass.isEmpty()) {
            etClass.error = "Kelas tidak boleh kosong"
            return false
        }
        return true
    }

    private fun showDeviceBoundDialog() {
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("⚠️ AKUN SUDAH DIGUNAKAN")
            .setMessage("Akun ini sudah aktif di perangkat lain!\n\nDemi keamanan dan mencegah kecurangan, satu akun hanya boleh aktif di satu HP.\n\nJika ini adalah HP baru Anda, silakan hubungi Guru/Admin untuk mereset akun, atau logout dari HP lama terlebih dahulu.")
            .setPositiveButton("Mengerti", null)
            .setCancelable(false)
            .show()
    }

    private fun registerStudent(nisn: String, name: String, studentClass: String) {
        // Simpan ke database lokal
        val id = dbHelper.insertStudent(nisn, name, studentClass)

        if (id > 0) {
            // Generate Device ID if not exists
            val deviceId = if (prefsManager.deviceId.isEmpty()) {
                java.util.UUID.randomUUID().toString()
            } else {
                prefsManager.deviceId
            }

            // Simpan ke Shared Preferences menggunakan helper method
            prefsManager.saveStudentRegistration(id, nisn, name, studentClass, deviceId)

            // Update Device UUID ke Firebase untuk Binding
            updateFirebaseDeviceBinding(nisn, deviceId)

            Toast.makeText(this, "Registrasi Berhasil", Toast.LENGTH_SHORT).show()

            // Pindah ke SetupActivity (Konfigurasi Awal)
            startActivity(Intent(this, SetupActivity::class.java))
            finish()
        } else {
            btnRegister.isEnabled = true
            btnRegister.text = "Daftar"
            Toast.makeText(this, "Gagal menyimpan data lokal", Toast.LENGTH_SHORT).show()
        }
    }

    private fun checkSetupAndProceed() {
        if (prefsManager.isSetupCompleted) {
            startActivity(Intent(this, MainActivity::class.java))
        } else {
            startActivity(Intent(this, SetupActivity::class.java))
        }
        finish()
    }

    private fun updateFirebaseDeviceBinding(nisn: String, deviceId: String) {
        val database = SchoolServiceGuard.database()
        val studentRef = database.getReference("students").child(nisn)
        
        // Update device_uuid
        studentRef.child("device_uuid").setValue(deviceId)
            .addOnFailureListener {
                Toast.makeText(this, "Gagal binding device ke server", Toast.LENGTH_SHORT).show()
            }
    }
}
