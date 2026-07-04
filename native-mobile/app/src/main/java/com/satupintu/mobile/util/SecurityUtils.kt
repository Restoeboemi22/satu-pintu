package com.satupintu.mobile.util

import android.content.Context
import android.content.SharedPreferences
import android.location.Location
import android.os.Build
import android.os.Debug
import android.provider.Settings
import com.google.firebase.FirebaseApp
import com.satupintu.mobile.BuildConfig
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

object SecurityUtils {
    private const val SESSION_MAX_AGE_DAYS = 7L
    private val sessionMaxAgeMs = TimeUnit.DAYS.toMillis(SESSION_MAX_AGE_DAYS)
    private val schoolScopedRoles = setOf("student", "teacher", "staff", "principal")
    private val rootPaths = listOf(
        "/system/app/Superuser.apk",
        "/sbin/su",
        "/system/bin/su",
        "/system/xbin/su",
        "/data/local/xbin/su",
        "/data/local/bin/su",
        "/system/sd/xbin/su",
        "/system/bin/failsafe/su",
        "/data/local/su",
        "/system/bin/.ext/.su",
        "/system/usr/we-need-root/su",
        "/cache/su",
        "/data/su",
        "/dev/com.koushikdutta.superuser.daemon/",
        "/system/xbin/magisk",
        "/sbin/magisk"
    )

    fun sha256Hex(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }

