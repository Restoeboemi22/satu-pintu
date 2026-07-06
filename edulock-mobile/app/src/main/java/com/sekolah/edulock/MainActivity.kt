package com.sekolah.edulock

import android.Manifest
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.cardview.widget.CardView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.google.zxing.integration.android.IntentIntegrator
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private lateinit var devicePolicyManager: DevicePolicyManager
    private lateinit var compName: ComponentName
    private lateinit var locationManager: LocationManager
    private lateinit var permissionManager: PermissionManager
    private lateinit var prefsManager: PreferencesManager
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback

    // UI Elements
    private lateinit var tvAppTitle: TextView
    private lateinit var tvStudentName: TextView
    private lateinit var tvClass: TextView
    private lateinit var tvGPSStatus: TextView
    private lateinit var tvLocationStatus: TextView
    private lateinit var tvDistance: TextView
    private lateinit var tvCurrentTime: TextView
    private lateinit var tvInternetStatus: TextView
    private lateinit var tvSchoolEndTime: TextView
    private lateinit var tvSchoolStartTime: TextView
    private lateinit var btnRequestPermission: Button
    private lateinit var btnOpenSchoolAppDashboard: Button
    private lateinit var cvPermissionStatus: CardView
    private lateinit var tvPermissionStatus: TextView
    private lateinit var tvPermissionTimer: TextView
    
    private lateinit var offlineMonitor: OfflineMonitor
    private lateinit var scheduleManager: SchoolScheduleManager
    private lateinit var firebaseReporter: FirebaseReporter

    private val handler = Handler(Looper.getMainLooper())
    private var lastGoodLocationAt: Long = 0L
    private var lastGoodLocation: Location? = null
    private var lastGpsUiKey: String? = null

    private val kioskStopReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "com.sekolah.edulock.ACTION_STOP_KIOSK" || 
                intent?.action == "com.sekolah.edulock.ACTION_DISMISS_LOCKSCREEN") {
                stopKioskMode()
                // Jika perlu, finish() juga bisa dilakukan jika logout, tapi biarkan logic intent yang menangani navigasi
                return
            }

            if (intent?.action == "com.sekolah.edulock.ACTION_START_KIOSK") {
                if (prefsManager.isHolidayMode) return
                if (!prefsManager.isProtectionActive) return
                if (permissionManager.isPermissionActive()) return
                if (!scheduleManager.isSchoolTime()) return
                startKioskMode()
            }
        }
    }

    private val LOCATION_PERMISSION_CODE = 100
    private val DEVICE_ADMIN_REQUEST = 101
    private val PERMISSION_CODE_REQUEST = 102
    private val OVERLAY_PERMISSION_REQUEST = 103

    // Koordinat sekolah (Default fallback, akan diupdate dari Firebase)
    private var SCHOOL_LAT = -7.2575
    private var SCHOOL_LON = 112.7521
    private var SCHOOL_RADIUS = 500.0

    private var schoolConfigListener: ValueEventListener? = null
    private var schoolConfigRef: com.google.firebase.database.DatabaseReference? = null
    private var schoolServiceStatusListener: ValueEventListener? = null
    private var schoolServiceStatusRef: com.google.firebase.database.DatabaseReference? = null
    private var hasTriggeredSchoolServiceExit = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Initialize
        devicePolicyManager = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        compName = ComponentName(this, DeviceAdminReceiver::class.java)
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        permissionManager = PermissionManager(this)
        prefsManager = PreferencesManager(this)
        offlineMonitor = OfflineMonitor(this, prefsManager)
        scheduleManager = SchoolScheduleManager(prefsManager)
        firebaseReporter = FirebaseReporter(this, prefsManager)

        // Load cached config first
        SCHOOL_LAT = prefsManager.schoolLatitude
        SCHOOL_LON = prefsManager.schoolLongitude
        SCHOOL_RADIUS = prefsManager.schoolRadius

        // Initialize FusedLocationProviderClient
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        
        // RESET FORCE LOCATION ON STARTUP (PENTING!)
        // Pastikan setiap kali aplikasi dibuka, mode paksa mati dulu agar tidak terjebak.
        prefsManager.isForcedLocation = false

        // PRIORITAS: Cek Emulator Sejak Awal
        // CATATAN: Jangan otomatis force lokasi, biarkan user memilih.
        // Jika otomatis di-force, user di rumah akan bingung kenapa terdeteksi di sekolah.
        if (isEmulator()) {
            prefsManager.isEmulator = true
        }
        
        // Initialize LocationCallback
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                for (location in locationResult.locations) {
                    // Cek Permission Mode
                    if (permissionManager.isPermissionActive()) {
                        tvLocationStatus.text = "Lokasi: MONITORING DI-PAUSE"
                        tvDistance.text = "Jarak: -- meter"
                        return
                    }

                    // FIX: Gunakan lokasi paksa jika mode emulator/debug aktif
                    // Ini mencegah MainActivity menggunakan lokasi asli (Googleplex) saat mode paksa aktif
                    var effectiveLocation = location
                    if (prefsManager.isForcedLocation && scheduleManager.isSchoolTime()) {
                        effectiveLocation = Location("FORCED_PROVIDER").apply {
                            latitude = SCHOOL_LAT
                            longitude = SCHOOL_LON
                            accuracy = 1.0f
                            time = System.currentTimeMillis()
                        }
                        // Update UI agar user tahu ini mode paksa
                        tvLocationStatus.text = "Lokasi: Di Area Sekolah (TEST MODE)"
                    }

                    checkLocation(effectiveLocation)
                    // Hapus deteksi Mock untuk emulator agar tidak bentrok
                    if (!prefsManager.isForcedLocation) {
                        detectMockLocation(effectiveLocation)
                    }
                }
            }
        }

        // Register Receiver for Kiosk Control
        val filter = android.content.IntentFilter()
        filter.addAction("com.sekolah.edulock.ACTION_STOP_KIOSK")
        filter.addAction("com.sekolah.edulock.ACTION_DISMISS_LOCKSCREEN")
        filter.addAction("com.sekolah.edulock.ACTION_START_KIOSK")
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(kioskStopReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(kioskStopReceiver, filter)
        }

        initViews()
        setupUI()
        setupSchoolAppButton() // Tambahan tombol Dashboard
        requestNecessaryPermissions()
        activateDeviceAdmin()
        startLocationMonitoring()
        startTimeUpdates()
        startPermissionTimerUpdates()
        checkGPSStatus()
        
        // Cek Emulator (UI Feedback Only)
        // Hapus logika paksa di sini, karena sudah ditangani di onCreate bagian awal
        // if (isEmulator()) {
        //     showToast("Emulator Terdeteksi: Lokasi Otomatis Diatur ke Sekolah")
        // }
        
        // Start Monitoring Service only if permission is granted
        startMonitoringServiceIfPossible()
        
        // Start School Config Listener
        startSchoolConfigListener()
        startSchoolServiceStatusListener()
    }
    
    private fun startSchoolConfigListener() {
        // Prevent duplicate listener
        if (schoolConfigListener != null) return

        val schoolId = prefsManager.schoolId.trim().lowercase()
        if (schoolId.isEmpty()) return

        val database = FirebaseDatabase.getInstance("https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app")
        schoolConfigRef = database.getReference("schools").child(schoolId).child("config")

        schoolConfigListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                try {
                    val latStr = snapshot.child("latitude").getValue(String::class.java) ?: snapshot.child("latitude").getValue(Double::class.java)?.toString()
                    val lonStr = snapshot.child("longitude").getValue(String::class.java) ?: snapshot.child("longitude").getValue(Double::class.java)?.toString()
                    val radStr = snapshot.child("radius").getValue(String::class.java) ?: snapshot.child("radius").getValue(Double::class.java)?.toString() ?: snapshot.child("radius").getValue(Int::class.java)?.toString()
                    val startTimeStr = snapshot.child("startTime").getValue(String::class.java)
                    val endTimeStr = snapshot.child("endTime").getValue(String::class.java)

                    if (latStr != null && lonStr != null) {
                        fun normalizeNumber(input: String): String {
                            return input.trim().replace(",", ".")
                        }

                        val newLat = normalizeNumber(latStr).toDouble()
                        val newLon = normalizeNumber(lonStr).toDouble()
                        val newRad = radStr?.let { normalizeNumber(it).toDouble() } ?: 500.0

                        // Update Variables
                        SCHOOL_LAT = newLat
                        SCHOOL_LON = newLon
                        SCHOOL_RADIUS = newRad

                        // Save to Prefs
                        prefsManager.schoolLatitude = newLat
                        prefsManager.schoolLongitude = newLon
                        prefsManager.schoolRadius = newRad
                        
                    }
                    
                    if (!startTimeStr.isNullOrEmpty() && !endTimeStr.isNullOrEmpty()) {
                        try {
                            val partsStart = startTimeStr.split(":")
                            val partsEnd = endTimeStr.split(":")
                            val sh = partsStart.getOrNull(0)?.toInt() ?: prefsManager.schoolStartHour
                            val sm = partsStart.getOrNull(1)?.toInt() ?: prefsManager.schoolStartMinute
                            val eh = partsEnd.getOrNull(0)?.toInt() ?: prefsManager.schoolEndHour
                            val em = partsEnd.getOrNull(1)?.toInt() ?: prefsManager.schoolEndMinute
                            prefsManager.schoolStartHour = sh
                            prefsManager.schoolStartMinute = sm
                            prefsManager.schoolEndHour = eh
                            prefsManager.schoolEndMinute = em
                        } catch (_: Exception) { }
                    }
                    
                    try {
                        updateMonitoringUI()
                    } catch (_: Exception) {
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            override fun onCancelled(error: DatabaseError) {
                // Ignore
            }
        }
        schoolConfigRef?.addValueEventListener(schoolConfigListener!!)
    }

    private fun startMonitoringServiceIfPossible() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            val intent = Intent(this, MonitoringService::class.java)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == LOCATION_PERMISSION_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startMonitoringServiceIfPossible()
                startLocationMonitoring()
            } else {
                Toast.makeText(this, "Izin Lokasi Dibutuhkan untuk Monitoring!", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        prefsManager.isUiForeground = true
        prefsManager.uiForegroundAt = System.currentTimeMillis()

        try {
            val ping = Intent(this, MonitoringService::class.java)
            ping.action = "com.sekolah.edulock.ACTION_UI_FOREGROUND"
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(ping)
            } else {
                startService(ping)
            }
        } catch (_: Exception) {
        }
        
        // 0. REDIRECT TO SETUP IF NOT COMPLETE (ONBOARDING)
        // Ini menangani saran user agar tidak langsung "menyerang" dengan banyak dialog saat pertama instal
        if (!prefsManager.isSetupCompleted) {
             startActivity(Intent(this, SetupActivity::class.java))
             finish()
             return
        }
        
        // Ensure Fullscreen
        hideSystemUI()

        // RESET FLAG isSettingsOpen
        // Ini memastikan jika user kembali ke app, proteksi aktif lagi
        prefsManager.isSettingsOpen = false
        prefsManager.settingsGraceUntil = 0L
        
        // Reset flags
        isOpeningInternalActivity = false

        // Reset flag isOpeningSettings tapi beri sedikit delay atau cek kondisi
        // Agar tidak langsung lock saat baru balik dari settings
        Handler(Looper.getMainLooper()).postDelayed({
             isOpeningSettings = false
        }, 2000) // Delay 2 detik untuk safety

        // Stop setup protection overlay saat kembali ke aplikasi
        try {
            stopService(Intent(this, SetupProtectionService::class.java))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        
        // 0. Cek Permission Lokasi (Wajib Paling Awal)
        checkAndEnforcePermissions()
        // Stop jika izin lokasi belum diberikan agar tidak bentrok dengan dialog Admin
        if (androidx.core.app.ActivityCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
             return
        }
        
        // 0.5 CEK UNINSTALL AUTHORIZATION (PENTING)
        if (prefsManager.isUninstallAuthorized) {
            showUninstallModeUI()
            return // Stop checks lain jika mode uninstall aktif
        }

        // 1. Cek Device Admin (Wajib)
        checkAndEnforceDeviceAdmin()
        
        // JIKA ADMIN BELUM AKTIF, STOP DI SINI (Jangan lanjut ke Accessibility)
        // Ini mencegah dialog bertumpuk/konflik
        if (!devicePolicyManager.isAdminActive(compName)) {
            return
        }
        
        // 2. Cek Accessibility Service (Wajib untuk Anti-Uninstall Kuat)
        checkAndEnforceAccessibilityService()

        // 3. Cek Battery Optimization (Wajib agar tidak sleep kill)
        checkAndEnforceBatteryOptimization()

        // 4. Resume session monitoring if active
        val isSchoolTime = scheduleManager.isSchoolTime()
        // CEK MODE ACARA / LIBUR
        if (prefsManager.isHolidayMode) {
             // Opsional: Tampilkan toast
             // Toast.makeText(this, "Mode Acara Aktif", Toast.LENGTH_SHORT).show()
        } else if (permissionManager.isPermissionActive() || !isSchoolTime) {
            val nisn = prefsManager.nisn
            if (nisn.isNotEmpty() && permissionManager.isPermissionActive()) {
                permissionManager.resumeSession(nisn)
            }
            // Unlock device if permission is active OR outside school time
            stopKioskMode()
        } else {
            // Lock device if permission is NOT active AND inside school time
            
            // AGGRESSIVE LOCK: Panggil langsung tanpa delay jika jelas-jelas harus terkunci
            // Delay hanya untuk UI setup pertama kali, tapi di onResume harus sigap
            
            // FIX: Cek Global Protection (Silent Mode) sebelum locking
            if (!prefsManager.isProtectionActive) {
                stopKioskMode()
            } else {
                if (isEmulator()) {
                     startKioskMode()
                } else {
                    Handler(Looper.getMainLooper()).postDelayed({
                        if (!permissionManager.isPermissionActive() && scheduleManager.isSchoolTime()) {
                            // Double check holiday mode & protection inside delay
                            if (!prefsManager.isHolidayMode && prefsManager.isProtectionActive) {
                                startKioskMode()
                            }
                        }
                    }, 1000) // Kurangi delay jadi 1 detik
                }
            }
        }
        
        // 4. Update UI & Monitoring
        updatePermissionStatusUI()
        
        // Ensure button is visible when returning to app
        if (::btnOpenSchoolAppDashboard.isInitialized) {
            setupSchoolAppButton()
        }

        startLocationMonitoring()
        startPermissionTimerUpdates()
        startMonitoringServiceIfPossible()
        if (!hasTriggeredSchoolServiceExit) {
            startSchoolServiceStatusListener()
        }
    }

    private fun startSchoolServiceStatusListener() {
        if (schoolServiceStatusListener != null) return

        val schoolId = SchoolServiceGuard.normalizeSchoolId(prefsManager.schoolId)
        if (schoolId.isEmpty()) return

        val database = SchoolServiceGuard.database()
        schoolServiceStatusRef = database.getReference("schools").child(schoolId)
        schoolServiceStatusListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                if (!snapshot.exists()) return
                if (SchoolServiceGuard.isSchoolServiceActive(snapshot)) return
                forceExitBecauseSchoolInactive()
            }

            override fun onCancelled(error: DatabaseError) {
                // Ignore and keep app usable while offline.
            }
        }
        schoolServiceStatusRef?.addValueEventListener(schoolServiceStatusListener!!)
    }

    private fun forceExitBecauseSchoolInactive() {
        if (hasTriggeredSchoolServiceExit) return
        hasTriggeredSchoolServiceExit = true

        stopKioskMode()
        prefsManager.isRegistered = false
        prefsManager.isSetupCompleted = false

        try {
            stopService(Intent(this, MonitoringService::class.java))
        } catch (_: Exception) {
        }

        AlertDialog.Builder(this)
            .setTitle("Layanan Sekolah Nonaktif")
            .setMessage(SchoolServiceGuard.inactiveMessage())
            .setCancelable(false)
            .setPositiveButton("OK") { _, _ ->
                val intent = Intent(this, RegistrationActivity::class.java)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                intent.putExtra("ERROR_MESSAGE", SchoolServiceGuard.inactiveMessage())
                startActivity(intent)
                finish()
            }
            .show()
    }

    private fun showUninstallModeUI() {
        // Stop Kiosk Mode jika aktif
        stopKioskMode()
        
        // Tampilkan Dialog/Overlay yang tidak bisa dicancel tapi berisi tombol uninstall
        val builder = AlertDialog.Builder(this)
        builder.setTitle("⚠️ MODE UNINSTALL AKTIF ⚠️")
        builder.setMessage("Aplikasi telah diizinkan untuk dihapus oleh Admin Sekolah.\n\nSilakan klik tombol di bawah untuk menghapus aplikasi.")
        builder.setCancelable(false)
        
        builder.setPositiveButton("🗑️ UNINSTALL SEKARANG") { _, _ ->
            try {
                // Pastikan admin nonaktif dulu (double check)
                if (devicePolicyManager.isAdminActive(compName)) {
                    devicePolicyManager.removeActiveAdmin(compName)
                }
                
                val intent = Intent(Intent.ACTION_DELETE)
                intent.data = android.net.Uri.parse("package:$packageName")
                startActivity(intent)
                
                // Tutup app agar tidak mengganggu
                finish()
            } catch (e: Exception) {
                Toast.makeText(this, "Gagal memulai uninstall: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
        
        builder.setNegativeButton("Batal (Tetap Pakai)") { _, _ ->
            // Reset status jika user membatalkan (opsional, tapi sebaiknya jangan biar konsisten dengan server)
            // prefsManager.isUninstallAuthorized = false 
            // Tapi karena ini dari server, kita tidak boleh ubah lokal saja. Biarkan tetap true.
            Toast.makeText(this, "Mode Uninstall masih aktif. Restart aplikasi jika berubah pikiran.", Toast.LENGTH_SHORT).show()
        }
        
        builder.show()
    }

    private var accessibilityDialog: AlertDialog? = null

    private fun checkAndEnforceAccessibilityService() {
         if (prefsManager.isUninstallAuthorized) return // Skip jika mode uninstall

         if (!isAccessibilityServiceEnabled()) {
             val isSchoolTime = scheduleManager.isSchoolTime()
             if (prefsManager.isProtectionActive &&
                 isSchoolTime &&
                 prefsManager.isInsideSchoolZone &&
                 !prefsManager.isHolidayMode &&
                 !permissionManager.isPermissionActive()
             ) {
                 showLockdownOverlay(
                     "PROTEKSI WAJIB AKTIF!\n\nBuka Aksesibilitas > Layanan Terinstall > EduLock Protection -> AKTIFKAN.",
                     "accessibility"
                 )
             }

             // Cek apakah dialog sudah tampil agar tidak menumpuk
             if (accessibilityDialog?.isShowing == true) return

             dialogCount++
             val builder = AlertDialog.Builder(this)
                 .setTitle("Wajib Aktifkan Proteksi")
                 .setMessage("EduLock memerlukan 'Layanan Aksesibilitas' agar tidak mudah dihapus.\n\n1. Klik 'Buka Pengaturan'\n2. Cari 'Aksesibilitas' > 'Layanan Terinstall' (Installed Services)\n3. Pilih 'EduLock Protection' -> AKTIFKAN")
                 .setCancelable(false)
                 .setPositiveButton("Buka Pengaturan") { _, _ ->
                     // SET FLAG IZIN KELUAR
                     isOpeningSettings = true
                    prefsManager.isSettingsOpen = true
                    prefsManager.settingsGraceUntil = System.currentTimeMillis() + 120_000L
                     
                     // Stop Kiosk Mode sementara (penting untuk real device)
                     stopKioskMode()

                     // Start Protection Service
                     try {
                         val intent = Intent(this, SetupProtectionService::class.java)
                         startService(intent)
                     } catch (e: Exception) {
                         e.printStackTrace()
                     }

                     // Coba buka halaman spesifik accessibility settings
                     try {
                         val intent = Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS)
                         intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                         startActivity(intent)
                     } catch (e: Exception) {
                         // Fallback ke settings utama jika gagal
                         try {
                             startActivity(Intent(android.provider.Settings.ACTION_SETTINGS))
                         } catch (e2: Exception) {
                             Toast.makeText(this, "Tidak bisa membuka pengaturan otomatis. Silakan buka manual.", Toast.LENGTH_LONG).show()
                         }
                     }
                 }
                 .setNegativeButton("Sudah Aktif", null) // Null agar tidak auto-dismiss
                 .setOnDismissListener { dialogCount-- }

             accessibilityDialog = builder.create()
             
             accessibilityDialog?.setOnShowListener {
                 val button = accessibilityDialog?.getButton(AlertDialog.BUTTON_NEGATIVE)
                 button?.setOnClickListener {
                     if (isAccessibilityServiceEnabled()) {
                         accessibilityDialog?.dismiss()
                         Toast.makeText(this, "Proteksi Berhasil Diaktifkan!", Toast.LENGTH_SHORT).show()
                     } else {
                         Toast.makeText(this, "Status: NON-AKTIF.\nCari 'EduLock Protection' di menu Aksesibilitas dan AKTIFKAN.", Toast.LENGTH_LONG).show()
                     }
                 }
             }
                 
             accessibilityDialog?.show()
         } else {
             // AUTO-DISMISS jika sudah aktif saat kembali ke activity
             if (accessibilityDialog?.isShowing == true) {
                 accessibilityDialog?.dismiss()
             }
         }
     }
     
     private var permissionDialog: AlertDialog? = null

    private fun checkAndEnforcePermissions() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
             if (permissionDialog?.isShowing == true) return

             permissionDialog = AlertDialog.Builder(this)
                 .setTitle("Izin Lokasi Wajib")
                 .setMessage("Aplikasi ini WAJIB menggunakan akses lokasi (GPS) untuk berfungsi.\n\nTanpa izin ini, aplikasi tidak bisa melanjutkan.\n\nMohon klik 'Buka Pengaturan' > 'Izin' > 'Lokasi' > Pilih 'Izinkan'.")
                 .setCancelable(false)
                 .setPositiveButton("Buka Pengaturan") { _, _ ->
                     // SET FLAG IZIN KELUAR
                     isOpeningSettings = true
                     stopKioskMode()

                     try {
                         val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                         val uri = android.net.Uri.fromParts("package", packageName, null)
                         intent.data = uri
                         startActivity(intent)
                     } catch (e: Exception) {
                         // Fallback
                         requestNecessaryPermissions()
                     }
                 }
                 .setNegativeButton("Coba Lagi") { _, _ ->
                     requestNecessaryPermissions()
                 }
                 .setOnDismissListener { dialogCount-- }
                 .create()
             
             permissionDialog?.show()
        } else {
            // Jika sudah diizinkan, tutup dialog jika masih muncul
            permissionDialog?.dismiss()
        }
    }

    private fun checkAndEnforceBatteryOptimization() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
                // Cek apakah dialog sudah tampil
                if (dialogCount > 0) return 

                dialogCount++
                val builder = AlertDialog.Builder(this)
                    .setTitle("Izin Baterai Diperlukan")
                    .setMessage("Agar aplikasi tidak mati saat layar terkunci, mohon izinkan aplikasi berjalan di latar belakang (Abaikan Optimasi Baterai).")
                    .setCancelable(false)
                    .setPositiveButton("Izinkan") { _, _ ->
                        val intent = Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                        intent.data = android.net.Uri.parse("package:$packageName")
                        try {
                            startActivity(intent)
                        } catch (e: Exception) {
                            Toast.makeText(this, "Gagal membuka dialog. Silakan atur manual di Pengaturan > Aplikasi > Baterai.", Toast.LENGTH_LONG).show()
                        }
                    }
                    .setOnDismissListener { dialogCount-- }
                
                builder.create().show()
            }
        }
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val am = getSystemService(Context.ACCESSIBILITY_SERVICE) as android.view.accessibility.AccessibilityManager
        val enabledServices = am.getEnabledAccessibilityServiceList(android.accessibilityservice.AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
        for (service in enabledServices) {
            if (service.resolveInfo.serviceInfo.packageName == packageName &&
                service.resolveInfo.serviceInfo.name.endsWith(AntiUninstallService::class.java.simpleName)) {
                return true
            }
        }
        return false
    }

    private var lastKioskAttemptTime: Long = 0
    private var isKioskModeActive: Boolean = false
    private var isOpeningSettings: Boolean = false
    private var isOpeningInternalActivity: Boolean = false
    private var dialogCount: Int = 0 // Counter to track open dialogs and prevent focus loss issues
    private var isRequestingAdmin: Boolean = false

    private fun startKioskMode() {
        // Cek flag lokal dulu untuk mencegah spamming internal
        if (isKioskModeActive) return

        // ALWAYS Hide System UI when Kiosk Mode starts
        hideSystemUI()

        // HAPUS PENGECUALIAN EMULATOR:
        // User meminta tombol Overview benar-benar mati.
        // Kita aktifkan Screen Pinning (startLockTask) untuk SEMUA device termasuk Emulator.
        // if (isEmulator()) { ... } -> REMOVED

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                try {
                    if (devicePolicyManager.isDeviceOwnerApp(packageName)) {
                        devicePolicyManager.setLockTaskPackages(
                            compName,
                            arrayOf(packageName, "com.sekolah.aplikasismpn3pacet")
                        )
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            devicePolicyManager.setLockTaskFeatures(
                                compName,
                                DevicePolicyManager.LOCK_TASK_FEATURE_NONE
                            )
                        }
                    }
                } catch (_: Exception) {
                }
            }

            // Cek status sistem (Real Device)
            val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
            var isSystemLocked = false
            
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                if (activityManager.lockTaskModeState != android.app.ActivityManager.LOCK_TASK_MODE_NONE) {
                    isSystemLocked = true
                }
            } else {
                @Suppress("DEPRECATION")
                if (activityManager.isInLockTaskMode) {
                    isSystemLocked = true
                }
            }

            if (isSystemLocked) {
                isKioskModeActive = true
                return 
            }

            // Throttle: Jangan panggil terlalu sering (max 1x per 10 detik)
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastKioskAttemptTime < 10000) {
                return
            }
            lastKioskAttemptTime = currentTime
            
            // Start Screen Pinning
            startLockTask()
            isKioskModeActive = true
            
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Failed to start lock task: ${e.message}")
        }
    }

    private fun stopKioskMode() {
        try {
            stopLockTask()
            isKioskModeActive = false
        } catch (e: Exception) {
            // Ignore
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        
        // IZINKAN KELUAR JIKA MODE ACARA / LIBUR ATAU SILENT MODE
        if (prefsManager.isHolidayMode || !prefsManager.isProtectionActive) {
            return
        }
        
        // IZINKAN KELUAR JIKA MEMBUKA PENGATURAN ATAU INTERNAL ACTIVITY
        if (isOpeningSettings || isOpeningInternalActivity) {
            return
        }

        // Diteksi tombol Home ditekan
        if (scheduleManager.isSchoolTime() && !permissionManager.isPermissionActive() && !prefsManager.isHolidayMode && prefsManager.isProtectionActive) {
            val distance = try {
                tvDistance.text.toString().replace("Jarak: ", "").replace(" meter", "").toDouble()
            } catch (e: Exception) { 0.0 }

            if (distance <= SCHOOL_RADIUS || prefsManager.isEmulator) {
                // Paksa kembali ke aplikasi jika mencoba keluar (Home Button)
                val intent = Intent(this, MainActivity::class.java)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                startActivity(intent)
                
                showToast("Dilarang keluar aplikasi saat jam sekolah!")
            }
        }
    }

    override fun onBackPressed() {
        if (prefsManager.isHolidayMode || permissionManager.isPermissionActive() || !prefsManager.isProtectionActive) {
            super.onBackPressed()
        } else {
            // Prevent back button if locked
            Toast.makeText(this, "HP Terkunci! Minta izin guru untuk membuka.", Toast.LENGTH_SHORT).show()
        }
    }


    private fun setupSchoolAppButton() {
        val targetPackage = "com.sekolah.aplikasismpn3pacet"
        // Toast.makeText(this, "Debug: Cek App Sekolah...", Toast.LENGTH_SHORT).show()
        try {
            packageManager.getPackageInfo(targetPackage, 0)
            btnOpenSchoolAppDashboard.visibility = View.VISIBLE
            btnOpenSchoolAppDashboard.text = "BUKA APLIKASI SEKOLAH"
            btnOpenSchoolAppDashboard.isEnabled = true
            btnOpenSchoolAppDashboard.backgroundTintList = android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#1976D2")) // Biru
            
            btnOpenSchoolAppDashboard.setOnClickListener {
                try {
                    val launchIntent = packageManager.getLaunchIntentForPackage(targetPackage)
                    
                    // Visual feedback
                    Toast.makeText(this, "Membuka Aplikasi Sekolah...", Toast.LENGTH_SHORT).show()

                    if (launchIntent != null) {
                        // 1. Matikan Kiosk Mode sementara
                        stopKioskMode()
                        
                        // 2. Set Flag agar onPause tidak menarik kembali (PENTING!)
                        isOpeningInternalActivity = true
                        
                        // 3. Pre-whitelist agar tidak dibunuh MonitoringService
            prefsManager.lastForegroundPackage = targetPackage
            prefsManager.appSwitchTimestamp = System.currentTimeMillis() // Set Timestamp untuk Grace Period
            
            // 4. Launch dengan delay agar stopLockTask selesai
                        Handler(Looper.getMainLooper()).postDelayed({
                            try {
                                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
                                startActivity(launchIntent)
                            } catch (e: Exception) {
                                Toast.makeText(this, "Gagal: ${e.message}", Toast.LENGTH_LONG).show()
                                // Re-lock jika gagal (dan kondisi terpenuhi)
                                if (!permissionManager.isPermissionActive() && scheduleManager.isSchoolTime() && prefsManager.isProtectionActive) {
                                     startKioskMode()
                                }
                            }
                        }, 300)
                    } else {
                        Toast.makeText(this, "Gagal meluncurkan aplikasi.", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    Toast.makeText(this, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        } catch (e: Exception) {
            // App tidak ditemukan -> Tetap tampilkan tombol tapi disable (feedback visual)
            btnOpenSchoolAppDashboard.visibility = View.VISIBLE
            btnOpenSchoolAppDashboard.text = "APP SEKOLAH BELUM TERDETEKSI\n(Install: com.sekolah.aplikasismpn3pacet)"
            btnOpenSchoolAppDashboard.isEnabled = false
            btnOpenSchoolAppDashboard.backgroundTintList = android.content.res.ColorStateList.valueOf(android.graphics.Color.GRAY)
        }
    }

    private fun initViews() {
        tvAppTitle = findViewById(R.id.tvAppTitle)
        tvStudentName = findViewById(R.id.tvStudentName)
        tvClass = findViewById(R.id.tvClass)
        tvGPSStatus = findViewById(R.id.tvGPSStatus)
        tvLocationStatus = findViewById(R.id.tvLocationStatus)
        tvDistance = findViewById(R.id.tvDistance)
        tvCurrentTime = findViewById(R.id.tvCurrentTime)
        tvInternetStatus = findViewById(R.id.tvInternetStatus)
        tvSchoolEndTime = findViewById(R.id.tvSchoolEndTime)
        tvSchoolStartTime = findViewById(R.id.tvSchoolStartTime)
        
        btnRequestPermission = findViewById(R.id.btnRequestPermission)
        cvPermissionStatus = findViewById(R.id.cvPermissionStatus)
        tvPermissionStatus = findViewById(R.id.tvPermissionStatus)
        tvPermissionTimer = findViewById(R.id.tvPermissionTimer)
        btnOpenSchoolAppDashboard = findViewById(R.id.btnSchoolAppFallback)
    }

    private fun setupUI() {
        // Set student info
        tvStudentName.text = prefsManager.studentName
        tvClass.text = prefsManager.studentClass

        // Setup button listener
        btnRequestPermission.setOnClickListener {
            showPermissionDialog()
        }

        // HIDDEN BACKDOOR: Long Click pada Judul "EduLock" untuk akses menu Admin
        // EMERGENCY DEBUG TRIGGER
        // Klik pada teks status lokasi akan TOGGLE lokasi sekolah/luar (untuk testing/emulator)
        tvLocationStatus.setOnClickListener {
            // Batasi HANYA untuk emulator agar siswa tidak bisa curang di HP nyata
            if (isEmulator() || prefsManager.isEmulator) {
                if (prefsManager.isForcedLocation) {
                    resetLocationMode()
                } else {
                    forceSchoolLocation("Manual Click")
                }
            } else {
                Toast.makeText(this, "Lokasi ditentukan oleh GPS. Tidak bisa diubah manual.", Toast.LENGTH_SHORT).show()
            }
        }
        
        // TAMBAHAN: Toast hint untuk user emulator
        if (isEmulator()) {
             Toast.makeText(this, "Mode Emulator: Klik teks 'Lokasi' untuk ubah posisi (Sekolah/Luar)", Toast.LENGTH_LONG).show()
        }

        // Update permission status UI
        updatePermissionStatusUI()
        
        // Ensure button is set up
        setupSchoolAppButton()
    }

    private fun showPermissionDialog() {
        dialogCount++
        val options = arrayOf(
            "📝 Input Kode dari Guru",
            "📷 Scan Barcode/QR Code"
        )

        AlertDialog.Builder(this)
            .setTitle("Minta Izin Penggunaan HP")
            .setItems(options) { dialog, which ->
                when (which) {
                    0 -> {
                        // Input Kode Manual
                        isOpeningInternalActivity = true
                        val intent = Intent(this, PermissionCodeActivity::class.java)
                        startActivityForResult(intent, PERMISSION_CODE_REQUEST)
                    }
                    1 -> {
                        // Scan Barcode
                        isOpeningInternalActivity = true
                        val intent = Intent(this, BarcodeScannerActivity::class.java)
                        startActivityForResult(intent, PERMISSION_CODE_REQUEST)
                    }
                }
                dialog.dismiss()
            }
            .setNegativeButton("Batal", null)
            .setOnDismissListener { dialogCount-- }
            .show()
    }

    private fun showAdminLoginOptions() {
        dialogCount++
        val options = arrayOf(
            "🔑 Input Password Manual",
            "📷 Scan QR Code Admin"
        )

        AlertDialog.Builder(this)
            .setTitle("Login Admin")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> showAdminPasswordInput()
                    1 -> startAdminQRScan()
                }
            }
            .setNegativeButton("Batal", null)
            .setOnDismissListener { dialogCount-- }
            .show()
    }

    private fun startAdminQRScan() {
        val integrator = IntentIntegrator(this)
        integrator.setPrompt("Scan QR Code Password Admin")
        integrator.setBeepEnabled(true)
        integrator.setOrientationLocked(false)
        integrator.initiateScan()
    }

    private fun validateUninstallAccessCode(input: String, callback: (Boolean, String?) -> Unit) {
        val nisn = prefsManager.nisn
        if (nisn.isEmpty()) {
            callback(false, "NISN belum terdaftar.")
            return
        }

        if (prefsManager.isUninstallAuthorized) {
            callback(true, null)
            return
        }

        val codeInput = input.trim()
        if (codeInput.isEmpty()) {
            callback(false, "Masukkan kode uninstall.")
            return
        }

        val database = FirebaseDatabase.getInstance("https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app")
        val studentRef = database.getReference("students").child(nisn).child("schoolId")

        studentRef.addListenerForSingleValueEvent(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val schoolId = snapshot.getValue(String::class.java)?.trim()?.lowercase() ?: ""
                if (schoolId.isEmpty()) {
                    callback(false, "Sekolah belum terdeteksi untuk siswa ini.")
                    return
                }

                val uninstallRef = database.getReference("schools").child(schoolId).child("uninstallAccess")
                uninstallRef.addListenerForSingleValueEvent(object : ValueEventListener {
                    override fun onDataChange(uninstallSnap: DataSnapshot) {
                        val serverCode = uninstallSnap.child("code").getValue(String::class.java)?.trim() ?: ""
                        val expiresAt = uninstallSnap.child("expiresAt").getValue(Long::class.java) ?: 0L
                        val now = System.currentTimeMillis()

                        if (serverCode.isEmpty() || expiresAt <= 0L) {
                            callback(false, "Kode uninstall belum tersedia. Hubungi admin sekolah/super admin.")
                            return
                        }

                        if (now > expiresAt) {
                            callback(false, "Kode uninstall sudah kedaluwarsa. Minta kode baru.")
                            return
                        }

                        if (codeInput.equals(serverCode, ignoreCase = true)) {
                            callback(true, null)
                        } else {
                            callback(false, "Kode uninstall salah.")
                        }
                    }

                    override fun onCancelled(error: DatabaseError) {
                        callback(false, "Gagal memvalidasi kode. Periksa koneksi internet.")
                    }
                })
            }

            override fun onCancelled(error: DatabaseError) {
                callback(false, "Gagal memuat data sekolah. Periksa koneksi internet.")
            }
        })
    }

    private fun showAdminPasswordInput() {
        dialogCount++
        val input = EditText(this)
        input.hint = "Masukkan Password Admin"
        input.inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD

        AlertDialog.Builder(this)
            .setTitle("Login Admin")
            .setMessage("Masukkan password admin untuk mengakses menu ini.")
            .setView(input)
            .setPositiveButton("Login") { _, _ ->
                val password = input.text.toString()
                validateUninstallAccessCode(password) { ok, message ->
                    runOnUiThread {
                        if (ok) {
                            showAdminPanel()
                        } else {
                            Toast.makeText(this, message ?: "Akses ditolak.", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            }
            .setNegativeButton("Batal", null)
            .setOnDismissListener { dialogCount-- }
            .show()
    }

    private fun showAdminPanel() {
        val options = arrayOf(
            "🗑️ Uninstall Aplikasi",
            "🔄 Reset Device ID"
        )

        AlertDialog.Builder(this)
            .setTitle("Menu Admin")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> confirmUninstall()
                    1 -> resetDeviceId()
                }
            }
            .setPositiveButton("Tutup", null)
            .show()
    }

    private fun confirmUninstall() {
        AlertDialog.Builder(this)
            .setTitle("Konfirmasi Uninstall")
            .setMessage("Apakah Anda yakin ingin menghapus aplikasi EduLock? Proteksi akan dinonaktifkan.")
            .setPositiveButton("Ya, Hapus") { _, _ ->
                uninstallApp()
            }
            .setNegativeButton("Batal", null)
            .show()
    }

    private fun uninstallApp() {
        // 0. Set Authorized Flag agar AntiUninstallService tidak memblokir
        prefsManager.isUninstallAuthorized = true
        
        // FIX: Lapor status Offline dulu ke Firebase sebelum app mati total!
        // Ini agar Dashboard langsung update jadi "Offline" dan tidak nyangkut.
        try {
            firebaseReporter.reportOffline()
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // 1. Nonaktifkan Device Admin
        if (devicePolicyManager.isAdminActive(compName)) {
            devicePolicyManager.removeActiveAdmin(compName)
        }

        // 2. Stop Kiosk Mode jika aktif
        stopKioskMode()

        // 3. Trigger Uninstall Intent
        val intent = Intent(Intent.ACTION_DELETE)
        intent.data = android.net.Uri.parse("package:$packageName")
        startActivity(intent)
    }

    private fun resetDeviceId() {
        prefsManager.deviceId = ""
        Toast.makeText(this, "Device ID direset. Silakan registrasi ulang.", Toast.LENGTH_SHORT).show()
        // Optional: Logout user
    }

    private fun updatePermissionStatusUI() {
        if (permissionManager.isPermissionActive()) {
            // Permission aktif
            cvPermissionStatus.visibility = View.VISIBLE
            btnRequestPermission.isEnabled = false
            btnRequestPermission.text = "Izin Sedang Aktif"
            btnRequestPermission.backgroundTintList = ContextCompat.getColorStateList(this, android.R.color.darker_gray)

            val remaining = permissionManager.getRemainingTimeFormatted()
            tvPermissionStatus.text = "✅ Monitoring DI-PAUSE"
            tvPermissionTimer.text = "Sisa waktu: $remaining"

        } else {
            // Permission tidak aktif
            cvPermissionStatus.visibility = View.GONE
            btnRequestPermission.isEnabled = true
            btnRequestPermission.text = "Minta Izin Penggunaan HP"
            btnRequestPermission.backgroundTintList = ContextCompat.getColorStateList(this, R.color.success)
        }
    }

    private var timerRunnable: Runnable? = null

    private fun startPermissionTimerUpdates() {
        // Hentikan timer sebelumnya jika ada untuk menghindari duplikasi
        stopPermissionTimerUpdates()
        
        timerRunnable = object : Runnable {
            override fun run() {
                updatePermissionStatusUI()
                handler.postDelayed(this, 1000) // Update setiap 1 detik
            }
        }
        handler.post(timerRunnable!!)
    }
    
    private fun stopPermissionTimerUpdates() {
        timerRunnable?.let { handler.removeCallbacks(it) }
        timerRunnable = null
    }

    override fun onPause() {
        super.onPause()
        stopPermissionTimerUpdates()
        try {
            prefsManager.isUiForeground = false
            prefsManager.uiForegroundAt = System.currentTimeMillis()
        } catch (_: Exception) {
        }
        try {
            fusedLocationClient.removeLocationUpdates(locationCallback)
        } catch (_: Exception) { }
        try {
            locationManager.removeUpdates(locationListenerLegacy)
        } catch (_: Exception) { }

        // PROTEKSI AGRESIF: Jika user menekan tombol Recent Apps / Home dan aplikasi masuk background
        // Cek Silent Mode juga
        if (!isOpeningSettings && !isOpeningInternalActivity && !prefsManager.isHolidayMode && scheduleManager.isSchoolTime() && !permissionManager.isPermissionActive() && prefsManager.isProtectionActive) {
            // Cek apakah emulator (emulator kadang false positive di background)
            if (!prefsManager.isEmulator) {
                // Paksa aplikasi kembali ke depan
                val intent = Intent(this, MainActivity::class.java)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                startActivity(intent)
            }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            // Saat aplikasi fokus, pastikan Fullscreen (Immersive)
            hideSystemUI()
        } else {
            // Saat kehilangan fokus (misal user tarik status bar atau tekan Recent Apps)
            // JANGAN lakukan apa-apa jika sedang menampilkan dialog sendiri ATAU Silent Mode aktif
            if (!isOpeningSettings && !isOpeningInternalActivity && dialogCount == 0 && !prefsManager.isHolidayMode && scheduleManager.isSchoolTime() && !permissionManager.isPermissionActive() && prefsManager.isProtectionActive) {
                // Tutup semua dialog sistem (Notification Shade, Recent Apps)
                collapseSystemUI()
                
                // Paksa tutup dialog sistem lagi dengan delay kecil untuk memastikan
                Handler(Looper.getMainLooper()).postDelayed({
                    collapseSystemUI()
                }, 500)
            }
        }
    }

    private fun requestNecessaryPermissions() {
        val permissions = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.ACCESS_BACKGROUND_LOCATION
        )

        ActivityCompat.requestPermissions(this, permissions, LOCATION_PERMISSION_CODE)
    }



    private fun checkAndEnforceOverlayPermission() {
        if (!android.provider.Settings.canDrawOverlays(this)) {
            // Cek apakah dialog sudah tampil
            if (overlayDialog?.isShowing == true) return

            dialogCount++
            overlayDialog = AlertDialog.Builder(this)
                .setTitle("Izin Tampilan di Atas Aplikasi Lain")
                .setMessage("Aplikasi ini memerlukan izin 'Tampilkan di atas aplikasi lain' agar fitur penguncian layar berfungsi.\n\nSilakan cari 'EduLock' dan AKTIFKAN.")
                .setCancelable(false)
                .setPositiveButton("Buka Pengaturan") { _, _ ->
                    // IZINKAN KELUAR
                    isOpeningSettings = true
                    prefsManager.isSettingsOpen = true
                    prefsManager.settingsGraceUntil = System.currentTimeMillis() + 120_000L
                    stopKioskMode()

                    val intent = Intent(
                        android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        android.net.Uri.parse("package:$packageName")
                    )
                    startActivityForResult(intent, OVERLAY_PERMISSION_REQUEST)
                }
                .setOnDismissListener { dialogCount-- }
                .create()
            
            overlayDialog?.show()
        } else {
            if (overlayDialog?.isShowing == true) {
                overlayDialog?.dismiss()
            }
        }
    }
    
    private var overlayDialog: AlertDialog? = null


    private var adminDialog: AlertDialog? = null

    private fun checkAndEnforceDeviceAdmin() {
        if (prefsManager.isUninstallAuthorized) return // Skip jika mode uninstall
        if (isRequestingAdmin) return // Skip jika sedang dalam proses request

        if (!devicePolicyManager.isAdminActive(compName)) {
            if (adminDialog?.isShowing == true) return

            dialogCount++
            val builder = AlertDialog.Builder(this)
                .setTitle("Wajib Aktivasi Admin")
                .setMessage("Aplikasi ini tidak akan berfungsi tanpa izin Administrator Perangkat.\n\nKlik 'Aktifkan' lalu pilih 'Activate' pada layar berikutnya.")
                .setCancelable(false)
                .setPositiveButton("Aktifkan") { _, _ ->
                    activateDeviceAdmin()
                }
                .setNegativeButton("Sudah Aktif", null) // Null agar tidak auto-dismiss (dihandle di onShow)
                .setOnDismissListener { dialogCount-- }
                
            adminDialog = builder.create()
            
            adminDialog?.setOnShowListener {
                val button = adminDialog?.getButton(AlertDialog.BUTTON_NEGATIVE)
                button?.setOnClickListener {
                     // Tombol Cek Manual
                     if (devicePolicyManager.isAdminActive(compName)) {
                         adminDialog?.dismiss()
                         Toast.makeText(this, "Admin Aktif! Proteksi Dimulai.", Toast.LENGTH_SHORT).show()
                     } else {
                         Toast.makeText(this, "Admin Belum Terdeteksi! Pastikan switch sudah ON.", Toast.LENGTH_LONG).show()
                         // Dialog TIDAK akan tertutup
                     }
                }
            }
                
            adminDialog?.show()
        } else {
            // AUTO-DISMISS jika sudah aktif saat kembali ke activity
            if (adminDialog?.isShowing == true) {
                adminDialog?.dismiss()
            }
        }
    }

    private fun activateDeviceAdmin() {
        if (!devicePolicyManager.isAdminActive(compName)) {
            // IZINKAN KELUAR UNTUK KE SETTINGS
            isOpeningSettings = true
            isRequestingAdmin = true // Tandai sedang request
            prefsManager.isSettingsOpen = true // Flag untuk MonitoringService agar tidak kill settings
            prefsManager.settingsGraceUntil = System.currentTimeMillis() + 120_000L
            stopKioskMode()

            // PASTIKAN OVERLAY MATI AGAR TIDAK BLOKIR TOMBOL "ACTIVATE"
            try {
                stopService(Intent(this, SetupProtectionService::class.java))
            } catch (e: Exception) {
                e.printStackTrace()
            }

            // DELAY SEDIKIT AGAR OVERLAY BENAR-BENAR HILANG (Optimasi tombol Aktifkan)
            Handler(Looper.getMainLooper()).postDelayed({
                val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
                intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, compName)
                intent.putExtra(
                    DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                    "EduLock memerlukan izin Administrator untuk melindungi aplikasi dari penghapusan tidak sah."
                )
                
                // JANGAN gunakan FLAG_ACTIVITY_NEW_TASK karena akan menyebabkan
                // startActivityForResult langsung mengembalikan RESULT_CANCELED
                // sebelum user sempat mengaktifkan Device Admin
                
                try {
                    startActivityForResult(intent, DEVICE_ADMIN_REQUEST)
                } catch (e: Exception) {
                    // Fallback jika gagal membuka intent standard
                    e.printStackTrace()
                    Toast.makeText(this, "Gagal membuka menu Admin. Silakan buka Pengaturan > Keamanan > Admin Perangkat.", Toast.LENGTH_LONG).show()
                    
                    // Coba buka settings umum security
                    try {
                        startActivity(Intent(android.provider.Settings.ACTION_SECURITY_SETTINGS))
                    } catch (e2: Exception) {
                        startActivity(Intent(android.provider.Settings.ACTION_SETTINGS))
                    }
                }
            }, 500) // Delay 0.5 detik agar overlay SetupProtectionService benar-benar hilang
        }
    }

    private fun checkGPSStatus() {
        val isSilent = !prefsManager.isProtectionActive
        val isHoliday = prefsManager.isHolidayMode
        val isPermissionPaused = permissionManager.isPermissionActive()
        val isSchoolTime = scheduleManager.isSchoolTime()
        val gpsEnabled = isGPSEnabled()

        val key = when {
            isSilent -> "silent"
            isHoliday -> "holiday"
            isPermissionPaused -> "permission"
            else -> "enforce:$isSchoolTime:$gpsEnabled"
        }

        if (key == lastGpsUiKey) return
        lastGpsUiKey = key

        tvGPSStatus.text = when {
            isSilent -> "GPS: Mode Bebas (Silent)"
            isHoliday -> "GPS: Mode Acara / Libur Sekolah (Bebas)"
            isPermissionPaused -> "GPS: Monitoring DI-PAUSE (Izin)"
            !gpsEnabled && isSchoolTime -> "GPS: Tidak Aktif ❌"
            !gpsEnabled -> "GPS: Tidak Aktif (Bebas) 💤"
            isSchoolTime -> "GPS: Aktif ✓"
            else -> "GPS: Siaga (Bebas) 🌙"
        }

        if (isSilent) {
            val intent = Intent("com.sekolah.edulock.ACTION_DISMISS_LOCKSCREEN")
            sendBroadcast(intent)
        }

        if (!isSilent && !isHoliday && !isPermissionPaused && !gpsEnabled && isSchoolTime) {
            showLockdownOverlay("GPS MATI! Nyalakan GPS untuk melanjutkan.")
        }
    }

    private fun isGPSEnabled(): Boolean {
        return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
    }

    // Legacy Listener for Backup
    private val locationListenerLegacy = LocationListener { location ->
        // Forward to common handler
        checkLocation(location)
        detectMockLocation(location)
    }

    private fun startLocationMonitoring() {
        if (ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            // Jangan reset status jika sudah ada lokasi valid sebelumnya (mencegah flicker "Mencari Sinyal")
            val currentStatus = tvLocationStatus.text.toString()
            if (!currentStatus.contains("Sekolah") && !currentStatus.contains("Luar")) {
                tvLocationStatus.text = "Lokasi: Mencari Sinyal..."
            }
            
            // ---------------------------------------------------------
            // STRATEGY 1: Fused Location Provider (Google Play Services)
            // ---------------------------------------------------------
            try {
                val cts = CancellationTokenSource()
                fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token)
                    .addOnSuccessListener { location: Location? ->
                        if (location != null) {
                            checkLocation(location)
                        }
                    }
                    .addOnFailureListener { e ->
                        android.util.Log.e("MainActivity", "Fused getCurrentLocation error: ${e.message}")
                    }
            } catch (e: Exception) {
                android.util.Log.e("MainActivity", "Fused getCurrentLocation exception: ${e.message}")
            }

            val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000)
                .setWaitForAccurateLocation(true)
                .setMinUpdateIntervalMillis(3000)
                .setMaxUpdateDelayMillis(5000)
                .build()

            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )

            // ---------------------------------------------------------
            // STRATEGY 2: Legacy LocationManager (Raw GPS/Network)
            // ---------------------------------------------------------
            try {
                locationManager.removeUpdates(locationListenerLegacy)
                
                if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    locationManager.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER,
                        2000L,
                        0f,
                        locationListenerLegacy
                    )
                }
                if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    locationManager.requestLocationUpdates(
                        LocationManager.NETWORK_PROVIDER,
                        2000L,
                        0f,
                        locationListenerLegacy
                    )
                }
            } catch (e: Exception) {
                android.util.Log.e("MainActivity", "Legacy Location Error: ${e.message}")
            }

            // ---------------------------------------------------------
            // DIAGNOSIS & FALLBACK
            // ---------------------------------------------------------
            handler.postDelayed({
                val currentStatus = tvLocationStatus.text.toString()
                if (currentStatus.contains("Menunggu") || currentStatus.contains("Mencari")) {
                     val isGps = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
                     val isNetwork = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
                     
                     if (!isGps && !isNetwork) {
                         tvLocationStatus.text = "Lokasi: GPS MATI"
                         tvLocationStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_red_dark))
                     } else {
                         // Real Device tapi sinyal jelek
                         tvLocationStatus.text = "Lokasi: Sinyal Lemah/Mencari..."
                         tvLocationStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_orange_dark))
                     }
                }
            }, 5000) 
        } else {
            tvLocationStatus.text = "Lokasi: Izin Ditolak (Klik untuk Perbaiki)"
            tvLocationStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_red_dark))
            // showToast("IZIN LOKASI DITOLAK! Aplikasi tidak bisa berjalan.") // Disable spam toast
            // requestNecessaryPermissions() // Disable auto-request loop
            
            // Allow user to click to request
            tvLocationStatus.setOnClickListener {
                requestNecessaryPermissions()
            }
        }
    }

    private fun forceSchoolLocation(reason: String) {
        // Set flags global agar MonitoringService juga tahu
        prefsManager.isForcedLocation = true
        prefsManager.isInsideSchoolZone = true
        
        tvLocationStatus.text = "Mode Darurat ($reason): Lokasi Sekolah"
        tvLocationStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_blue_dark))
        
        val fakeLocation = Location("EMULATOR_FIX")
        fakeLocation.latitude = SCHOOL_LAT 
        fakeLocation.longitude = SCHOOL_LON
        fakeLocation.accuracy = 1.0f
        fakeLocation.time = System.currentTimeMillis()
        
        checkLocation(fakeLocation)
        showToast("Lokasi dipaksa ke Sekolah ($reason).")
    }
    
    private fun resetLocationMode() {
        prefsManager.isForcedLocation = false
        // prefsManager.isInsideSchoolZone = false // Jangan di-reset false dulu, biarkan logic locationMonitor yang menentukan
        
        tvLocationStatus.text = "Lokasi: Kembali ke GPS Asli..."
        tvLocationStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_orange_dark))
        
        showToast("Mode Paksa NONAKTIF. Menggunakan GPS Asli.")
        // Trigger update immediate
        startLocationMonitoring()
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

    private fun checkLocation(location: Location) {
        val now = System.currentTimeMillis()
        val isSchoolHours = scheduleManager.isSchoolTime()

        if (!prefsManager.isForcedLocation && isSchoolHours) {
            val ageMs = kotlin.math.abs(now - location.time)
            val acc = if (location.hasAccuracy()) location.accuracy else Float.MAX_VALUE
            val isGood = ageMs < 2 * 60 * 1000 && acc <= 80f

            if (isGood) {
                lastGoodLocationAt = now
                lastGoodLocation = location
            } else {
                val fallback = lastGoodLocation
                if (fallback != null && lastGoodLocationAt > 0L && now - lastGoodLocationAt < 5 * 60 * 1000L) {
                    checkLocation(fallback)
                    return
                }

                tvLocationStatus.text = "Lokasi: Menunggu GPS Akurat..."
                tvLocationStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_orange_dark))
                tvDistance.text = "Jarak: -- meter"
                btnRequestPermission.visibility = View.GONE
                stopKioskMode()
                return
            }
        }

        val distance = calculateDistance(
            location.latitude,
            location.longitude,
            SCHOOL_LAT,
            SCHOOL_LON
        )

        tvDistance.text = "Jarak: ${distance.toInt()} meter"

        // Cek Mode Libur
        if (prefsManager.isHolidayMode) {
             tvLocationStatus.text = "Lokasi: Mode Acara / Libur Sekolah (Bebas)"
             tvLocationStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_blue_dark))
             btnRequestPermission.visibility = View.GONE
             stopKioskMode()
             return
        }

        if (distance <= SCHOOL_RADIUS) {
            val isGpsOn = isGPSEnabled()
            val isRecent = Math.abs(System.currentTimeMillis() - location.time) < 5 * 60 * 1000
            if (isSchoolHours) {
                tvLocationStatus.text = "Lokasi: Di Area Sekolah ✓"
                tvLocationStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_green_dark))
                if (!prefsManager.isHolidayMode) {
                    btnRequestPermission.visibility = View.VISIBLE
                } else {
                    btnRequestPermission.visibility = View.GONE
                }
                if (!permissionManager.isPermissionActive()) {
                    if (prefsManager.isHolidayMode) {
                        tvLocationStatus.text = "Lokasi: Di Area Sekolah (Mode Acara)"
                        tvLocationStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_purple))
                        stopKioskMode()
                        return
                    }
                    
                    // FIX: Cek Global Protection (Silent Mode)
                    if (!prefsManager.isProtectionActive) {
                        tvLocationStatus.text = "Lokasi: Di Area Sekolah (Silent Mode)"
                        tvLocationStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_blue_dark))
                        stopKioskMode()
                        return
                    }
                    
                    startKioskMode()
                }
            } else {
                if (isGpsOn && isRecent) {
                    tvLocationStatus.text = "Lokasi: Di Area Sekolah (Bebas)"
                    tvLocationStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_blue_dark))
                } else {
                    tvLocationStatus.text = "Lokasi: Di Luar Sekolah (Bebas)"
                    tvLocationStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_orange_dark))
                }
                btnRequestPermission.visibility = View.GONE
                stopKioskMode()
            }
        } else {
            // HIDE BUTTON jika di luar sekolah (Bebas)
            btnRequestPermission.visibility = View.GONE

            // KHUSUS EMULATOR: Auto-Fix dinonaktifkan agar bisa test mode 'Luar Sekolah'.
            // User harus manual klik teks lokasi jika ingin test mode 'Dalam Sekolah'.
            /*
            if ((prefsManager.isEmulator || isEmulator()) && !prefsManager.isForcedLocation) {
                forceSchoolLocation("Auto-Fix Emulator Location")
                return
            }
            */
 
            if (isSchoolHours) {
                // REVISI LOGIKA:
                // Jika di luar sekolah saat jam sekolah -> JANGAN DIKUNCI (BEBAS)
                // Alasannya: Siswa mungkin sakit atau izin tidak masuk sekolah.
                
                tvLocationStatus.text = "Lokasi: Di Luar Sekolah (Jam Sekolah)"
                tvLocationStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_orange_dark))
                
                // Pastikan Kiosk Mode mati
                stopKioskMode()
                
                // Optional: Beri notifikasi peringatan saja, jangan dikunci
                // lockDevice("ANDA DI LUAR AREA SEKOLAH!\nJarak: ${distance.toInt()}m dari sekolah")
            } else {
                tvLocationStatus.text = "Lokasi: Di Luar Sekolah (Bebas)"
                tvLocationStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_orange_dark))
                
                // Pastikan Kiosk Mode mati saat bebas
                stopKioskMode()
            }
        }
    }

    private fun detectMockLocation(location: Location) {
        var isMock = false
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            isMock = location.isMock
        } else {
            isMock = location.isFromMockProvider
        }

        if (isMock) {
            lockDevice("FAKE GPS TERDETEKSI!\nSistem mendeteksi penggunaan lokasi palsu.")
        }
        
        // Time Manipulation Check using GPS Time
        val gpsTime = location.time
        val systemTime = System.currentTimeMillis()
        val diff = Math.abs(gpsTime - systemTime)
        
        // If difference is more than 30 minutes, user might have changed time
        if (diff > 30 * 60 * 1000) {
             tvCurrentTime.text = "Waktu (GPS): ${SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(gpsTime))}"
        }
    }

    private fun startTimeUpdates() {
        val runnable = object : Runnable {
            override fun run() {
                val sdf = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
                tvCurrentTime.text = "Waktu: ${sdf.format(Date())}"
                
                // Update Monitoring Info
                updateMonitoringUI()

                handler.postDelayed(this, 1000)
            }
        }
        handler.post(runnable)
    }

    private fun updateMonitoringUI() {
        checkGPSStatus()

        // Update Internet Status
        val isOnline = offlineMonitor.isInternetAvailable()
        if (isOnline) {
            tvInternetStatus.text = "Internet: Online"
            tvInternetStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_green_dark))
        } else {
            tvInternetStatus.text = "Internet: Offline (Bahaya!)"
            tvInternetStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_red_dark))
        }
        
        val startTime = scheduleManager.getSchoolStartTimeString()
        val endTime = scheduleManager.getSchoolEndTimeString()
        if (scheduleManager.isHolidayToday()) {
            tvSchoolStartTime.text = "Hari Libur"
            val note = scheduleManager.getHolidayNoteToday()
            tvSchoolEndTime.text = if (note.isNotEmpty()) "Keterangan: $note" else "Tanggal Merah"
        } else {
            tvSchoolStartTime.text = "Masuk: $startTime"
            tvSchoolEndTime.text = "Pulang: $endTime"
        }
    }

    private fun lockDevice(message: String) {
        val intent = Intent(this, LockScreenActivity::class.java)
        intent.putExtra("MESSAGE", message)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
    }

    private fun showLockdownOverlay(message: String) {
        val intent = Intent(this, OverlayLockActivity::class.java)
        intent.putExtra("MESSAGE", message)
        intent.putExtra("TARGET", "location")
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        startActivity(intent)
    }

    private fun showLockdownOverlay(message: String, target: String) {
        val intent = Intent(this, OverlayLockActivity::class.java)
        intent.putExtra("MESSAGE", message)
        intent.putExtra("TARGET", target)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        startActivity(intent)
    }

    private fun calculateDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val R = 6371000.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)

        val a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2)

        val c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return R * c
    }

    private fun showToast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        // Handle QR Code Scan for Admin
        val result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data)
        if (result != null) {
            if (result.contents != null) {
                val scannedPassword = result.contents
                validateUninstallAccessCode(scannedPassword) { ok, message ->
                    runOnUiThread {
                        if (ok) {
                            showToast("✅ Login Admin Berhasil via QR!")
                            showAdminPanel()
                        } else {
                            showToast(message ?: "❌ QR Code Salah! Akses Ditolak.")
                        }
                    }
                }
            }
            return // Important to return if handled by ZXing
        }

        if (requestCode == PERMISSION_CODE_REQUEST && resultCode == RESULT_OK) {
            // Permission granted, update UI
            updatePermissionStatusUI()
            
            // PENTING: Matikan Kiosk Mode secara eksplisit
            stopKioskMode()
            
            showToast("Izin penggunaan HP telah diberikan!")
        }
        
        if (requestCode == DEVICE_ADMIN_REQUEST) {
            isRequestingAdmin = false // Reset flag
            isOpeningSettings = false // Reset opening settings flag
            
            if (devicePolicyManager.isAdminActive(compName)) {
                showToast("✅ Device Admin Berhasil Diaktifkan!")
                adminDialog?.dismiss()
            } else {
                showToast("⚠️ Device Admin Belum Aktif. Mohon aktifkan.")
                // Jangan panggil checkAndEnforceDeviceAdmin() di sini agar tidak loop agresif, 
                // biarkan onResume yang handle nanti
            }
        }
    }

    private fun hideSystemUI() {
        // Menyembunyikan Status Bar dan Navigation Bar (Immersive Sticky Mode)
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN)
    }

    private fun collapseSystemUI() {
        // Mengirim broadcast untuk menutup System Dialogs (Recent Apps, Status Bar, dll)
        try {
            val closeIntent = Intent(Intent.ACTION_CLOSE_SYSTEM_DIALOGS)
            sendBroadcast(closeIntent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(kioskStopReceiver)
        } catch (e: Exception) {
            e.printStackTrace()
        }
        
        // Remove School Config Listener
        if (schoolConfigRef != null && schoolConfigListener != null) {
            schoolConfigRef?.removeEventListener(schoolConfigListener!!)
        }
        if (schoolServiceStatusRef != null && schoolServiceStatusListener != null) {
            schoolServiceStatusRef?.removeEventListener(schoolServiceStatusListener!!)
        }

        handler.removeCallbacksAndMessages(null)
        if (::fusedLocationClient.isInitialized) {
            fusedLocationClient.removeLocationUpdates(locationCallback)
        }
        try {
            locationManager.removeUpdates(locationListenerLegacy)
        } catch (e: Exception) {
            e.printStackTrace()
        }
        
        if (schoolConfigRef != null && schoolConfigListener != null) {
            schoolConfigRef?.removeEventListener(schoolConfigListener!!)
        }
        if (schoolServiceStatusRef != null && schoolServiceStatusListener != null) {
            schoolServiceStatusRef?.removeEventListener(schoolServiceStatusListener!!)
        }
    }
}
