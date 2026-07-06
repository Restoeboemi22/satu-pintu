package com.sekolah.edulock

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.Toast
import android.content.Intent

class AntiUninstallService : AccessibilityService() {

    private val permissionManager by lazy { PermissionManager(this) }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val prefsManager = PreferencesManager(this)
        val now = System.currentTimeMillis()
        val isSettingsGrace = prefsManager.isSettingsOpen || now < prefsManager.settingsGraceUntil

        // TRACK FOREGROUND PACKAGE (Untuk Whitelist App Sekolah)
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val packageName = event.packageName?.toString() ?: ""
            prefsManager.lastForegroundPackage = packageName

            if (isSettingsGrace) {
                return
            }

            // LOGIKA WHITELIST ENFORCEMENT (Buka Paksa EduLock jika keluar dari Whitelist)
            // Hanya aktif jika Proteksi Aktif DAN Di Sekolah DAN BUKAN Mode Acara/Libur
            val scheduleManager = SchoolScheduleManager(prefsManager)
            if (prefsManager.isProtectionActive &&
                !prefsManager.isHolidayMode &&
                prefsManager.isInsideSchoolZone &&
                scheduleManager.isSchoolTime() &&
                !permissionManager.isPermissionActive()
            ) {
                // Daftar aplikasi yang DIPERBOLEHKAN (Whitelist)
                val allowedPackages = listOf(
                    "com.sekolah.edulock",
                    "com.sekolah.aplikasismpn3pacet",
                    // System UI Essentials
                    "android", 
                    "com.android.systemui", 
                    "com.android.permissioncontroller",
                    "com.google.android.permissioncontroller",
                    // Keyboards (Input Methods)
                    "com.google.android.inputmethod.latin", // Gboard
                    "com.samsung.android.honeyboard", // Samsung Keyboard
                    "com.sec.android.inputmethod" // Older Samsung
                )
                
                // Cek apakah package saat ini ada di whitelist atau merupakan keyboard/input method
                val isAllowed = allowedPackages.any { packageName.startsWith(it) } || 
                                packageName.contains("inputmethod") || 
                                packageName.contains("keyboard")

                if (!isAllowed) {
                     // BLOCK: Jika bukan aplikasi sekolah atau sistem, paksa kembali ke EduLock
                     android.util.Log.d("AntiUninstall", "Blocking package: $packageName")
                     
                     val intent = packageManager.getLaunchIntentForPackage("com.sekolah.edulock")
                     intent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                     startActivity(intent)
                     
                     Toast.makeText(this, "AKSES DITOLAK! Hanya Aplikasi Sekolah yang diizinkan.", Toast.LENGTH_SHORT).show()
                }
            }
        }

        // 0. Cek apakah uninstall diizinkan oleh admin (Authorized Uninstall) atau Setup belum selesai
        // Tambahkan bypass untuk Mode Acara/Libur agar siswa bebas menggunakan HP
        if (prefsManager.isUninstallAuthorized || !prefsManager.isSetupCompleted || prefsManager.isHolidayMode || isSettingsGrace) {
            // Setup Mode: Izinkan akses ke Settings agar user bisa mengaktifkan permission
            return 
        }

        // Monitor semua package yang relevan dengan Settings atau Installer
        val packageName = event.packageName?.toString() ?: ""
        
        // Daftar package yang perlu diawasi (Settings, Package Installer)
        // Permission Controller DIHAPUS dari blacklist agar runtime permission dialog bisa muncul
        val suspiciousPackages = listOf(
            "com.android.settings",
            "com.google.android.packageinstaller",
            "com.android.packageinstaller"
        )

        // Jika package termasuk yang dicurigai, lakukan pengecekan
        if (suspiciousPackages.any { packageName.contains(it) }) {
            val rootNode = rootInActiveWindow ?: return
            
            // Cek apakah halaman ini adalah halaman detail aplikasi EduLock atau dialog uninstall
            if (isEduLockAppInfoPage(rootNode)) {
                // Blokir akses dengan kembali ke Home atau Back
                performGlobalAction(GLOBAL_ACTION_BACK)
                performGlobalAction(GLOBAL_ACTION_HOME)
                
                Toast.makeText(this, "⛔ DILARANG! Minta Izin Uninstall dari Admin Sekolah dulu.", Toast.LENGTH_LONG).show()
                
                // Buka kembali aplikasi EduLock (BUKAN package settings!)
                val intent = packageManager.getLaunchIntentForPackage("com.sekolah.edulock")
                if (intent != null) {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    startActivity(intent)
                } else {
                    // Fallback jika intent null
                     performGlobalAction(GLOBAL_ACTION_HOME)
                }
            }
        }
    }

    private fun isEduLockAppInfoPage(rootNode: AccessibilityNodeInfo): Boolean {
        try {
            // 1. Cek Spesifik: Dialog Konfirmasi Uninstall
            // "Do you want to uninstall this app?" atau "Apakah Anda ingin mencopot pemasangan aplikasi ini?"
            val uninstallDialogKeywords = listOf(
                "Do you want to uninstall", "mencopot pemasangan",
                "uninstall this app", "hapus aplikasi ini"
            )
            for (keyword in uninstallDialogKeywords) {
                if (rootNode.findAccessibilityNodeInfosByText(keyword).isNotEmpty()) {
                    // Jika dialog muncul, kita asumsikan itu berbahaya jika EduLock baru saja aktif
                    // Tapi lebih aman cek judulnya juga
                    if (rootNode.findAccessibilityNodeInfosByText("EduLock").isNotEmpty()) {
                        return true
                    }
                }
            }

            // 2. Cek Halaman Detail Aplikasi atau Device Admin
            // Cari teks "EduLock"
            val list = rootNode.findAccessibilityNodeInfosByText("EduLock")
            if (list.isNotEmpty()) {

                val deviceAdminScreenKeywords = listOf(
                    "Aplikasi admin perangkat",
                    "Device admin apps",
                    "Device administrators",
                    "Administrator perangkat",
                    "Administrators perangkat",
                    "Admin perangkat"
                )
                for (keyword in deviceAdminScreenKeywords) {
                    val nodes = rootNode.findAccessibilityNodeInfosByText(keyword)
                    if (nodes.isNotEmpty()) {
                        return true
                    }
                }
                
                val keywords = listOf(
                    "Uninstall", "Copot", "Hapus", 
                    "Force stop", "Paksa berhenti", "Berhenti",
                    "Disable", "Nonaktifkan",
                    "Deactivate", "Nonaktifkan admin", // Untuk Device Admin
                    "Device admin", "Administrator perangkat",
                    "Storage", "Penyimpanan", // Mencegah Clear Data
                    "Permissions", "Izin", // Mencegah ubah izin
                    "Open", "Buka" // Tombol Buka biasanya ada di App Info, ini indikator kuat kita di App Info
                )

                for (keyword in keywords) {
                    // Case insensitive search
                    val nodes = rootNode.findAccessibilityNodeInfosByText(keyword)
                    if (nodes.isNotEmpty()) {
                        return true
                    }
                }
            }
        } catch (e: Exception) {
            // Safe fallback
            return false
        }
        
        return false
    }

    override fun onInterrupt() {
        // Required method
    }
}
