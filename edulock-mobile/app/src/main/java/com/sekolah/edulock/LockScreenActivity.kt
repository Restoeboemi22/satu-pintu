package com.sekolah.edulock

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity

class LockScreenActivity : AppCompatActivity() {

    private lateinit var tvMessage: TextView
    private lateinit var btnAdminUnlock: Button
    private lateinit var btnOpenSchoolApp: Button
    private val handler = Handler(Looper.getMainLooper())
    private var isKioskModeActive = false
    private var isSwitchingToSchoolApp: Boolean = false
    
    private val dismissReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "com.sekolah.edulock.ACTION_DISMISS_LOCKSCREEN") {
                Toast.makeText(context, "Mode Bebas Aktif. Kunci dibuka.", Toast.LENGTH_LONG).show()
                stopKioskMode()
                finish()
            }
        }
    }

    private var tapCount = 0
    private var lastTapTime = 0L
    private var isEmergencyDialogShowing = false
    private lateinit var rootLockScreen: View

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_lock_screen)

        rootLockScreen = findViewById(R.id.rootLockScreen)
        tvMessage = findViewById(R.id.tvLockMessage)
        btnAdminUnlock = findViewById(R.id.btnAdminUnlock)
        btnOpenSchoolApp = findViewById(R.id.btnOpenSchoolApp)

        rootLockScreen.setOnTouchListener { _, ev ->
            if (ev.actionMasked == MotionEvent.ACTION_DOWN) {
                handleEmergencyTap()
            }
            false
        }
        
        // Setup Tombol Aplikasi Sekolah
        btnOpenSchoolApp.setOnClickListener {
            val targetPackage = "com.sekolah.aplikasismpn3pacet"
            val launchIntent = packageManager.getLaunchIntentForPackage(targetPackage)
            
            // Visual feedback bahwa tombol ditekan
            Toast.makeText(this, "Membuka Aplikasi Sekolah...", Toast.LENGTH_SHORT).show()

            if (launchIntent != null) {
                try {
                    isSwitchingToSchoolApp = true
                    // 1. Matikan Kiosk Mode sementara agar bisa pindah app
                    stopKioskMode()
                    
                    // 2. Pre-Whitelist di PreferencesManager agar tidak dibunuh oleh MonitoringService
                    // (Mengatasi race condition sebelum AccessibilityService mendeteksi package baru)
                    val prefsManager = PreferencesManager(this)
                    prefsManager.lastForegroundPackage = targetPackage
                    prefsManager.appSwitchTimestamp = System.currentTimeMillis() // Set Timestamp
                    
                    // 3. Launch App dengan DELAY untuk memastikan Kiosk Mode benar-benar mati
                    // Menggunakan handler agar UI thread sempat memproses stopLockTask()
                    handler.postDelayed({
                        try {
                             launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
                             startActivity(launchIntent)
                             
                             // 4. Tutup Lock Screen ini setelah launch berhasil
                             finish()
                        } catch (e: Exception) {
                             Toast.makeText(this, "Gagal meluncurkan: ${e.message}", Toast.LENGTH_LONG).show()
                             // Jika gagal, coba nyalakan kiosk lagi
                             startKioskMode()
                        }
                    }, 300) // Delay 300ms
                    
                } catch (e: Exception) {
                    Toast.makeText(this, "Gagal membuka aplikasi: ${e.message}", Toast.LENGTH_SHORT).show()
                    isSwitchingToSchoolApp = false
                }
            } else {
                Toast.makeText(this, "Aplikasi Sekolah (SMPN 3 Pacet) Belum Terinstall!", Toast.LENGTH_LONG).show()
                isSwitchingToSchoolApp = false
            }
        }
        
        val prefsManager = PreferencesManager(this)

        // AUTO-DETECT EMULATOR DI LOCKSCREEN
        // Jika terdeteksi emulator (atau sudah diset di prefs), langsung buka dan paksa lokasi
        if (isEmulator() || prefsManager.isEmulator) {
            tvMessage.text = "Emulator Terdeteksi!\nMenutup Layar Pelanggaran..."
            tvMessage.setTextColor(android.graphics.Color.BLUE)
            
            prefsManager.isForcedLocation = true
            prefsManager.isInsideSchoolZone = true
            prefsManager.isEmulator = true
            
            // Langsung eksekusi tanpa delay lama
            handler.postDelayed({
                stopKioskMode()
                finish()
            }, 500)
            return
        }

        // Register receiver
        val filter = android.content.IntentFilter("com.sekolah.edulock.ACTION_DISMISS_LOCKSCREEN")
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            registerReceiver(dismissReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(dismissReceiver, filter)
        }

        val message = intent.getStringExtra("MESSAGE") ?: "PERANGKAT TERKUNCI!"
        tvMessage.text = message
        
        // Cek apakah ini mode proteksi admin
        if (intent.getBooleanExtra("ADMIN_PROTECTION", false)) {
            btnAdminUnlock.visibility = View.VISIBLE
            tvMessage.text = "PERINGATAN KEAMANAN!\n\nUpaya mematikan Administrator terdeteksi.\nMasukkan password admin untuk melanjutkan."
        }

        btnAdminUnlock.setOnClickListener {
            showAdminUnlockDialog()
        }

        // Langsung aktifkan Kiosk Mode tanpa delay
        // FIX: delay 500ms sebelumnya membuka jendela race condition dimana
        // siswa bisa menekan Home sebelum startLockTask() sempat dipanggil.
        startKioskMode()
    }

    private fun showAdminUnlockDialog() {
        if (isEmergencyDialogShowing) return
        isEmergencyDialogShowing = true

        val input = EditText(this)
        input.hint = "Password Admin"
        input.inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
        
        AlertDialog.Builder(this)
            .setTitle("Buka Kunci Admin")
            .setMessage("Masukkan password untuk menonaktifkan proteksi.")
            .setView(input)
            .setCancelable(false)
            .setPositiveButton("Buka") { _, _ ->
                val password = input.text.toString()
                val prefsManager = PreferencesManager(this)
                val calendar = java.util.Calendar.getInstance()
                val dayOfMonth = calendar.get(java.util.Calendar.DAY_OF_MONTH)
                val dynamicPassword = "EduLock$dayOfMonth"

                if (password == dynamicPassword) {
                    Toast.makeText(this, "Akses Admin Diterima. Mode Darurat Aktif.", Toast.LENGTH_LONG).show()
                    
                    // LOGGING VIOLATION (Offline Audit)
                    // Catat bahwa siswa ini dibuka paksa secara manual
                    val dbHelper = DatabaseHelper(this)
                    dbHelper.logViolation(
                        prefsManager.nisn,
                        "EMERGENCY_UNLOCK",
                        "Dibuka paksa dengan password manual saat offline/darurat."
                    )
                    
                    // Force location & Emergency Flag
                    prefsManager.isForcedLocation = true
                    prefsManager.isInsideSchoolZone = true
                    prefsManager.isEmergencyUnlocked = true // Mencegah relock oleh OfflineMonitor
                    
                    stopKioskMode()
                    finish()
                } else {
                    Toast.makeText(this, "Password Salah!", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Batal", null)
            .setOnDismissListener { isEmergencyDialogShowing = false }
            .show()
    }

    private fun handleEmergencyTap() {
        val now = System.currentTimeMillis()

        if (lastTapTime > 0L && now - lastTapTime > 3000L) {
            tapCount = 0
        }
        lastTapTime = now
        tapCount++

        when (tapCount) {
            in 2..6 -> {
                val remaining = 7 - tapCount
                Toast.makeText(this, "Ketuk ${remaining}× lagi untuk Mode Darurat...", Toast.LENGTH_SHORT).show()
            }
        }

        if (tapCount >= 7) {
            tapCount = 0
            lastTapTime = 0L
            showEmergencyUnlockDialog()
        }
    }

    private fun showEmergencyUnlockDialog() {
        if (isEmergencyDialogShowing) return
        isEmergencyDialogShowing = true

        val input = EditText(this)
        input.hint = "Password Darurat"
        input.inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD

        AlertDialog.Builder(this)
            .setTitle("Mode Darurat")
            .setMessage("Gunakan saat ada gangguan massal (misalnya internet mati). Masukkan password darurat harian untuk membuka sementara.")
            .setView(input)
            .setCancelable(false)
            .setPositiveButton("Buka") { _, _ ->
                val password = input.text.toString()
                val prefsManager = PreferencesManager(this)

                val calendar = java.util.Calendar.getInstance()
                val dayOfMonth = calendar.get(java.util.Calendar.DAY_OF_MONTH)
                val dynamicPassword = "EduLock$dayOfMonth"

                if (password == dynamicPassword) {
                    val dbHelper = DatabaseHelper(this)
                    dbHelper.logViolation(
                        prefsManager.nisn,
                        "EMERGENCY_UNLOCK",
                        "Dibuka paksa dengan password manual saat offline/darurat."
                    )

                    prefsManager.isForcedLocation = true
                    prefsManager.isInsideSchoolZone = true
                    prefsManager.isEmergencyUnlocked = true

                    stopKioskMode()
                    finish()
                } else {
                    Toast.makeText(this, "Password Salah!", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Batal", null)
            .setOnDismissListener { isEmergencyDialogShowing = false }
            .show()
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (ev.actionMasked == MotionEvent.ACTION_DOWN) {
            handleEmergencyTap()
        }
        return super.dispatchTouchEvent(ev)
    }

    override fun onResume() {
        super.onResume()
        
        // Cek jika Mode Bebas aktif, langsung tutup lock screen
        val prefsManager = PreferencesManager(this)
        prefsManager.isUiForeground = true
        prefsManager.uiForegroundAt = System.currentTimeMillis()

        try {
            val ping = Intent(this, MonitoringService::class.java)
            ping.action = "com.sekolah.edulock.ACTION_UI_FOREGROUND"
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                startForegroundService(ping)
            } else {
                startService(ping)
            }
        } catch (_: Exception) {
        }
        
        // UPDATE DYNAMIC BUTTON: Cek apakah Aplikasi Sekolah sudah terinstall
        val targetPackage = "com.sekolah.aplikasismpn3pacet"
        try {
            packageManager.getPackageInfo(targetPackage, 0)
            btnOpenSchoolApp.visibility = View.VISIBLE
            btnOpenSchoolApp.text = "BUKA APLIKASI SEKOLAH"
            btnOpenSchoolApp.isEnabled = true
            btnOpenSchoolApp.backgroundTintList = android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#1976D2")) // Biru
        } catch (e: Exception) {
            // DEBUG MODE: Tampilkan tombol tapi disable, biar ketahuan kalau logic jalan tapi app tidak ketemu
            btnOpenSchoolApp.visibility = View.VISIBLE
            btnOpenSchoolApp.text = "APP SEKOLAH BELUM TERDETEKSI\n(Install: com.sekolah.aplikasismpn3pacet)"
            btnOpenSchoolApp.isEnabled = false
            btnOpenSchoolApp.backgroundTintList = android.content.res.ColorStateList.valueOf(android.graphics.Color.GRAY)
            
            // Toast.makeText(this, "Debug: App Sekolah TIDAK ditemukan ($targetPackage)", Toast.LENGTH_LONG).show()
        }
        
        // FAILSAFE: Cek berkala setiap 2 detik apakah mode libur atau silent mode aktif
        // Ini menangani kasus jika broadcast missed atau update terlambat
        val holidayCheckRunnable = object : Runnable {
            override fun run() {
                // Cek Holiday Mode ATAU Silent Mode (Protection Inactive)
                if (prefsManager.isHolidayMode || !prefsManager.isProtectionActive) {
                    val msg = if (prefsManager.isHolidayMode) "Mode Bebas Terdeteksi (Auto)" else "Mode Silent Aktif (Auto)"
                    Toast.makeText(applicationContext, msg, Toast.LENGTH_SHORT).show()
                    finish()
                } else {
                    handler.postDelayed(this, 2000)
                }
            }
        }
        handler.post(holidayCheckRunnable)
        
        if (prefsManager.isHolidayMode || !prefsManager.isProtectionActive) {
            val msg = if (prefsManager.isHolidayMode) "Mode Bebas sedang aktif." else "Mode Silent sedang aktif."
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
            if (!prefsManager.isProtectionActive) {
                stopKioskMode()
            }
            finish()
            return
        }

        startKioskMode()
    }

    override fun onPause() {
        super.onPause()
    }

    private fun startKioskMode() {
        if (isKioskModeActive) return
        
        // SAFETY CHECK: Jangan aktifkan Kiosk Mode jika Silent Mode aktif
        val prefsManager = PreferencesManager(this)
        if (!prefsManager.isProtectionActive && !prefsManager.isEmulator && !prefsManager.isForcedLocation) {
             return
        }
        
        try {
            startLockTask()
            isKioskModeActive = true
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
    
    private fun stopKioskMode() {
        try {
            stopLockTask()
            isKioskModeActive = false
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun isEmulator(): Boolean {
        return (android.os.Build.BRAND.startsWith("generic") && android.os.Build.DEVICE.startsWith("generic"))
                || android.os.Build.FINGERPRINT.startsWith("generic")
                || android.os.Build.FINGERPRINT.startsWith("unknown")
                || android.os.Build.HARDWARE.contains("goldfish")
                || android.os.Build.HARDWARE.contains("ranchu")
                || android.os.Build.MODEL.contains("google_sdk")
                || android.os.Build.MODEL.contains("Emulator")
                || android.os.Build.MODEL.contains("Android SDK built for x86")
                || android.os.Build.MANUFACTURER.contains("Genymotion")
                || android.os.Build.PRODUCT.contains("sdk_google")
                || android.os.Build.PRODUCT.contains("google_sdk")
                || android.os.Build.PRODUCT.contains("sdk")
                || android.os.Build.PRODUCT.contains("sdk_x86")
                || android.os.Build.PRODUCT.contains("vbox86p")
                || android.os.Build.PRODUCT.contains("emulator")
                || android.os.Build.PRODUCT.contains("simulator")
                || android.os.Build.PRODUCT.contains("sdk_gphone")
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        
        // Update pesan jika ada intent baru
        val message = intent?.getStringExtra("MESSAGE") ?: "PERANGKAT TERKUNCI"
        if (::tvMessage.isInitialized) {
            tvMessage.text = message
        }
        
        // Cek admin protection flag
        if (intent?.getBooleanExtra("ADMIN_PROTECTION", false) == true) {
            if (::btnAdminUnlock.isInitialized) {
                btnAdminUnlock.visibility = View.VISIBLE
                tvMessage.text = "PERINGATAN KEAMANAN!\n\nUpaya mematikan Administrator terdeteksi.\nMasukkan password admin untuk melanjutkan."
            }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        // FIX: Lapisan perlindungan tambahan - saat app kehilangan fokus (Home/Recents ditekan),
        // langsung re-enforce Kiosk Mode agar startLockTask() aktif kembali.
        if (!hasFocus) {
            val prefs = PreferencesManager(this)
            if (prefs.isProtectionActive && !isSwitchingToSchoolApp && !prefs.isEmergencyUnlocked) {
                startKioskMode()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(dismissReceiver)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onBackPressed() {
        // Disable back button
        Toast.makeText(this, "Akses ditolak! Anda melanggar aturan.", Toast.LENGTH_SHORT).show()
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()

        try {
            val prefs = PreferencesManager(this)

            // FIX: Jangan cek isHolidayMode di sini sebagai alasan untuk TIDAK mengunci.
            // Jika LockScreenActivity sudah muncul, berarti admin sudah mematikan Holiday Mode.
            // Mengecek isHolidayMode menyebabkan race condition: prefs mungkin belum
            // terupdate saat tombol Home ditekan pertama kali.
            if (!prefs.isProtectionActive) return
            if (isSwitchingToSchoolApp) return
            if (prefs.isEmergencyUnlocked) return

            val permissionManager = PermissionManager(this)
            // Jika siswa sudah punya izin aktif (misal sedang buka app sekolah), jangan paksa kembali
            if (permissionManager.isPermissionActive()) return

            // Langsung re-aktifkan Kiosk Mode sebagai lapis pertama pertahanan
            // Ini memblokir tombol Home secara native jika Device Owner aktif
            startKioskMode()

            // Lapis kedua: luncurkan ulang LockScreenActivity untuk kasus non-Device Owner
            val intent = Intent(this, LockScreenActivity::class.java)
            intent.putExtra("MESSAGE", tvMessage.text?.toString() ?: "PERANGKAT TERKUNCI!")
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            startActivity(intent)
        } catch (_: Exception) {
        }
    }
}