    fun getLegacyAndroidId(context: Context): String {
        return Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)?.trim().orEmpty()
    }

    fun getDeviceBindingId(context: Context): String {
        val raw = listOf(
            getLegacyAndroidId(context),
            Build.BRAND.orEmpty(),
            Build.DEVICE.orEmpty(),
            Build.MODEL.orEmpty(),
            Build.MANUFACTURER.orEmpty(),
            Build.HARDWARE.orEmpty()
        ).joinToString("|")
        return sha256Hex(raw)
    }

    fun matchesStoredDeviceBinding(context: Context, storedDeviceId: String?): Boolean {
        val stored = storedDeviceId?.trim().orEmpty()
        if (stored.isBlank()) return true
        val candidates = setOf(getDeviceBindingId(context), getLegacyAndroidId(context)).filter { it.isNotBlank() }
        return candidates.contains(stored)
    }

    fun isValidCoordinate(lat: Double, lng: Double): Boolean {
        return lat.isFinite() && lng.isFinite() && lat in -90.0..90.0 && lng in -180.0..180.0
    }

    fun isMockLocation(location: Location): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            location.isMock
        } else {
            @Suppress("DEPRECATION")
            location.isFromMockProvider
        }
    }

    fun isAutomaticTimeEnabled(context: Context): Boolean {
        return try {
            Settings.Global.getInt(context.contentResolver, Settings.Global.AUTO_TIME, 1) == 1
        } catch (_: Exception) {
            true
        }
    }

    fun isAutomaticTimeZoneEnabled(context: Context): Boolean {
        return try {
            Settings.Global.getInt(context.contentResolver, Settings.Global.AUTO_TIME_ZONE, 1) == 1
        } catch (_: Exception) {
            true
        }
    }

    fun isSessionExpired(prefs: SharedPreferences, now: Long = System.currentTimeMillis()): Boolean {
        val startedAt = prefs.getLong("session_started_at", 0L)
        if (startedAt <= 0L) return false
        return now - startedAt > sessionMaxAgeMs
    }

    fun persistSession(editor: SharedPreferences.Editor, now: Long = System.currentTimeMillis()) {
        editor.putLong("session_started_at", now)
        editor.putLong("session_last_seen_at", now)
    }

    fun touchSession(editor: SharedPreferences.Editor, now: Long = System.currentTimeMillis()) {
        editor.putLong("session_last_seen_at", now)
    }

    fun normalizeScope(value: String?): String {
        return value?.trim()?.lowercase().orEmpty()
    }

    fun getStoredRole(prefs: SharedPreferences): String {
        return normalizeScope(prefs.getString("user_role", ""))
    }

    fun getStoredSchoolId(prefs: SharedPreferences): String {
        return normalizeScope(prefs.getString("user_school_id", ""))
    }

    fun getStoredLoginKey(prefs: SharedPreferences): String {
        return (prefs.getString("user_login_key", "")
            ?: prefs.getString("user_credential", "")
            ?: "").trim()
    }

    fun getStoredStudentId(prefs: SharedPreferences): String {
        return prefs.getString("user_student_id", "").orEmpty().trim()
    }

    fun getStoredStudentKey(prefs: SharedPreferences): String {
        return getStoredStudentId(prefs).ifBlank { getStoredLoginKey(prefs) }
    }

    fun getStoredTeacherKey(prefs: SharedPreferences): String {
        return prefs.getString("user_teacher_id", "").orEmpty().trim().ifBlank {
            getStoredLoginKey(prefs)
        }
    }

    fun getStoredBoundary(prefs: SharedPreferences): String {
        return normalizeScope(prefs.getString("user_boundary", ""))
    }

    fun isRoleAllowedForFlavor(role: String, flavor: String): Boolean {
        val normalizedRole = normalizeScope(role)
        return when (normalizeScope(flavor)) {
            "siswa" -> normalizedRole == "student"
            "guru" -> normalizedRole == "teacher" || normalizedRole == "staff"
            "kepala" -> normalizedRole == "principal"
            else -> false
        }
    }

    fun isFirebaseProjectAllowed(projectId: String?): Boolean {
        val normalizedProjectId = projectId?.trim().orEmpty()
        if (normalizedProjectId.isBlank()) return true
        val allowList = BuildConfig.ALLOWED_FIREBASE_PROJECT_IDS
            .split(",")
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .toSet()
        return allowList.isEmpty() || allowList.contains(normalizedProjectId)
    }

    fun getActiveFirebaseProjectId(): String {
        return try {
            FirebaseApp.getInstance().options.projectId?.trim().orEmpty()
        } catch (_: Exception) {
            ""
        }
    }

    fun isSessionConsistent(prefs: SharedPreferences, flavor: String): Boolean {
        val role = getStoredRole(prefs)
        if (!isRoleAllowedForFlavor(role, flavor)) return false

        val schoolId = getStoredSchoolId(prefs)
        if (role in schoolScopedRoles && schoolId.isBlank()) return false

        val expectedBoundary = normalizeScope(BuildConfig.MOBILE_BOUNDARY)
        val storedBoundary = getStoredBoundary(prefs)
        if (storedBoundary.isNotBlank() && storedBoundary != expectedBoundary) return false

        val loginKey = getStoredLoginKey(prefs)
        return when (role) {
            "student" -> getStoredStudentId(prefs).isNotBlank() && loginKey.isNotBlank()
            "teacher" -> getStoredTeacherKey(prefs).isNotBlank()
            "staff" -> loginKey.isNotBlank()
            "principal" -> loginKey.isNotBlank()
            else -> false
        }
    }

    fun isDeviceCompromised(): Boolean {
        if (BuildConfig.DEBUG) return false
        val hasTestKeys = Build.TAGS?.contains("test-keys") == true
        val hasSu = rootPaths.any { File(it).exists() }
        val rootedProps = listOf(Build.FINGERPRINT, Build.HARDWARE, Build.MODEL, Build.PRODUCT)
            .joinToString(" ")
            .lowercase()
        val emulatorSignals = rootedProps.contains("generic") ||
            rootedProps.contains("emulator") ||
            rootedProps.contains("sdk_gphone")
        return hasTestKeys || hasSu || emulatorSignals || Debug.isDebuggerConnected()
    }

    fun isRouteAllowed(route: String, role: String, flavor: String): Boolean {
        val normalizedRole = role.trim().lowercase()
        val normalizedFlavor = flavor.trim().lowercase()
        return when (route) {
            "home", "profile", "tasks" -> when (normalizedFlavor) {
                "siswa" -> normalizedRole == "student"
                "guru" -> normalizedRole == "teacher" || normalizedRole == "staff"
                "kepala" -> normalizedRole == "principal"
                else -> false
            }
            "attendance", "library", "tools", "tools_english_dictionary", "tools_javanese_dictionary", "discipline", "virtual_pet", "seven_habits", "prayer", "halo_spentgapa", "notifications" ->
                normalizedFlavor == "siswa" && normalizedRole == "student"
            "osis_discipline" ->
                normalizedFlavor == "guru" && normalizedRole == "staff"
            "teacher_student_list", "teacher_attendance", "teacher_prayer", "teacher_discipline", "teacher_literacy", "teacher_bullying_reports", "teacher_notifications", "teacher_seven_habits" ->
                normalizedFlavor == "guru" && normalizedRole == "teacher"
            "principal_attendance", "principal_literacy", "principal_prayer", "principal_seven_habits", "principal_discipline", "principal_bullying" ->
                normalizedFlavor == "kepala" && normalizedRole == "principal"
            else -> true
        }
    }
}

