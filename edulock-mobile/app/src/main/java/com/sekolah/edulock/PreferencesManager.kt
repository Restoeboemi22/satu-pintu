package com.sekolah.edulock

import android.content.Context
import android.content.SharedPreferences
import android.provider.Settings

class PreferencesManager(context: Context) {

    val prefs: SharedPreferences = context.getSharedPreferences(
        PREFS_NAME, Context.MODE_PRIVATE
    )

    init {
        // Hapus logika migrasi lama karena kita ganti KEY_ADMIN_PASSWORD
        // Hal ini akan otomatis memaksa aplikasi menggunakan default value baru
    }

    companion object {
        private const val PREFS_NAME = "EduLockPrefs"

        // Keys
        private const val KEY_NISN = "nisn"
        private const val KEY_STUDENT_NAME = "student_name"
        private const val KEY_CLASS = "class"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_IS_REGISTERED = "is_registered"
        private const val KEY_SCHOOL_ID = "school_id"
        private const val KEY_SCHOOL_LAT = "school_lat"
        private const val KEY_SCHOOL_LON = "school_lon"
        private const val KEY_SCHOOL_RADIUS = "school_radius"
        private const val KEY_SCHOOL_START_HOUR = "school_start_hour"
        private const val KEY_SCHOOL_END_HOUR = "school_end_hour"
        private const val KEY_SCHOOL_START_MINUTE = "school_start_minute"
        private const val KEY_SCHOOL_END_MINUTE = "school_end_minute"
        private const val KEY_WEEKDAY_SCHEDULE_JSON = "weekday_schedule_json"
        private const val KEY_HOLIDAY_LIST_JSON = "holiday_list_json"
        private const val KEY_GPS_OFF_WARN_MS = "gps_off_warn_ms"
        private const val KEY_GPS_OFF_LOCK_MS = "gps_off_lock_ms"
        private const val KEY_ADMIN_PASSWORD = "admin_password_final" // Kunci baru versi final
        private const val KEY_FIRST_LAUNCH = "first_launch"
        private const val KEY_STUDENT_ID = "student_id"
        private const val KEY_UNINSTALL_AUTHORIZED = "uninstall_authorized"
        
        // Offline & Monitoring Keys
        private const val KEY_LAST_ONLINE_TIMESTAMP = "last_online_timestamp"
        private const val KEY_OFFLINE_DURATION_ACCUMULATED = "offline_duration_accumulated"
        private const val KEY_TRUST_SCORE = "trust_score"
        private const val KEY_GRACE_PERIOD_END = "grace_period_end"
        private const val KEY_IS_INSIDE_SCHOOL_ZONE = "is_inside_school_zone"
        private const val KEY_LAST_DAILY_SCORE_UPDATE = "last_daily_score_update"
        private const val KEY_VIOLATION_STREAK = "violation_streak"
        private const val KEY_LAST_GPS_ACTIVE_TIMESTAMP = "last_gps_active_timestamp"
        private const val KEY_IS_HOLIDAY_MODE = "is_holiday_mode"
        private const val KEY_IS_EMULATOR = "is_emulator"
        private const val KEY_IS_FORCED_LOCATION = "is_forced_location"
        private const val KEY_IS_SETTINGS_OPEN = "is_settings_open"
        private const val KEY_SETTINGS_GRACE_UNTIL = "settings_grace_until"
        private const val KEY_IS_PROTECTION_ACTIVE = "is_protection_active"
        private const val KEY_SETUP_COMPLETED = "setup_completed"
        private const val KEY_UI_FOREGROUND = "ui_foreground"
        private const val KEY_UI_FOREGROUND_AT = "ui_foreground_at"
        private const val KEY_LAST_FOREGROUND_PACKAGE = "last_foreground_package"
        private const val KEY_APP_SWITCH_TIMESTAMP = "app_switch_timestamp"
    }

    var appSwitchTimestamp: Long
        get() = prefs.getLong(KEY_APP_SWITCH_TIMESTAMP, 0L)
        set(value) = prefs.edit().putLong(KEY_APP_SWITCH_TIMESTAMP, value).apply()

    var lastForegroundPackage: String?
        get() = prefs.getString(KEY_LAST_FOREGROUND_PACKAGE, null)
        set(value) = prefs.edit().putString(KEY_LAST_FOREGROUND_PACKAGE, value).apply()

    var isProtectionActive: Boolean
        get() = prefs.getBoolean(KEY_IS_PROTECTION_ACTIVE, true) // Default TRUE (Active Mode)
        set(value) = prefs.edit().putBoolean(KEY_IS_PROTECTION_ACTIVE, value).apply()

    var isSetupCompleted: Boolean
        get() = prefs.getBoolean(KEY_SETUP_COMPLETED, false)
        set(value) = prefs.edit().putBoolean(KEY_SETUP_COMPLETED, value).apply()

