package com.satupintu.mobile

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.satupintu.mobile.data.service.TeacherNotificationListener
import com.satupintu.mobile.ui.AppNavigation
import com.satupintu.mobile.ui.theme.GaspaTheme
import com.satupintu.mobile.util.SecurityUtils
import com.satupintu.mobile.utils.SecurePreferences

import android.content.SharedPreferences
import android.widget.Toast
import kotlin.concurrent.thread
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    
    private var notificationListener: TeacherNotificationListener? = null
    private val previousUncaughtExceptionHandler = Thread.getDefaultUncaughtExceptionHandler()

    // #region debug-point E:reporter
    private fun reportTeacherDisciplineDebug(hypothesisId: String, location: String, msg: String, data: JSONObject = JSONObject()) {
        thread(start = true) {
            try {
                val body = JSONObject()
                    .put("sessionId", "teacher-discipline-home")
                    .put("runId", "pre-fix")
                    .put("hypothesisId", hypothesisId)
                    .put("location", location)
                    .put("msg", "[DEBUG] $msg")
                    .put("data", data)
                    .put("ts", System.currentTimeMillis())
                    .toString()
                val conn = java.net.URL("http://192.168.0.114:7777/event").openConnection() as java.net.HttpURLConnection
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.outputStream.use { it.write(body.toByteArray()) }
                conn.inputStream.close()
                conn.disconnect()
            } catch (_: Exception) {
            }
        }
    }
    // #endregion
    
    // Listen for login/logout changes to start/stop notifications immediately
    private val prefsListener = SharedPreferences.OnSharedPreferenceChangeListener { prefs, key ->
        if (key == "user_login_key" || key == "user_credential" || key == "user_role") {
            val loginKey = SecurityUtils.getStoredLoginKey(prefs)
            if (loginKey.isNotEmpty()) {
                checkUserRoleAndStartListening()
            } else {
                notificationListener?.stopListening()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // #region debug-point E:uncaught-exception-handler
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            reportTeacherDisciplineDebug(
                hypothesisId = "E",
                location = "MainActivity:onCreate",
                msg = "uncaught exception reached activity handler",
                data = JSONObject()
                    .put("thread", thread.name)
                    .put("type", throwable.javaClass.name)
                    .put("message", throwable.message ?: "")
                    .put("stack", throwable.stackTraceToString().take(2000))
            )
            previousUncaughtExceptionHandler?.uncaughtException(thread, throwable)
        }
        // #endregion
        if (SecurityUtils.isDeviceCompromised()) {
            Toast.makeText(this, "Perangkat tidak aman. Aplikasi ditutup untuk melindungi data sekolah.", Toast.LENGTH_LONG).show()
            finish()
            return
        }
        enableEdgeToEdge()
        
        // Register Preference Listener
        val prefs = SecurePreferences.getSessionPrefs(this)
        if (SecurityUtils.isSessionExpired(prefs)) {
            prefs.edit().clear().apply()
        }
        prefs.registerOnSharedPreferenceChangeListener(prefsListener)
        
        checkUserRoleAndStartListening()

        setContent {
            GaspaTheme {
                AppNavigation()
            }
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        val prefs = SecurePreferences.getSessionPrefs(this)
        prefs.unregisterOnSharedPreferenceChangeListener(prefsListener)
        notificationListener?.stopListening()
    }

    private fun checkUserRoleAndStartListening() {
        val prefs = SecurePreferences.getSessionPrefs(this)
        val loginKey = SecurityUtils.getStoredLoginKey(prefs)
        val role = SecurityUtils.getStoredRole(prefs)
        val schoolId = SecurityUtils.getStoredSchoolId(prefs)
        
        if (loginKey.isEmpty() || !SecurityUtils.isSessionConsistent(prefs, BuildConfig.FLAVOR.lowercase())) {
            notificationListener?.stopListening()
            return
        }

        val listener = notificationListener ?: TeacherNotificationListener(applicationContext).also {
            notificationListener = it
        }
        when (role) {
            "teacher", "staff" -> listener.startListening("Guru", loginKey, schoolId)
            "student" -> listener.startListening("Siswa", loginKey, schoolId)
        }
    }
}

