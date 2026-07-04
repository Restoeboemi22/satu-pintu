package com.satupintu.mobile.util

import com.google.firebase.database.DataSnapshot
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

data class DayScheduleRule(
    val dayId: Int,
    val startTime: String = "00:00",
    val endTime: String = "00:00",
    val isHoliday: Boolean = false
)

data class HolidayRule(
    val date: String,
    val description: String = ""
)

fun normalizeScope(value: String?): String {
    return value?.trim()?.lowercase(Locale.ROOT).orEmpty()
}

fun toDateKey(calendar: Calendar): String {
    return "%04d-%02d-%02d".format(
        calendar.get(Calendar.YEAR),
        calendar.get(Calendar.MONTH) + 1,
        calendar.get(Calendar.DAY_OF_MONTH)
    )
}

fun toDateKey(timestamp: Long): String {
    val calendar = Calendar.getInstance().apply {
        timeInMillis = timestamp
    }
    return toDateKey(calendar)
}

fun parseScheduleSnapshot(snapshot: DataSnapshot): Map<Int, DayScheduleRule> {
    if (!snapshot.exists()) return emptyMap()
    val result = linkedMapOf<Int, DayScheduleRule>()
    for (child in snapshot.children) {
        val dayId = child.key?.toIntOrNull() ?: continue
        val startTime = child.child("startTime").getValue(String::class.java) ?: "00:00"
        val endTime = child.child("endTime").getValue(String::class.java) ?: "00:00"
        val isHoliday = child.child("isHoliday").getValue(Boolean::class.java) ?: false
        result[dayId] = DayScheduleRule(
            dayId = dayId,
            startTime = startTime,
            endTime = endTime,
            isHoliday = isHoliday
        )
    }
    return result
}

fun parseHolidaySnapshot(snapshot: DataSnapshot): List<HolidayRule> {
    if (!snapshot.exists()) return emptyList()
    val result = mutableListOf<HolidayRule>()
    for (child in snapshot.children) {
        val date = child.child("date").getValue(String::class.java)?.trim().orEmpty()
        if (date.isBlank()) continue
        val description = child.child("description").getValue(String::class.java)?.trim().orEmpty()
        result += HolidayRule(date = date, description = description)
    }
    return result
}

fun findHoliday(holidays: List<HolidayRule>, dateKey: String): HolidayRule? {
    return holidays.firstOrNull { it.date == dateKey }
}

fun startOfDay(timestamp: Long): Long {
    return Calendar.getInstance().apply {
        timeInMillis = timestamp
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis
}

fun isFutureDay(calendar: Calendar, today: Calendar = Calendar.getInstance()): Boolean {
    val targetStart = Calendar.getInstance().apply {
        timeInMillis = calendar.timeInMillis
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis
    val todayStart = Calendar.getInstance().apply {
        timeInMillis = today.timeInMillis
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis
    return targetStart > todayStart
}

fun resolveScheduleRule(
    dayOfWeek: Int,
    schedules: Map<Int, DayScheduleRule>,
    defaultStartTime: String,
    defaultEndTime: String
): DayScheduleRule {
    val explicitRule = schedules[dayOfWeek]
    if (explicitRule != null) return explicitRule

    val defaultHoliday = dayOfWeek == Calendar.SUNDAY
    return DayScheduleRule(
        dayId = dayOfWeek,
        startTime = defaultStartTime,
        endTime = defaultEndTime,
        isHoliday = if (schedules.isEmpty()) defaultHoliday else true
    )
}

fun isValidSchoolDay(
    calendar: Calendar,
    schedules: Map<Int, DayScheduleRule>,
    holidays: List<HolidayRule>,
    defaultStartTime: String = "07:00",
    defaultEndTime: String = "13:30"
): Boolean {
    if (isFutureDay(calendar)) return false
    if (calendar.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY) return false
    if (findHoliday(holidays, toDateKey(calendar)) != null) return false
    val rule = resolveScheduleRule(calendar.get(Calendar.DAY_OF_WEEK), schedules, defaultStartTime, defaultEndTime)
    return !rule.isHoliday
}

fun isValidPrayerDay(
    calendar: Calendar,
    schedules: Map<Int, DayScheduleRule>,
    holidays: List<HolidayRule>,
    defaultStartTime: String = "12:00",
    defaultEndTime: String = "12:30"
): Boolean {
    if (isFutureDay(calendar)) return false
    if (calendar.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY) return false
    if (findHoliday(holidays, toDateKey(calendar)) != null) return false
    val rule = resolveScheduleRule(calendar.get(Calendar.DAY_OF_WEEK), schedules, defaultStartTime, defaultEndTime)
    return !rule.isHoliday
}

fun formatIndonesianShortDay(date: Date): String {
    return SimpleDateFormat("EEE", Locale("id", "ID")).format(date)
}

