package com.sekolah.edulock

import android.Manifest
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class SetupActivity : AppCompatActivity() {

    private lateinit var btnSetupLocation: Button
    private lateinit var btnSetupCamera: Button
    private lateinit var btnSetupAdmin: Button
    private lateinit var btnSetupAccessibility: Button
    private lateinit var btnSetupOverlay: Button
    private lateinit var btnSetupBattery: Button // New Button
    private lateinit var btnStartApp: Button
    private lateinit var prefsManager: PreferencesManager
    private lateinit var devicePolicyManager: DevicePolicyManager
    private lateinit var compName: ComponentName

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)

        prefsManager = PreferencesManager(this)
        devicePolicyManager = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        compName = ComponentName(this, DeviceAdminReceiver::class.java)

        initViews()
        setupListeners()
    }

    override fun onResume() {
        super.onResume()
        prefsManager.isSettingsOpen = false
        prefsManager.settingsGraceUntil = 0L
        checkStatus()
    }

    private fun initViews() {
        btnSetupLocation = findViewById(R.id.btnSetupLocation)
        btnSetupCamera = findViewById(R.id.btnSetupCamera)
        btnSetupAdmin = findViewById(R.id.btnSetupAdmin)
        btnSetupAccessibility = findViewById(R.id.btnSetupAccessibility)
        btnSetupOverlay = findViewById(R.id.btnSetupOverlay)
        btnSetupBattery = findViewById(R.id.btnSetupBattery) // Bind new button
        btnStartApp = findViewById(R.id.btnStartApp)
    }

    private fun setupListeners() {
        btnSetupLocation.setOnClickListener {
            requestLocationPermission()
        }

        btnSetupCamera.setOnClickListener {
            requestCameraPermission()
        }

        btnSetupAdmin.setOnClickListener {
            requestDeviceAdmin()
        }

        btnSetupAccessibility.setOnClickListener {
            requestAccessibility()
        }

        btnSetupOverlay.setOnClickListener {
            requestOverlayPermission()
        }

        btnSetupBattery.setOnClickListener {
            requestBatteryOptimization()
        }

        btnStartApp.setOnClickListener {
            if (areAllPermissionsGranted()) {
                prefsManager.isSetupCompleted = true
                startActivity(Intent(this, MainActivity::class.java))
                finish()
            } else {
                Toast.makeText(this, "Mohon lengkapi semua izin terlebih dahulu", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun checkStatus() {
        val isLocationGranted = isLocationGranted()
        val isCameraGranted = isCameraGranted()
        val isAdminActive = devicePolicyManager.isAdminActive(compName)
        val isAccessibilityEnabled = isAccessibilityServiceEnabled()
        val isOverlayGranted = Settings.canDrawOverlays(this)
        val isBatteryIgnored = isBatteryOptimizationIgnored()

        updateButtonStatus(btnSetupLocation, isLocationGranted)
        updateButtonStatus(btnSetupCamera, isCameraGranted)
        updateButtonStatus(btnSetupAdmin, isAdminActive)
        updateButtonStatus(btnSetupAccessibility, isAccessibilityEnabled)
        updateButtonStatus(btnSetupOverlay, isOverlayGranted)
        updateButtonStatus(btnSetupBattery, isBatteryIgnored)

        val allGranted = isLocationGranted && isCameraGranted && isAdminActive && isAccessibilityEnabled && isOverlayGranted && isBatteryIgnored
        btnStartApp.isEnabled = allGranted
        btnStartApp.alpha = if (allGranted) 1.0f else 0.5f
    }
    
    private fun isBatteryOptimizationIgnored(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            return powerManager.isIgnoringBatteryOptimizations(packageName)
        }
        return true
    }

    private fun requestBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            prefsManager.isSettingsOpen = true
            prefsManager.settingsGraceUntil = System.currentTimeMillis() + 120_000L
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
            intent.data = Uri.parse("package:$packageName")
            try {
                startActivity(intent)
            } catch (e: Exception) {
                // Fallback to settings
                Toast.makeText(this, "Buka Pengaturan Baterai manual", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun areAllPermissionsGranted(): Boolean {
         return isLocationGranted() && 
                isCameraGranted() &&
                devicePolicyManager.isAdminActive(compName) &&
                isAccessibilityServiceEnabled() &&
                Settings.canDrawOverlays(this) &&
                isBatteryOptimizationIgnored()
    }

    private fun updateButtonStatus(button: Button, isGranted: Boolean) {
        if (isGranted) {
            button.text = "SUDAH AKTIF"
            button.setBackgroundColor(ContextCompat.getColor(this, android.R.color.holo_green_dark))
            button.isEnabled = false
        } else {
            button.text = "AKTIFKAN"
            button.setBackgroundColor(ContextCompat.getColor(this, R.color.primary)) // Fallback to default
            button.isEnabled = true
        }
    }

    private fun isLocationGranted(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }

    private fun isCameraGranted(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    }

    private fun requestLocationPermission() {
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
            100
        )
    }

    private fun requestCameraPermission() {
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.CAMERA),
            101
        )
    }

    private fun requestDeviceAdmin() {
        if (!devicePolicyManager.isAdminActive(compName)) {
            prefsManager.isSettingsOpen = true
            prefsManager.settingsGraceUntil = System.currentTimeMillis() + 120_000L
            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, compName)
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Aplikasi membutuhkan hak akses Admin untuk mengunci layar saat ujian.")
            startActivity(intent)
        }
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val am = getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        val enabledServices = am.getEnabledAccessibilityServiceList(android.accessibilityservice.AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
        for (service in enabledServices) {
            if (service.resolveInfo.serviceInfo.packageName == packageName &&
                service.resolveInfo.serviceInfo.name.endsWith("AntiUninstallService")) {
                return true
            }
        }
        return false
    }

    private fun requestAccessibility() {
        prefsManager.isSettingsOpen = true
        prefsManager.settingsGraceUntil = System.currentTimeMillis() + 120_000L
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        startActivity(intent)
        Toast.makeText(this, "Cari 'EduLock' dan aktifkan layanan aksesibilitas", Toast.LENGTH_LONG).show()
    }

    private fun requestOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            try {
                prefsManager.isSettingsOpen = true
                prefsManager.settingsGraceUntil = System.currentTimeMillis() + 120_000L
                // Gunakan intent umum tanpa URI package untuk kompatibilitas maksimal
                val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
                
                // Cek apakah ada activity yang bisa menangani intent ini
                if (intent.resolveActivity(packageManager) != null) {
                    startActivity(intent)
                    Toast.makeText(this, "Silakan cari 'EduLock' dan aktifkan izin", Toast.LENGTH_LONG).show()
                } else {
                    // Jika tidak ada intent handler standar, coba buka settings utama
                    Toast.makeText(this, "Menu Overlay tidak ditemukan. Silakan buka Pengaturan -> Aplikasi -> Akses Khusus -> Tampil di atas aplikasi lain.", Toast.LENGTH_LONG).show()
                    startActivity(Intent(Settings.ACTION_SETTINGS))
                }
            } catch (e: Exception) {
                Toast.makeText(this, "Error: ${e.message}. Silakan aktifkan manual di Pengaturan.", Toast.LENGTH_LONG).show()
                e.printStackTrace()
            }
        }
    }

}
