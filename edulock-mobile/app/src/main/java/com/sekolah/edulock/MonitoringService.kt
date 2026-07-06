package com.sekolah.edulock

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import org.json.JSONObject

class MonitoringService : Service() {

    private lateinit var prefsManager: PreferencesManager
    private lateinit var permissionManager: PermissionManager
    private lateinit var offlineMonitor: OfflineMonitor
    private lateinit var locationMonitor: LocationMonitor
    private lateinit var trustScoreManager: TrustScoreManager
    private lateinit var gracePeriodManager: GracePeriodManager
    private lateinit var scheduleManager: SchoolScheduleManager
    private lateinit var devicePolicyManager: DevicePolicyManager
    private lateinit var compName: ComponentName
    private lateinit var firebaseReporter: FirebaseReporter
    private var lastAccessibilityPromptTime: Long = 0L
    private var lastAccessibilityLockTime: Long = 0L
    private var lastPermissionReleaseAt: Long = 0L
    
    private val handler = Handler(Looper.getMainLooper())
    private val MONITORING_INTERVAL = 3000L // Cek lebih agresif: setiap 3 detik
    private var uninstallListener: ValueEventListener? = null
    private var uninstallDbRef: com.google.firebase.database.DatabaseReference? = null
    private var holidayModeListener: ValueEventListener? = null
    private var holidayModeRef: com.google.firebase.database.DatabaseReference? = null
    private var protectionStatusListener: ValueEventListener? = null
    private var protectionStatusRef: com.google.firebase.database.DatabaseReference? = null
    private var deviceBindingListener: ValueEventListener? = null
    private var deviceBindingRef: com.google.firebase.database.DatabaseReference? = null
    private var schoolConfigListener: ValueEventListener? = null
    private var schoolConfigRef: com.google.firebase.database.DatabaseReference? = null
    private var weekdayScheduleListener: ValueEventListener? = null
    private var weekdayScheduleRef: com.google.firebase.database.DatabaseReference? = null
    private var holidayListListener: ValueEventListener? = null
    private var holidayListRef: com.google.firebase.database.DatabaseReference? = null
    private var gpsPolicyListener: ValueEventListener? = null
    private var gpsPolicyRef: com.google.firebase.database.DatabaseReference? = null
    private var schoolServiceStatusListener: ValueEventListener? = null
    private var schoolServiceStatusRef: com.google.firebase.database.DatabaseReference? = null
    private var overlayLockView: View? = null
    private lateinit var windowManager: WindowManager
    private var hasTriggeredSchoolServiceExit = false
    
