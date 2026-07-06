package com.sekolah.edulock

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.journeyapps.barcodescanner.BarcodeCallback
import com.journeyapps.barcodescanner.BarcodeResult
import com.journeyapps.barcodescanner.DecoratedBarcodeView

class BarcodeScannerActivity : AppCompatActivity() {

    private lateinit var barcodeView: DecoratedBarcodeView
    private lateinit var permissionManager: PermissionManager
    private lateinit var prefsManager: PreferencesManager

    private val CAMERA_PERMISSION_CODE = 200

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_barcode_scanner)

        // Initialize
        permissionManager = PermissionManager(this)
        prefsManager = PreferencesManager(this)

        // Initialize barcode view
        barcodeView = findViewById(R.id.barcodeScanner)

        // Request camera permission
        if (checkCameraPermission()) {
            startScanning()
        } else {
            requestCameraPermission()
        }
    }

    private fun checkCameraPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun requestCameraPermission() {
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.CAMERA),
            CAMERA_PERMISSION_CODE
        )
    }

    private fun startScanning() {
        barcodeView.decodeContinuous(callback)
    }

    private val callback = object : BarcodeCallback {
        override fun barcodeResult(result: BarcodeResult?) {
            if (result == null || result.text == null) {
                return
            }

            // Pause scanning
            barcodeView.pause()

            // Get scanned code
            val scannedCode = result.text

            // Validate code
            validateScannedCode(scannedCode)
        }

        override fun possibleResultPoints(resultPoints: MutableList<com.google.zxing.ResultPoint>?) {
            // Optional: visualize scanning points
        }
    }

    private fun validateScannedCode(code: String) {
        // Show loading
        Toast.makeText(this, "Memvalidasi kode...", Toast.LENGTH_SHORT).show()

        // Validate dengan PermissionManager (Firebase)
        permissionManager.validateCode(code) { duration ->
            if (duration != null) {
                // Kode valid
                permissionManager.grantPermission(code, duration)

                // Log ke database
                val nisn = prefsManager.nisn
                permissionManager.logPermissionUsage(nisn, code, duration)

                // FIX: Start Session agar tidak auto-revoke oleh PermissionManager
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
                    "❌ QR Code tidak valid atau sudah kedaluwarsa!\nSilakan scan QR code terbaru dari guru.",
                    Toast.LENGTH_LONG
                ).show()

                // Log pelanggaran
                val nisn = prefsManager.nisn
                permissionManager.logViolation(
                    nisn,
                    "INVALID_PERMISSION_CODE",
                    "Mencoba scan QR code tidak valid: $code"
                )

                // Resume scanning
                barcodeView.resume()
            }
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (requestCode == CAMERA_PERMISSION_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startScanning()
            } else {
                Toast.makeText(
                    this,
                    "Izin kamera diperlukan untuk scan barcode",
                    Toast.LENGTH_SHORT
                ).show()
                finish()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        try {
            prefsManager.isUiForeground = true
            prefsManager.uiForegroundAt = System.currentTimeMillis()
        } catch (_: Exception) {
        }
        barcodeView.resume()
    }

    override fun onPause() {
        super.onPause()
        try {
            prefsManager.isUiForeground = false
            prefsManager.uiForegroundAt = System.currentTimeMillis()
        } catch (_: Exception) {
        }
        barcodeView.pause()
    }

    override fun onBackPressed() {
        finish()
    }
}
