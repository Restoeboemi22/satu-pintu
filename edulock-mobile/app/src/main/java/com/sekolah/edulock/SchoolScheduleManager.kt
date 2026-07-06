package com.sekolah.edulock

import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class SchoolScheduleManager(private val prefs: PreferencesManager) {

    private data class DaySchedule(
        val enabled: Boolean,
        val start: String,
        val end: String
    )

    private var lastScheduleJson: String? = null
    private var scheduleCache: Map<String, DaySchedule> = emptyMap()

    private var lastHolidayJson: String? = null
    private var holidayCache: Map<String, String> = emptyMap()

    private fun getTodayDateKey(): String {
        return try {
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            sdf.format(System.currentTimeMillis())
        } catch (_: Exception) {
            ""
        }
    }

    private fun getTodayWeekdayKey(): String {
        val calendar = Calendar.getInstance()
        return when (calendar.get(Calendar.DAY_OF_WEEK)) {
            Calendar.MONDAY -> "mon"
            Calendar.TUESDAY -> "tue"
            Calendar.WEDNESDAY -> "wed"
            Calendar.THURSDAY -> "thu"
            Calendar.FRIDAY -> "fri"
            Calendar.SATURDAY -> "sat"
            Calendar.SUNDAY -> "sun"
            else -> "mon"
        }
    }

    private fun parseMinutes(hhmm: String): Int? {
        val parts = hhmm.split(":")
        val h = parts.getOrNull(0)?.toIntOrNull() ?: return null
        val m = parts.getOrNull(1)?.toIntOrNull() ?: return null
        if (h !in 0..23) return null
        if (m !in 0..59) return null
        return h * 60 + m
    }

    private fun getScheduleMap(): Map<String, DaySchedule> {
        val raw = prefs.weekdayScheduleJson
        if (raw == lastScheduleJson && scheduleCache.isNotEmpty()) return scheduleCache
        lastScheduleJson = raw

        if (raw.isBlank()) {
            val legacyStart = String.format(Locale.getDefault(), "%02d:%02d", prefs.schoolStartHour, prefs.schoolStartMinute)
            val legacyEnd = String.format(Locale.getDefault(), "%02d:%02d", prefs.schoolEndHour, prefs.schoolEndMinute)
            scheduleCache = mapOf(
                "mon" to DaySchedule(true, legacyStart, legacyEnd),
                "tue" to DaySchedule(true, legacyStart, legacyEnd),
                "wed" to DaySchedule(true, legacyStart, legacyEnd),
                "thu" to DaySchedule(true, legacyStart, legacyEnd),
                "fri" to DaySchedule(true, legacyStart, legacyEnd),
                "sat" to DaySchedule(true, legacyStart, legacyEnd),
                "sun" to DaySchedule(false, legacyStart, legacyEnd)
            )
            return scheduleCache
        }

        return try {
            val root = JSONObject(raw)
            val keys = listOf("mon", "tue", "wed", "thu", "fri", "sat", "sun")
            val map = mutableMapOf<String, DaySchedule>()
            for (k in keys) {
                val obj = root.optJSONObject(k) ?: continue
                map[k] = DaySchedule(
                    enabled = obj.optBoolean("enabled", k != "sun"),
                    start = obj.optString("start", "07:00"),
                    end = obj.optString("end", "14:00")
                )
            }
            scheduleCache = map.toMap()
            scheduleCache
        } catch (_: Exception) {
            scheduleCache = emptyMap()
            scheduleCache
        }
    }

    private fun getHolidayMap(): Map<String, String> {
        val raw = prefs.holidayListJson
        if (raw == lastHolidayJson && holidayCache.isNotEmpty()) return holidayCache
        lastHolidayJson = raw

        if (raw.isBlank()) {
            holidayCache = emptyMap()
            return holidayCache
        }

        return try {
            val root = JSONObject(raw)
            val it = root.keys()
            val map = mutableMapOf<String, String>()
            while (it.hasNext()) {
                val date = it.next()
                val note = root.optString(date, "")
                if (date.isNotBlank()) {
                    map[date] = note
                }
            }
            holidayCache = map.toMap()
            holidayCache
        } catch (_: Exception) {
            holidayCache = emptyMap()
            holidayCache
        }
    }

    fun isHolidayToday(): Boolean {
        val date = getTodayDateKey()
        if (date.isBlank()) return false
        return getHolidayMap().containsKey(date)
    }

    fun getHolidayNoteToday(): String {
        val date = getTodayDateKey()
        if (date.isBlank()) return ""
        return getHolidayMap()[date] ?: ""
    }

    fun isEffectiveSchoolDayToday(): Boolean {
        if (isHolidayToday()) return false
        val schedule = getScheduleMap()[getTodayWeekdayKey()]
        return schedule?.enabled ?: true
    }

    fun isSchoolTime(): Boolean {
        if (isHolidayToday()) return false

        val dayKey = getTodayWeekdayKey()
        val schedule = getScheduleMap()[dayKey] ?: run {
            val startMinutes = prefs.schoolStartHour * 60 + prefs.schoolStartMinute
            val endMinutes = prefs.schoolEndHour * 60 + prefs.schoolEndMinute
            return isWithinTimeRange(startMinutes, endMinutes)
        }
        if (!schedule.enabled) return false

        val calendar = Calendar.getInstance()
        val hour = calendar.get(Calendar.HOUR_OF_DAY)
        val minute = calendar.get(Calendar.MINUTE)

        val currentMinutes = hour * 60 + minute

        val startMinutes = parseMinutes(schedule.start) ?: (prefs.schoolStartHour * 60 + prefs.schoolStartMinute)
        val endMinutes = parseMinutes(schedule.end) ?: (prefs.schoolEndHour * 60 + prefs.schoolEndMinute)
        if (startMinutes == endMinutes) return true
        return if (startMinutes < endMinutes) currentMinutes in startMinutes..endMinutes else currentMinutes >= startMinutes || currentMinutes <= endMinutes
    }

    private fun isWithinTimeRange(startMinutes: Int, endMinutes: Int): Boolean {
        val calendar = Calendar.getInstance()
        val hour = calendar.get(Calendar.HOUR_OF_DAY)
        val minute = calendar.get(Calendar.MINUTE)
        val currentMinutes = hour * 60 + minute
        if (startMinutes == endMinutes) return true
        return if (startMinutes < endMinutes) currentMinutes in startMinutes..endMinutes else currentMinutes >= startMinutes || currentMinutes <= endMinutes
    }

    fun isAfterSchoolHours(): Boolean {
        if (isHolidayToday()) return false

        val calendar = Calendar.getInstance()
        val hour = calendar.get(Calendar.HOUR_OF_DAY)
        val minute = calendar.get(Calendar.MINUTE)

        val currentMinutes = hour * 60 + minute
        val dayKey = getTodayWeekdayKey()
        val schedule = getScheduleMap()[dayKey]
        if (schedule != null && !schedule.enabled) return false

        val endMinutes = schedule?.end?.let { parseMinutes(it) } ?: (prefs.schoolEndHour * 60 + prefs.schoolEndMinute)
        val startMinutes = schedule?.start?.let { parseMinutes(it) } ?: (prefs.schoolStartHour * 60 + prefs.schoolStartMinute)
        if (startMinutes == endMinutes) return false
        return if (startMinutes < endMinutes) {
            currentMinutes > endMinutes
        } else {
            currentMinutes > endMinutes && currentMinutes < startMinutes
        }
    }

    fun getSchoolEndTimeString(): String {
        val dayKey = getTodayWeekdayKey()
        val schedule = getScheduleMap()[dayKey]
        val time = schedule?.end
        if (!time.isNullOrBlank()) return time
        return String.format(Locale.getDefault(), "%02d:%02d", prefs.schoolEndHour, prefs.schoolEndMinute)
    }

    fun getSchoolStartTimeString(): String {
        val dayKey = getTodayWeekdayKey()
        val schedule = getScheduleMap()[dayKey]
        val time = schedule?.start
        if (!time.isNullOrBlank()) return time
        return String.format(Locale.getDefault(), "%02d:%02d", prefs.schoolStartHour, prefs.schoolStartMinute)
    }
}