    var isUiForeground: Boolean
        get() = prefs.getBoolean(KEY_UI_FOREGROUND, false)
        set(value) = prefs.edit().putBoolean(KEY_UI_FOREGROUND, value).apply()

    var uiForegroundAt: Long
        get() = prefs.getLong(KEY_UI_FOREGROUND_AT, 0L)
        set(value) = prefs.edit().putLong(KEY_UI_FOREGROUND_AT, value).apply()

    var isSettingsOpen: Boolean
        get() = prefs.getBoolean(KEY_IS_SETTINGS_OPEN, false)
        set(value) = prefs.edit().putBoolean(KEY_IS_SETTINGS_OPEN, value).apply()

    var settingsGraceUntil: Long
        get() = prefs.getLong(KEY_SETTINGS_GRACE_UNTIL, 0L)
        set(value) = prefs.edit().putLong(KEY_SETTINGS_GRACE_UNTIL, value).apply()

    var isEmulator: Boolean
        get() = prefs.getBoolean(KEY_IS_EMULATOR, false)
        set(value) = prefs.edit().putBoolean(KEY_IS_EMULATOR, value).apply()

    var isForcedLocation: Boolean
        get() = prefs.getBoolean(KEY_IS_FORCED_LOCATION, false)
        set(value) = prefs.edit().putBoolean(KEY_IS_FORCED_LOCATION, value).apply()

    var isEmergencyUnlocked: Boolean
        get() = prefs.getBoolean("is_emergency_unlocked", false)
        set(value) = prefs.edit().putBoolean("is_emergency_unlocked", value).apply()

    var isHolidayMode: Boolean
        get() = prefs.getBoolean(KEY_IS_HOLIDAY_MODE, false)
        set(value) = prefs.edit().putBoolean(KEY_IS_HOLIDAY_MODE, value).apply()

    // Offline Monitoring
    var lastGpsActiveTimestamp: Long
        get() = prefs.getLong(KEY_LAST_GPS_ACTIVE_TIMESTAMP, System.currentTimeMillis())
        set(value) = prefs.edit().putLong(KEY_LAST_GPS_ACTIVE_TIMESTAMP, value).apply()

    var violationStreak: Int
        get() = prefs.getInt(KEY_VIOLATION_STREAK, 0)
        set(value) = prefs.edit().putInt(KEY_VIOLATION_STREAK, value).apply()

    var lastDailyScoreUpdate: Long
        get() = prefs.getLong(KEY_LAST_DAILY_SCORE_UPDATE, 0L)
        set(value) = prefs.edit().putLong(KEY_LAST_DAILY_SCORE_UPDATE, value).apply()

    var isInsideSchoolZone: Boolean
        get() = prefs.getBoolean(KEY_IS_INSIDE_SCHOOL_ZONE, false)
        set(value) = prefs.edit().putBoolean(KEY_IS_INSIDE_SCHOOL_ZONE, value).apply()

    var lastOnlineTimestamp: Long
        get() = prefs.getLong(KEY_LAST_ONLINE_TIMESTAMP, System.currentTimeMillis())
        set(value) = prefs.edit().putLong(KEY_LAST_ONLINE_TIMESTAMP, value).apply()

    var offlineDurationAccumulated: Long
        get() = prefs.getLong(KEY_OFFLINE_DURATION_ACCUMULATED, 0L)
        set(value) = prefs.edit().putLong(KEY_OFFLINE_DURATION_ACCUMULATED, value).apply()

    var trustScore: Int
        get() = prefs.getInt(KEY_TRUST_SCORE, 100) // Default score 100
        set(value) = prefs.edit().putInt(KEY_TRUST_SCORE, value).apply()
        
    var gracePeriodEndTime: Long
        get() = prefs.getLong(KEY_GRACE_PERIOD_END, 0L)
        set(value) = prefs.edit().putLong(KEY_GRACE_PERIOD_END, value).apply()

    // Student info
    var isUninstallAuthorized: Boolean
        get() = prefs.getBoolean(KEY_UNINSTALL_AUTHORIZED, false)
        set(value) = prefs.edit().putBoolean(KEY_UNINSTALL_AUTHORIZED, value).apply()

    var studentId: Long
        get() = prefs.getLong(KEY_STUDENT_ID, -1)
        set(value) = prefs.edit().putLong(KEY_STUDENT_ID, value).apply()

    var nisn: String
        get() = prefs.getString(KEY_NISN, "") ?: ""
        set(value) = prefs.edit().putString(KEY_NISN, value).apply()

    var studentName: String
        get() = prefs.getString(KEY_STUDENT_NAME, "") ?: ""
        set(value) = prefs.edit().putString(KEY_STUDENT_NAME, value).apply()