    // Receiver untuk mendeteksi layar nyala (Screen ON) secara dinamis
    private val screenReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == Intent.ACTION_SCREEN_ON || intent?.action == Intent.ACTION_USER_PRESENT) {
                // Force Check saat layar nyala
                handler.post { performChecks() }
                
                // Force Sync Permission
                if (::permissionManager.isInitialized) {
                    val nisn = prefsManager.nisn
                    if (nisn.isNotEmpty()) {
                        permissionManager.resumeSession(nisn)
                    }
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        prefsManager = PreferencesManager(this)
        permissionManager = PermissionManager(this)
        offlineMonitor = OfflineMonitor(this, prefsManager)
        locationMonitor = LocationMonitor(this, prefsManager)
        trustScoreManager = TrustScoreManager(this, prefsManager)
        gracePeriodManager = GracePeriodManager(this, prefsManager)
        scheduleManager = SchoolScheduleManager(prefsManager)
        firebaseReporter = FirebaseReporter(this, prefsManager)

        devicePolicyManager = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        compName = ComponentName(this, DeviceAdminReceiver::class.java)
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        
        // Register Screen Receiver
        val filter = android.content.IntentFilter()
        filter.addAction(Intent.ACTION_SCREEN_ON)
        filter.addAction(Intent.ACTION_USER_PRESENT)
        registerReceiver(screenReceiver, filter)
        
        startForegroundService()
        startMonitoring()
        startUninstallAuthorizationListener()
        startHolidayModeListener()
        startProtectionStatusListener()
        startSchoolConfigListener()
        startWeekdayScheduleListener()
        startHolidayListListener()
        startGpsPolicyListener()
        startDeviceBindingListener()
        startSchoolServiceStatusListener()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "com.sekolah.edulock.ACTION_UI_FOREGROUND") {
            hideOverlayLock()
        }

        // Pastikan listener berjalan, terutama jika service di-restart atau baru login
        startUninstallAuthorizationListener()
        startHolidayModeListener()
        startProtectionStatusListener()
        startSchoolConfigListener()
        startWeekdayScheduleListener()
        startHolidayListListener()
        startGpsPolicyListener()
        startDeviceBindingListener()
        startSchoolServiceStatusListener()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startMonitoring() {
        // Delay pemeriksaan pertama selama 10 detik agar aplikasi stabil dulu
        handler.postDelayed(object : Runnable {
            override fun run() {
                performChecks()
                handler.postDelayed(this, MONITORING_INTERVAL)
            }
        }, 10000L) 
    }

    private fun performChecks() {
        if (!::prefsManager.isInitialized) {
            prefsManager = PreferencesManager(this)
        }

        // ==========================================
        // 0. PRE-FETCH DATA PENTING
        // ==========================================
        val currentLocation = locationMonitor.getCurrentLocation()
        val isInternet = offlineMonitor.isInternetAvailable()
        val trustScore = prefsManager.trustScore
        val isGpsActive = currentLocation != null
        val isSchoolTime = scheduleManager.isSchoolTime()
        val isAfterSchool = scheduleManager.isAfterSchoolHours()
        
        // ==========================================
        // 1. CEK MODE DARURAT (EMERGENCY UNLOCK)
        // ==========================================
        if (prefsManager.isEmergencyUnlocked) {
            if (isInternet) {
                // Internet kembali -> Reset mode darurat & Lanjut monitoring
                prefsManager.isEmergencyUnlocked = false
                prefsManager.isForcedLocation = false 
                showToast("Internet Kembali. Mode Darurat Dinonaktifkan.")
                updateNotification("EduLock Aktif", "Koneksi pulih. Monitoring dilanjutkan.")
            } else {
                // Masih offline -> Skip semua monitoring
                updateNotification("Mode Darurat", "Menunggu koneksi internet...")
                return
            }
        }

        // ==========================================
        // 2. UPDATE STATUS ZONA & LOKASI (SELALU JALAN)
        // ==========================================
        // Penting: Ini harus jalan MESKIPUN Silent Mode, agar status "Inside/Outside" selalu fresh.
        
        val now = System.currentTimeMillis()
        val isSettingsGrace = prefsManager.isSettingsOpen || now < prefsManager.settingsGraceUntil

        if (currentLocation != null) {
            val isInsideNow = locationMonitor.isInsideSchoolArea()
            
            // CEK KHUSUS EMULATOR / FAKE LOCATION
            // Jika LocationMonitor sudah mengembalikan fake location (isForcedLocation), maka isInsideNow = true.
            
            if (isInsideNow) {
                prefsManager.isInsideSchoolZone = true
                
                // Tutup System Dialogs jika di dalam zona (hanya Android < 12)
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S && !isSettingsGrace) {
                    try {
                        val closeIntent = Intent(Intent.ACTION_CLOSE_SYSTEM_DIALOGS)
                        sendBroadcast(closeIntent)
                    } catch (e: Exception) {
                        // Ignore
                    }
                }
            } else {
                // Jika di luar:
                // Jika Silent Mode -> Update Realtime (False)
                // Jika Active Mode & Jam Sekolah -> Jangan Update (Keep True) agar terdeteksi kabur (Sticky State)
                // Jika Active Mode & Luar Jam -> Update (False)
                
                if (!prefsManager.isProtectionActive || !isSchoolTime) {
                    prefsManager.isInsideSchoolZone = false
                }
            }
            
            // Update GPS Active Timestamp
            prefsManager.lastGpsActiveTimestamp = System.currentTimeMillis()
        }

        // ==========================================
        // 3. KIRIM REPORT KE FIREBASE (SELALU JALAN)
        // ==========================================
        val statusMsg = when {
            !isSchoolTime -> "Diluar Jam Sekolah"
            prefsManager.isInsideSchoolZone -> "Aman (Di Sekolah)"
            else -> "Di Luar Zona Sekolah"
        }
        
        firebaseReporter.sendStatusUpdate(
            latitude = currentLocation?.latitude,
            longitude = currentLocation?.longitude,
            isInsideZone = prefsManager.isInsideSchoolZone,
            trustScore = trustScore,
            isGpsActive = isGpsActive,
            isInternetActive = isInternet,
            statusMessage = statusMsg
        )

        // ==========================================
        // 4. CEK MODE ACARA / LIBUR (BYPASS SECURITY)
        // ==========================================
        if (prefsManager.isHolidayMode) {
             hideOverlayLock()
             return
        }
        
        // ==========================================
        // 5. CEK SILENT MODE (BYPASS SECURITY)
        // ==========================================
        if (!prefsManager.isProtectionActive) {
             hideOverlayLock()
             // Pastikan lockscreen tertutup
             val intent = Intent("com.sekolah.edulock.ACTION_DISMISS_LOCKSCREEN")
             sendBroadcast(intent)
             
             // Update notifikasi agar tidak mencurigakan
             updateNotification("Mode Senyap", "Monitoring Dinonaktifkan oleh Admin", true)
             
             // Pastikan Kiosk Mode mati
             val stopIntent = Intent("com.sekolah.edulock.ACTION_STOP_KIOSK")
             stopIntent.setPackage(packageName)
             sendBroadcast(stopIntent)
             
             return
        } else {
            // JIKA PROTEKSI AKTIF:
            // Cek Reward Harian
            trustScoreManager.checkAndApplyDailyReward()
        }

        // CEK WAJIB: Layanan Aksesibilitas aktif saat proteksi ON
        // Jika OFF, arahkan siswa untuk mengaktifkan kembali dengan aman dan tidak berulang terlalu sering
        try {
            val am = getSystemService(Context.ACCESSIBILITY_SERVICE) as android.view.accessibility.AccessibilityManager
            val enabledServices = am.getEnabledAccessibilityServiceList(android.accessibilityservice.AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
            val isAccessibilityEnabled = enabledServices.any {
                it.resolveInfo.serviceInfo.packageName == packageName &&
                it.resolveInfo.serviceInfo.name.endsWith(AntiUninstallService::class.java.simpleName)
            }
            if (!isAccessibilityEnabled && !isSettingsGrace) {
                if (isSchoolTime && prefsManager.isInsideSchoolZone && !prefsManager.isHolidayMode) {
                    if (now - lastAccessibilityLockTime > 10_000) {
                        lastAccessibilityLockTime = now
                        showLockScreen("PROTEKSI WAJIB AKTIF!\n\nBuka Aksesibilitas > Layanan Terinstall > EduLock Protection -> AKTIFKAN.")
                    }
                    return
                }
                if (now - lastAccessibilityPromptTime > 30000) {
                    lastAccessibilityPromptTime = now
                    updateNotification("Aktifkan Proteksi", "Nyalakan Layanan Aksesibilitas EduLock")
                    try {
                        val intent = Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS)
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        startActivity(intent)
                    } catch (_: Exception) { }
                }
            }
        } catch (_: Exception) { }

        // ==========================================
        // 6. CEK JADWAL & STOP JIKA BUKAN WAKTU SEKOLAH / HARI TIDAK EFEKTIF
        // ==========================================
        if (!isSchoolTime) {
            hideOverlayLock()
            try {
                val intent = Intent("com.sekolah.edulock.ACTION_DISMISS_LOCKSCREEN")
                intent.setPackage(packageName)
                sendBroadcast(intent)
            } catch (_: Exception) {
            }

            try {
                val stopIntent = Intent("com.sekolah.edulock.ACTION_STOP_KIOSK")
                stopIntent.setPackage(packageName)
                sendBroadcast(stopIntent)
            } catch (_: Exception) {
            }

            if (isAfterSchool || !scheduleManager.isEffectiveSchoolDayToday()) {
                prefsManager.isInsideSchoolZone = false
            }
            return
        }

        // ==========================================
        // 7. PROTEKSI UTAMA (Hanya jika Di Sekolah)
        // ==========================================
        
        // 7.1. Cek Status Siswa "DI LUAR SEKOLAH"
        if (!prefsManager.isInsideSchoolZone) {
            hideOverlayLock()
            return
        }

        // 7.2. Aggressive Re-launch (Hanya jika di dalam sekolah & proteksi aktif)
        val isPermissionActive = permissionManager.isPermissionActive()

        if (isPermissionActive) {
            hideOverlayLock()
            if (now - lastPermissionReleaseAt > 3000L) {
                lastPermissionReleaseAt = now

                try {
                    val dismissIntent = Intent("com.sekolah.edulock.ACTION_DISMISS_LOCKSCREEN")
                    dismissIntent.setPackage(packageName)
                    sendBroadcast(dismissIntent)
                } catch (_: Exception) {
                }

                try {
                    val stopIntent = Intent("com.sekolah.edulock.ACTION_STOP_KIOSK")
                    stopIntent.setPackage(packageName)
                    sendBroadcast(stopIntent)
                } catch (_: Exception) {
                }

                updateNotification("Izin Aktif", "Monitoring di-pause sementara", true)
            }
            return
        }
        
        if (!isSettingsGrace && !isPermissionActive) {
             // CEK GRACE PERIOD SWITCH APP (15 Detik)
             // Jika user baru saja membuka aplikasi sekolah, beri waktu agar AntiUninstallService bisa update state
             val lastSwitchTime = prefsManager.appSwitchTimestamp
             if (now - lastSwitchTime < 15000) {
                 // Masih dalam masa transisi, skip aggressive check
                 return
             }

             try {
                 if (!isAppOnForeground(this)) {
                     // CEK WHITELIST APLIKASI
                     val lastPackage = prefsManager.lastForegroundPackage
                     
                     // Daftar Whitelist yang AMAN (Sinkron dengan AntiUninstallService)
                     val allowedPackages = listOf(
                        "com.sekolah.aplikasismpn3pacet",
                        "com.android.permissioncontroller",
                        "com.google.android.permissioncontroller",
                        "com.android.systemui",
                        "android"
                     )
                     
                     // Cek apakah package saat ini ada di whitelist
                     val isWhitelisted =
                        lastPackage != null &&
                            !lastPackage.startsWith("com.sekolah.edulock") &&
                            allowedPackages.any { lastPackage.startsWith(it) }

                     // Jika aplikasi yang sedang berjalan adalah Aplikasi Sekolah atau System, JANGAN kunci/re-launch
                     if (isWhitelisted) {
                         hideOverlayLock()
                         // Whitelist Active: Do nothing
                     } else {
                         // Debug: Tampilkan apa yang diblokir
                         // showToast("Memblokir: $lastPackage") 
                         
                         showOverlayLock("PERANGKAT TERKUNCI!\nKembali ke EduLock.")
                         val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
                         launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                         startActivity(launchIntent)
                     }
                 } else {
                     hideOverlayLock()
                 }
             } catch (e: Exception) {
                 android.util.Log.e("MonitoringService", "Failed to bring app to foreground: ${e.message}")
             }
        }

        // 7.3. Cek GPS Dimatikan
        if (currentLocation == null) {
            val lastGpsTime = prefsManager.lastGpsActiveTimestamp
            val currentTime = System.currentTimeMillis()
            val gpsOfflineDuration = currentTime - lastGpsTime
            val gpsWarnMs = prefsManager.gpsOffWarnMs.coerceAtLeast(0L)
            val gpsLockMs = prefsManager.gpsOffLockMs.coerceAtLeast(0L)
            
            if (gpsLockMs == 0L) {
                 triggerLockdown("GPS MATI DI SEKOLAH!\nLockdown langsung.")
            } else if (gpsOfflineDuration > gpsLockMs) {
                 triggerLockdown("GPS MATI DI SEKOLAH!\nSudah lebih dari ${gpsLockMs / 60000} menit.")
            } else if (gpsWarnMs > 0L && gpsOfflineDuration > gpsWarnMs) {
                 val remainingMs = gpsLockMs - gpsOfflineDuration
                 if (gpsLockMs > 0L && remainingMs > 0L) {
                     showToast("PERINGATAN! GPS mati. Lockdown dalam ${remainingMs / 1000} detik.")
                 } else {
                     showToast("PERINGATAN! GPS mati. Lockdown sebentar lagi.")
                 }
            }
            return
        }

        // 7.4. Cek Keluar Area
        if (!locationMonitor.isInsideSchoolArea()) {
             if (gracePeriodManager.isGracePeriodActive()) {
                showToast("Peringatan: Anda di luar area! Sisa waktu toleransi: ${gracePeriodManager.getRemainingTime() / 1000} detik")
            } else {
                triggerLockdown("KELUAR AREA SEKOLAH!\nKembali ke zona aman.")
            }
        }

        // 7.5. Cek Internet
        offlineMonitor.checkInternetAndTrack(
            onWarningTriggered = { remainingMs ->
                showToast("PERINGATAN! Internet mati. Lockdown dalam ${remainingMs / 1000} detik.")
            },
            onLockdownTriggered = {
                triggerLockdown("KONEKSI HILANG!\nAnda offline lebih dari 10 menit.")
            }
        )
    }

    // Implementasi Helper Method isAppOnForeground
    // Removed duplicate implementation since it was already defined below
    
    private fun triggerLockdown(message: String) {
        // Kurangi Trust Score menggunakan Graduated Penalty
        trustScoreManager.applyGraduatedPenalty()
        
        val intent = Intent(this, LockScreenActivity::class.java)
        intent.putExtra("MESSAGE", message)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(intent)
    }

    private fun showLockScreen(message: String) {
        try {
            val intent = Intent(this, LockScreenActivity::class.java)
            intent.putExtra("MESSAGE", message)
            intent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
            )
            startActivity(intent)
        } catch (_: Exception) {
        }

        try {
            val channelId = "EduLockLockScreen"
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val manager = getSystemService(NotificationManager::class.java)
                val channel = NotificationChannel(
                    channelId,
                    "EduLock Lock Screen",
                    NotificationManager.IMPORTANCE_HIGH
                )
                manager.createNotificationChannel(channel)
            }

            val fullScreenIntent = Intent(this, LockScreenActivity::class.java).apply {
                putExtra("MESSAGE", message)
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                )
            }
            val fullScreenPendingIntent = android.app.PendingIntent.getActivity(
                this,
                1002,
                fullScreenIntent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
            )

            val builder = NotificationCompat.Builder(this, channelId)
                .setContentTitle("EduLock")
                .setContentText("Proteksi aktif")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setFullScreenIntent(fullScreenPendingIntent, true)

            val manager = getSystemService(NotificationManager::class.java)
            manager.notify(1002, builder.build())
        } catch (_: Exception) {
        }
    }

    private fun showOverlayLock(message: String) {
        try {
            if (overlayLockView != null) return
            if (!Settings.canDrawOverlays(this)) return

            val root = FrameLayout(this)
            root.setBackgroundColor(Color.parseColor("#CC000000"))
            root.setOnTouchListener { _, _ -> true }

            val container = LinearLayout(this)
            container.orientation = LinearLayout.VERTICAL
            container.gravity = Gravity.CENTER
            container.setPadding(48, 48, 48, 48)

            val tv = TextView(this)
            tv.text = message
            tv.setTextColor(Color.WHITE)
            tv.textSize = 18f
            tv.gravity = Gravity.CENTER

            val btn = Button(this)
            btn.text = "Buka EduLock"
            btn.setOnClickListener {
                try {
                    val intent = Intent(this, LockScreenActivity::class.java)
                    intent.putExtra("MESSAGE", message)
                    intent.addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_CLEAR_TOP or
                            Intent.FLAG_ACTIVITY_SINGLE_TOP
                    )
                    startActivity(intent)
                } catch (_: Exception) {
                }
            }

            container.addView(tv)
            val lpBtn = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            lpBtn.topMargin = 24
            container.addView(btn, lpBtn)

            val lp = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            root.addView(container, lp)

            val type =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                else WindowManager.LayoutParams.TYPE_PHONE
            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_FULLSCREEN,
                android.graphics.PixelFormat.TRANSLUCENT
            )
            params.gravity = Gravity.CENTER

            overlayLockView = root
            windowManager.addView(root, params)
        } catch (_: Exception) {
            overlayLockView = null
        }
    }

    private fun hideOverlayLock() {
        val v = overlayLockView ?: return
        try {
            windowManager.removeView(v)
        } catch (_: Exception) {
        } finally {
            overlayLockView = null
        }
    }

    private fun showToast(message: String) {
        handler.post {
            Toast.makeText(applicationContext, message, Toast.LENGTH_SHORT).show()
        }
    }

    private fun startForegroundService() {
        // Cek status silent saat startup
        val isSilent = if (::prefsManager.isInitialized) !prefsManager.isProtectionActive else false
        val channelId = if (isSilent) "MonitoringChannelSilent" else "MonitoringChannel"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            
            // Channel High Importance
            val channelHigh = NotificationChannel(
                "MonitoringChannel",
                "EduLock Monitoring",
                NotificationManager.IMPORTANCE_HIGH
            )
            manager.createNotificationChannel(channelHigh)

            // Channel Low Importance (Silent)
            val channelLow = NotificationChannel(
                "MonitoringChannelSilent",
                "EduLock Silent Monitoring",
                NotificationManager.IMPORTANCE_LOW
            )
            manager.createNotificationChannel(channelLow)
        }

        // Intent untuk Full Screen (Auto Open)
        val fullScreenIntent = Intent(this, MainActivity::class.java)
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val fullScreenPendingIntent = android.app.PendingIntent.getActivity(
            this,
            0,
            fullScreenIntent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, channelId)
            .setContentTitle(if (isSilent) "Mode Senyap" else "EduLock Aktif")
            .setContentText(if (isSilent) "Monitoring Dinonaktifkan oleh Admin" else "Memantau aktivitas belajar siswa")
            .setSmallIcon(R.mipmap.ic_launcher)

        if (isSilent) {
            builder.setPriority(NotificationCompat.PRIORITY_LOW)
            builder.setCategory(NotificationCompat.CATEGORY_SERVICE)
        } else {
            builder.setPriority(NotificationCompat.PRIORITY_HIGH)
            builder.setCategory(NotificationCompat.CATEGORY_ALARM)
            builder.setFullScreenIntent(fullScreenPendingIntent, true)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(1, builder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(1, builder.build())
        }
    }
    
    private fun startUninstallAuthorizationListener() {
        // Prevent duplicate listener
        if (uninstallListener != null) return

        val nisn = prefsManager.nisn
        if (nisn.isEmpty()) {
            android.util.Log.e("MonitoringService", "NISN kosong, mencoba lagi dalam 5 detik...")
            handler.postDelayed({ startUninstallAuthorizationListener() }, 5000)
            return
        }

        // Gunakan URL eksplisit (Asia Southeast 1)
        val database = FirebaseDatabase.getInstance("https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app")
        uninstallDbRef = database.getReference("students").child(nisn).child("uninstall_authorized")

        uninstallListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val isAuthorized = readFlexibleBoolean(snapshot)
                
                // Debug Toast untuk memastikan listener hidup
                // showToast("Status Uninstall Remote: $isAuthorized")

                // Hanya update jika berubah agar tidak spam log/toast
                if (isAuthorized != prefsManager.isUninstallAuthorized) {
                    prefsManager.isUninstallAuthorized = isAuthorized
                    if (isAuthorized) {
                        showToast("⚠️ IZIN UNINSTALL DIBERIKAN OLEH ADMIN ⚠️")
                        
                        // OTOMATIS CABUT DEVICE ADMIN
                        try {
                            if (devicePolicyManager.isAdminActive(compName)) {
                                devicePolicyManager.removeActiveAdmin(compName)
                                showToast("🔓 Device Admin Dinonaktifkan Otomatis")
                                android.util.Log.d("MonitoringService", "Device Admin removed by remote authorization")
                            }
                        } catch (e: Exception) {
                            android.util.Log.e("MonitoringService", "Failed to remove device admin: ${e.message}")
                        }

                        // Update notifikasi
                        updateNotification("Mode Uninstall", "Silakan uninstall aplikasi sekarang")
                    } else {
                        showToast("🔒 Izin Uninstall Dicabut")
                        updateNotification("EduLock Aktif", "Memantau aktivitas belajar siswa")
                    }
                } else if (isAuthorized && devicePolicyManager.isAdminActive(compName)) {
                    // Jika state sudah authorized tapi Device Admin masih aktif (misal user restart sebelum uninstall)
                    // Paksa cabut lagi
                    try {
                        devicePolicyManager.removeActiveAdmin(compName)
                        showToast("🔓 Device Admin Dinonaktifkan Otomatis")
                    } catch (e: Exception) {
                         android.util.Log.e("MonitoringService", "Failed to remove device admin (retry): ${e.message}")
                    }
                }
            }

            override fun onCancelled(error: DatabaseError) {
                android.util.Log.e("MonitoringService", "Uninstall listener cancelled: ${error.message}")
            }
        }
        uninstallDbRef?.addValueEventListener(uninstallListener!!)
        android.util.Log.d("MonitoringService", "Uninstall Listener started for NISN: $nisn")
    }

    private fun startHolidayModeListener() {
        // Prevent duplicate listener
        if (holidayModeListener != null) return

        val schoolId = prefsManager.schoolId.trim().lowercase()
        if (schoolId.isEmpty()) return

        // Listen ke node global sekolah
        // Gunakan URL eksplisit (Asia Southeast 1)
        val database = FirebaseDatabase.getInstance("https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app")
        holidayModeRef = database.getReference("schools").child(schoolId).child("config").child("is_holiday_mode")

        holidayModeListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val isHoliday = readFlexibleBoolean(snapshot)
                
                if (isHoliday != prefsManager.isHolidayMode) {
                    prefsManager.isHolidayMode = isHoliday
                    if (isHoliday) {
                        showToast("🎉 MODE BEBAS AKTIF! Silakan gunakan HP untuk dokumentasi.")
                        hideOverlayLock()
                        
                        // Update notifikasi agar siswa tahu (SILENT agar tidak memunculkan app)
                        updateNotification("Mode Bebas Aktif", "Silakan gunakan HP dengan bijak", true)

                        // Kirim broadcast untuk menutup LockScreen jika sedang aktif
                        val intent = Intent("com.sekolah.edulock.ACTION_DISMISS_LOCKSCREEN")
                        sendBroadcast(intent)
                    } else {
                        hideOverlayLock()
                        showToast("🔒 Mode Bebas Berakhir. Monitoring kembali aktif.")
                        updateNotification("EduLock Aktif", "Memantau aktivitas belajar siswa")

                        // ================================================================
                        // FIX: AGGRESSIVE RE-LOCK saat Holiday Mode DIMATIKAN
                        // ================================================================
                        // ROOT CAUSE: Selama holiday mode aktif, performChecks() selalu
                        // 'return' di step 4 sehingga isInsideSchoolZone TIDAK pernah
                        // di-refresh. Akibatnya ketika mode dimatikan, isInsideSchoolZone
                        // bernilai FALSE (stale) dan step 7.1 langsung return lagi —
                        // siswa tidak pernah dikunci ulang.
                        //
                        // FIX: Force isInsideSchoolZone dari cache lokasi terakhir,
                        // lalu lakukan 3x staged re-lock dalam 10 detik pertama.
                        // ================================================================
                        val shouldEnforce = prefsManager.isProtectionActive &&
                            !permissionManager.isPermissionActive() &&
                            (scheduleManager.isSchoolTime() || prefsManager.isInsideSchoolZone)

                        if (shouldEnforce) {

                            // 1. Force-refresh isInsideSchoolZone dari lokasi cache terakhir
                            val cachedLocation = locationMonitor.getCurrentLocation()
                            if (cachedLocation != null) {
                                val isInside = locationMonitor.isInsideSchoolArea()
                                prefsManager.isInsideSchoolZone = isInside
                                android.util.Log.d("MonitoringService", "HolidayOFF: isInsideSchoolZone=$isInside (from cached GPS)")
                            } else {
                                // Tidak ada lokasi cache → default TRUE (lebih aman: lock dulu)
                                prefsManager.isInsideSchoolZone = true
                                android.util.Log.d("MonitoringService", "HolidayOFF: No cached location, isInsideSchoolZone forced TRUE")
                            }

                            // 2. Aktifkan kembali Kiosk Mode tanpa mengganggu UI (jangan tampilkan layar "Mode Bebas berakhir")
                            try {
                                val startIntent = Intent("com.sekolah.edulock.ACTION_START_KIOSK")
                                startIntent.setPackage(packageName)
                                sendBroadcast(startIntent)
                            } catch (_: Exception) { }

                            // 3. Langsung buka paksa aplikasi ke foreground
                            try {
                                val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
                                launchIntent?.addFlags(
                                    Intent.FLAG_ACTIVITY_NEW_TASK or
                                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                                )
                                startActivity(launchIntent)
                            } catch (e: Exception) {
                                android.util.Log.e("MonitoringService", "HolidayOFF: immediate relaunch failed: ${e.message}")
                            }

                            // 4. Jalankan performChecks() segera
                            handler.post { performChecks() }

                            // 5. Staged re-lock: 3x percobaan di 2s, 5s, 10s
                            //    Mengatasi delay GPS refresh, app lifecycle, dan system throttle
                            val stagingDelays = listOf(2000L, 5000L, 10000L)
                            for (delay in stagingDelays) {
                                handler.postDelayed({
                                    if (!prefsManager.isHolidayMode &&
                                        prefsManager.isProtectionActive &&
                                        scheduleManager.isSchoolTime() &&
                                        !permissionManager.isPermissionActive()
                                    ) {
                                        android.util.Log.d("MonitoringService", "HolidayOFF: Staged re-lock at ${delay}ms")
                                        performChecks()
                                        try {
                                            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
                                            launchIntent?.addFlags(
                                                Intent.FLAG_ACTIVITY_NEW_TASK or
                                                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                                                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                                            )
                                            startActivity(launchIntent)
                                        } catch (_: Exception) { }
                                    }
                                }, delay)
                            }
                        }
                    }
                }
            }

            override fun onCancelled(error: DatabaseError) {
                android.util.Log.e("MonitoringService", "Holiday listener cancelled: ${error.message}")
            }
        }
        holidayModeRef?.addValueEventListener(holidayModeListener!!)
    }

    private fun startProtectionStatusListener() {
        if (protectionStatusListener != null) return

        val schoolId = prefsManager.schoolId.trim().lowercase()
        if (schoolId.isEmpty()) return

        val database = FirebaseDatabase.getInstance("https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app")
        protectionStatusRef = database.getReference("schools").child(schoolId).child("config").child("is_active_protection")

        protectionStatusListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                // Default ke true (Proteksi Aktif) jika node tidak ditemukan di database
                val isActive = readFlexibleBoolean(snapshot, true)
                
                if (isActive != prefsManager.isProtectionActive) {
                    val wasActive = prefsManager.isProtectionActive
                    prefsManager.isProtectionActive = isActive
                    
                    if (isActive) {
                        showToast("🛡️ PROTEKSI SEKOLAH DIAKTIFKAN! 🛡️")
                        updateNotification("EduLock Aktif", "Keamanan sekolah telah diaktifkan")

                        val isSchoolTime = scheduleManager.isSchoolTime()
                        val shouldEnforce = isSchoolTime && !prefsManager.isHolidayMode && !permissionManager.isPermissionActive()

                        if (shouldEnforce) {
                            val insideNow = try {
                                locationMonitor.isInsideSchoolArea()
                            } catch (_: Exception) {
                                prefsManager.isInsideSchoolZone
                            }

                            if (insideNow) {
                                prefsManager.isInsideSchoolZone = true
                                showLockScreen("Proteksi diaktifkan kembali. EduLock mengunci perangkat.")
                            }
                        }

                        handler.post { performChecks() }
                        handler.postDelayed({ performChecks() }, 1000)
                    } else {
                        showToast("🔕 Mode Senyap (Silent) Aktif")
                        updateNotification("Mode Senyap", "Monitoring Dinonaktifkan oleh Admin")
                        
                        // Dismiss lock screen & Stop Kiosk
                        val intent = Intent("com.sekolah.edulock.ACTION_DISMISS_LOCKSCREEN")
                        sendBroadcast(intent)
                        
                        val stopIntent = Intent("com.sekolah.edulock.ACTION_STOP_KIOSK")
                        stopIntent.setPackage(packageName)
                        sendBroadcast(stopIntent)
                    }

                    if (wasActive && !isActive) {
                        handler.post { performChecks() }
                    }
                }
            }

            override fun onCancelled(error: DatabaseError) {
                android.util.Log.e("MonitoringService", "Protection listener cancelled: ${error.message}")
            }
        }
        protectionStatusRef?.addValueEventListener(protectionStatusListener!!)
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
                android.util.Log.e("MonitoringService", "School service listener cancelled: ${error.message}")
            }
        }
        schoolServiceStatusRef?.addValueEventListener(schoolServiceStatusListener!!)
    }

    private fun forceExitBecauseSchoolInactive() {
        if (hasTriggeredSchoolServiceExit) return
        hasTriggeredSchoolServiceExit = true

        val dismissIntent = Intent("com.sekolah.edulock.ACTION_DISMISS_LOCKSCREEN")
        sendBroadcast(dismissIntent)
        stopLockTaskWrapper()

        handler.post {
            Toast.makeText(applicationContext, SchoolServiceGuard.inactiveMessage(), Toast.LENGTH_LONG).show()
        }

        prefsManager.isRegistered = false
        prefsManager.isSetupCompleted = false

        try {
            val intent = Intent(applicationContext, RegistrationActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            intent.putExtra("ERROR_MESSAGE", SchoolServiceGuard.inactiveMessage())
            startActivity(intent)
        } catch (e: Exception) {
            android.util.Log.e("MonitoringService", "Failed to redirect after school deactivation: ${e.message}")
        }

        stopSelf()
    }

    private fun readFlexibleBoolean(snapshot: DataSnapshot, defaultValue: Boolean = false): Boolean {
        if (!snapshot.exists()) return defaultValue
        
        try {
            val b = snapshot.getValue(Boolean::class.java)
            if (b != null) return b
        } catch (_: Exception) {
        }
        try {
            val n = snapshot.getValue(Long::class.java)
            if (n != null) return n != 0L
        } catch (_: Exception) {
        }
        try {
            val s = snapshot.getValue(String::class.java)
            if (s != null) {
                val normalized = s.trim().lowercase()
                if (normalized == "true" || normalized == "1" || normalized == "yes" || normalized == "on") return true
                if (normalized == "false" || normalized == "0" || normalized == "no" || normalized == "off") return false
            }
        } catch (_: Exception) {
        }
        return defaultValue
    }

    private fun startSchoolConfigListener() {
        if (schoolConfigListener != null) return

        val schoolId = prefsManager.schoolId.trim().lowercase()
        if (schoolId.isEmpty()) return

        val database = FirebaseDatabase.getInstance("https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app")
        schoolConfigRef = database.getReference("schools").child(schoolId).child("config")

        schoolConfigListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                try {
                    val startTimeStr = snapshot.child("startTime").getValue(String::class.java)
                    val endTimeStr = snapshot.child("endTime").getValue(String::class.java)

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
                        } catch (_: Exception) {
                        }
                    }

                    val latStr = snapshot.child("latitude").getValue(String::class.java)
                        ?: snapshot.child("latitude").getValue(Double::class.java)?.toString()
                    val lonStr = snapshot.child("longitude").getValue(String::class.java)
                        ?: snapshot.child("longitude").getValue(Double::class.java)?.toString()
                    val radStr = snapshot.child("radius").getValue(String::class.java)
                        ?: snapshot.child("radius").getValue(Double::class.java)?.toString()
                        ?: snapshot.child("radius").getValue(Int::class.java)?.toString()

                    if (latStr != null && lonStr != null) {
                        fun normalizeNumber(input: String): String {
                            return input.trim().replace(",", ".")
                        }

                        val newLat = normalizeNumber(latStr).toDouble()
                        val newLon = normalizeNumber(lonStr).toDouble()
                        val newRad = radStr?.let { normalizeNumber(it).toDouble() } ?: 500.0

                        prefsManager.schoolLatitude = newLat
                        prefsManager.schoolLongitude = newLon
                        prefsManager.schoolRadius = newRad
                    }
                } catch (_: Exception) {
                }
            }

            override fun onCancelled(error: DatabaseError) {
                android.util.Log.e("MonitoringService", "School config listener cancelled: ${error.message}")
            }
        }
        schoolConfigRef?.addValueEventListener(schoolConfigListener!!)
    }

    private fun startWeekdayScheduleListener() {
        if (weekdayScheduleListener != null) return

        val schoolId = prefsManager.schoolId.trim().lowercase()
        if (schoolId.isEmpty()) return

        val database = FirebaseDatabase.getInstance("https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app")
        weekdayScheduleRef = database.getReference("schools").child(schoolId).child("schedule").child("weekdays")

        weekdayScheduleListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                try {
                    val root = JSONObject()
                    val keys = listOf("mon", "tue", "wed", "thu", "fri", "sat", "sun")
                    for (k in keys) {
                        val node = snapshot.child(k)
                        if (!node.exists()) continue
                        val obj = JSONObject()
                        obj.put("enabled", readFlexibleBoolean(node.child("enabled"), k != "sun"))
                        obj.put("start", node.child("start").getValue(String::class.java) ?: "07:00")
                        obj.put("end", node.child("end").getValue(String::class.java) ?: "14:00")
                        root.put(k, obj)
                    }
                    prefsManager.weekdayScheduleJson = root.toString()
                } catch (_: Exception) {
                }
            }

            override fun onCancelled(error: DatabaseError) {
                android.util.Log.e("MonitoringService", "Weekday schedule listener cancelled: ${error.message}")
            }
        }
        weekdayScheduleRef?.addValueEventListener(weekdayScheduleListener!!)
    }

    private fun startHolidayListListener() {
        if (holidayListListener != null) return

        val schoolId = prefsManager.schoolId.trim().lowercase()
        if (schoolId.isEmpty()) return

        val database = FirebaseDatabase.getInstance("https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app")
        holidayListRef = database.getReference("schools").child(schoolId).child("holidays")

        holidayListListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                try {
                    val root = JSONObject()
                    for (child in snapshot.children) {
                        val dateKey = child.key ?: continue
                        val note = child.child("note").getValue(String::class.java) ?: ""
                        root.put(dateKey, note)
                    }
                    prefsManager.holidayListJson = root.toString()
                } catch (_: Exception) {
                }
            }

            override fun onCancelled(error: DatabaseError) {
                android.util.Log.e("MonitoringService", "Holiday list listener cancelled: ${error.message}")
            }
        }
        holidayListRef?.addValueEventListener(holidayListListener!!)
    }

    private fun startGpsPolicyListener() {
        if (gpsPolicyListener != null) return

        val schoolId = prefsManager.schoolId.trim().lowercase()
        if (schoolId.isEmpty()) return

        val database = FirebaseDatabase.getInstance("https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app")
        gpsPolicyRef = database.getReference("schools").child(schoolId).child("policy")

        gpsPolicyListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                try {
                    fun toLongMs(node: DataSnapshot, defaultValue: Long): Long {
                        if (!node.exists()) return defaultValue
                        val n = node.getValue(Long::class.java)
                        if (n != null) return n
                        val i = node.getValue(Int::class.java)
                        if (i != null) return i.toLong()
                        val s = node.getValue(String::class.java)
                        return s?.trim()?.toLongOrNull() ?: defaultValue
                    }

                    val warnMs = toLongMs(snapshot.child("gps_off_warn_ms"), prefsManager.gpsOffWarnMs).coerceAtLeast(0L)
                    val lockMs = toLongMs(snapshot.child("gps_off_lock_ms"), prefsManager.gpsOffLockMs).coerceAtLeast(0L)

                    val safeLock = lockMs
                    val safeWarn = if (safeLock > 0 && warnMs > safeLock) safeLock else warnMs

                    prefsManager.gpsOffWarnMs = safeWarn
                    prefsManager.gpsOffLockMs = safeLock
                } catch (_: Exception) {
                }
            }

            override fun onCancelled(error: DatabaseError) {
                android.util.Log.e("MonitoringService", "GPS policy listener cancelled: ${error.message}")
            }
        }

        gpsPolicyRef?.addValueEventListener(gpsPolicyListener!!)
    }

    private fun startDeviceBindingListener() {
        if (deviceBindingListener != null) return

        val nisn = prefsManager.nisn
        val localDeviceId = prefsManager.deviceId

        if (nisn.isEmpty() || localDeviceId.isEmpty()) return

        val database = FirebaseDatabase.getInstance("https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app")
        deviceBindingRef = database.getReference("students").child(nisn).child("device_uuid")

        deviceBindingListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val remoteDeviceId = snapshot.getValue(String::class.java)
                
                // Jika remote ID ada DAN berbeda dengan local ID -> Konflik!
                if (remoteDeviceId != null && remoteDeviceId != localDeviceId) {
                    android.util.Log.w("MonitoringService", "Device Conflict Detected! Remote: $remoteDeviceId, Local: $localDeviceId")
                    
                    // 1. Cabut Kiosk Mode (jika aktif) agar tidak stuck
                    val intentDismiss = Intent("com.sekolah.edulock.ACTION_DISMISS_LOCKSCREEN")
                    sendBroadcast(intentDismiss)
                    stopLockTaskWrapper()

                    // 2. Tampilkan Pesan Fatal
                    handler.post {
                        Toast.makeText(applicationContext, "AKUN INI TELAH LOGIN DI PERANGKAT LAIN!\nSesi Anda berakhir.", Toast.LENGTH_LONG).show()
                    }

                    // 3. Logout Lokal (Clear Data Penting)
                    prefsManager.isRegistered = false
                    // Kita tidak clearAll() agar data NISN/Nama masih ada untuk kemudahan login ulang jika perlu, 
                    // tapi isRegistered=false akan memaksa masuk RegistrationActivity.

                    // 4. Redirect ke Halaman Registrasi (Logout)
                    try {
                        val intent = Intent(applicationContext, RegistrationActivity::class.java)
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                        intent.putExtra("ERROR_MESSAGE", "Akun Anda telah digunakan di perangkat lain. Silakan login kembali jika ini kesalahan.")
                        startActivity(intent)
                    } catch (e: Exception) {
                        android.util.Log.e("MonitoringService", "Failed to redirect to registration: ${e.message}")
                    }

                    // 5. Matikan Service ini
                    stopSelf()
                }
            }

            override fun onCancelled(error: DatabaseError) {
                 android.util.Log.e("MonitoringService", "Device binding listener cancelled: ${error.message}")
            }
        }
        deviceBindingRef?.addValueEventListener(deviceBindingListener!!)
    }
    
    // Helper untuk stop lock task dari service (perlu activity context sebenarnya, tapi kita coba broadcast ke MainActivity)
    private fun stopLockTaskWrapper() {
        // Kita tidak bisa panggil stopLockTask dari Service.
        // Kirim broadcast ke MainActivity untuk melakukannya.
        val intent = Intent("com.sekolah.edulock.ACTION_STOP_KIOSK")
        intent.setPackage(packageName)
        sendBroadcast(intent)
    }

    private fun updateNotification(title: String, content: String, isSilent: Boolean = false) {
        val channelId = if (isSilent) "MonitoringChannelSilent" else "MonitoringChannel"
        
        // Buat channel secara dinamis jika belum ada (terutama untuk switch mode)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            if (isSilent) {
                val channel = NotificationChannel(
                    channelId,
                    "EduLock Silent Monitoring",
                    NotificationManager.IMPORTANCE_LOW
                )
                manager.createNotificationChannel(channel)
            } else {
                val channel = NotificationChannel(
                    channelId,
                    "EduLock Monitoring",
                    NotificationManager.IMPORTANCE_HIGH
                )
                manager.createNotificationChannel(channel)
            }
        }

        val builder = NotificationCompat.Builder(this, channelId)
            .setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(R.mipmap.ic_launcher)

        if (isSilent) {
            // Mode Senyap: Priority Low, Tanpa Full Screen Intent
            builder.setPriority(NotificationCompat.PRIORITY_LOW)
            builder.setCategory(NotificationCompat.CATEGORY_SERVICE)
        } else {
            // Mode Aktif: Priority High, Full Screen Intent (Aggressive)
            builder.setPriority(NotificationCompat.PRIORITY_HIGH)
            builder.setCategory(NotificationCompat.CATEGORY_ALARM)
            
            val fullScreenIntent = Intent(this, MainActivity::class.java)
            fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            val fullScreenPendingIntent = android.app.PendingIntent.getActivity(
                this,
                0,
                fullScreenIntent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
            )
            builder.setFullScreenIntent(fullScreenPendingIntent, true)
        }
            
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(1, builder.build())
    }

    private fun isAppOnForeground(context: Context): Boolean {
        return try {
            val prefs = PreferencesManager(context)
            if (prefs.isUiForeground) return true
            val now = System.currentTimeMillis()
            now - prefs.uiForegroundAt < 2500L
        } catch (_: Exception) {
            false
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)

        try {
            val isSilent = !prefsManager.isProtectionActive
            val isHoliday = prefsManager.isHolidayMode
            val isUninstall = prefsManager.isUninstallAuthorized
            val isPermission = permissionManager.isPermissionActive()
            val isSchoolTime = scheduleManager.isSchoolTime()
            val shouldEnforce = !isSilent && !isHoliday && !isUninstall && !isPermission && isSchoolTime

            if (shouldEnforce) {
                val intent = Intent(this, MainActivity::class.java)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                startActivity(intent)
            }
        } catch (_: Exception) {
        }

        try {
            val broadcastIntent = Intent(this, ServiceRestarter::class.java)
            sendBroadcast(broadcastIntent)
        } catch (_: Exception) {
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        
        // Unregister Screen Receiver
        try {
            unregisterReceiver(screenReceiver)
        } catch (e: Exception) {
            // Ignore if not registered
        }

        hideOverlayLock()

        // Remove listener
        if (uninstallDbRef != null && uninstallListener != null) {
            uninstallDbRef?.removeEventListener(uninstallListener!!)
        }
        if (holidayModeRef != null && holidayModeListener != null) {
            holidayModeRef?.removeEventListener(holidayModeListener!!)
        }
        if (protectionStatusRef != null && protectionStatusListener != null) {
            protectionStatusRef?.removeEventListener(protectionStatusListener!!)
        }
        if (schoolConfigRef != null && schoolConfigListener != null) {
            schoolConfigRef?.removeEventListener(schoolConfigListener!!)
        }
        if (weekdayScheduleRef != null && weekdayScheduleListener != null) {
            weekdayScheduleRef?.removeEventListener(weekdayScheduleListener!!)
        }
        if (holidayListRef != null && holidayListListener != null) {
            holidayListRef?.removeEventListener(holidayListListener!!)
        }
        if (gpsPolicyRef != null && gpsPolicyListener != null) {
            gpsPolicyRef?.removeEventListener(gpsPolicyListener!!)
        }
        if (schoolServiceStatusRef != null && schoolServiceStatusListener != null) {
            schoolServiceStatusRef?.removeEventListener(schoolServiceStatusListener!!)
        }
        if (deviceBindingRef != null && deviceBindingListener != null) {
            deviceBindingRef?.removeEventListener(deviceBindingListener!!)
        }

        handler.removeCallbacksAndMessages(null)
        // Restart service jika dimatikan
        val broadcastIntent = Intent(this, ServiceRestarter::class.java)
        sendBroadcast(broadcastIntent)
    }
}