    var studentClass: String
        get() = prefs.getString(KEY_CLASS, "") ?: ""
        set(value) = prefs.edit().putString(KEY_CLASS, value).apply()

    var schoolId: String
        get() = prefs.getString(KEY_SCHOOL_ID, "") ?: ""
        set(value) = prefs.edit().putString(KEY_SCHOOL_ID, value).apply()

    var deviceId: String
        get() = prefs.getString(KEY_DEVICE_ID, "") ?: ""
        set(value) = prefs.edit().putString(KEY_DEVICE_ID, value).apply()

    var isRegistered: Boolean
        get() = prefs.getBoolean(KEY_IS_REGISTERED, false)
        set(value) = prefs.edit().putBoolean(KEY_IS_REGISTERED, value).apply()

    // School settings
    var schoolLatitude: Double
        get() = prefs.getString(KEY_SCHOOL_LAT, "-7.2575")?.toDouble() ?: -7.2575
        set(value) = prefs.edit().putString(KEY_SCHOOL_LAT, value.toString()).apply()

    var schoolLongitude: Double
        get() = prefs.getString(KEY_SCHOOL_LON, "112.7521")?.toDouble() ?: 112.7521
        set(value) = prefs.edit().putString(KEY_SCHOOL_LON, value.toString()).apply()

    var schoolRadius: Double
        get() = prefs.getString(KEY_SCHOOL_RADIUS, "500.0")?.toDouble() ?: 500.0
        set(value) = prefs.edit().putString(KEY_SCHOOL_RADIUS, value.toString()).apply()

    var schoolStartHour: Int
        get() = prefs.getInt(KEY_SCHOOL_START_HOUR, 7)
        set(value) = prefs.edit().putInt(KEY_SCHOOL_START_HOUR, value).apply()

    var schoolEndHour: Int
        get() = prefs.getInt(KEY_SCHOOL_END_HOUR, 15)
        set(value) = prefs.edit().putInt(KEY_SCHOOL_END_HOUR, value).apply()
    
    var schoolStartMinute: Int
        get() = prefs.getInt(KEY_SCHOOL_START_MINUTE, 0)
        set(value) = prefs.edit().putInt(KEY_SCHOOL_START_MINUTE, value).apply()

    var schoolEndMinute: Int
        get() = prefs.getInt(KEY_SCHOOL_END_MINUTE, 0)
        set(value) = prefs.edit().putInt(KEY_SCHOOL_END_MINUTE, value).apply()

    var weekdayScheduleJson: String
        get() = prefs.getString(KEY_WEEKDAY_SCHEDULE_JSON, "") ?: ""
        set(value) = prefs.edit().putString(KEY_WEEKDAY_SCHEDULE_JSON, value).apply()

    var holidayListJson: String
        get() = prefs.getString(KEY_HOLIDAY_LIST_JSON, "") ?: ""
        set(value) = prefs.edit().putString(KEY_HOLIDAY_LIST_JSON, value).apply()

    var gpsOffWarnMs: Long
        get() = prefs.getLong(KEY_GPS_OFF_WARN_MS, 3 * 60 * 1000L)
        set(value) = prefs.edit().putLong(KEY_GPS_OFF_WARN_MS, value).apply()

    var gpsOffLockMs: Long
        get() = prefs.getLong(KEY_GPS_OFF_LOCK_MS, 5 * 60 * 1000L)
        set(value) = prefs.edit().putLong(KEY_GPS_OFF_LOCK_MS, value).apply()

    // Admin settings
    var adminPassword: String
        get() = prefs.getString(KEY_ADMIN_PASSWORD, "SpEnT9@P@_2007") ?: "SpEnT9@P@_2007"
        set(value) = prefs.edit().putString(KEY_ADMIN_PASSWORD, value).apply()

    var isFirstLaunch: Boolean
        get() = prefs.getBoolean(KEY_FIRST_LAUNCH, true)
        set(value) = prefs.edit().putBoolean(KEY_FIRST_LAUNCH, value).apply()

    // Get device ID (Android ID)
    fun getAndroidDeviceId(context: Context): String {
        return Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        )
    }

    // Clear all data
    fun clearAll() {
        prefs.edit().clear().apply()
    }

    // Save student registration
    fun saveStudentRegistration(studentId: Long, nisn: String, name: String, className: String, deviceId: String) {
        prefs.edit().apply {
            putLong(KEY_STUDENT_ID, studentId)
            putString(KEY_NISN, nisn)
            putString(KEY_STUDENT_NAME, name)
            putString(KEY_CLASS, className)
            putString(KEY_DEVICE_ID, deviceId)
            putBoolean(KEY_IS_REGISTERED, true)
            putBoolean(KEY_FIRST_LAUNCH, false)
        }.apply()
    }
}
