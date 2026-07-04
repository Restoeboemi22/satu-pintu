package com.satupintu.mobile.util

import com.satupintu.mobile.data.model.HabitLog
import java.util.Calendar

data class SevenHabitsGradingResult(
    val dailyConsistency: Double,
    val weeklyProgress: Double,
    val monthlyAchievement: Double,
    val teacherRating: Int,
    val finalScore: Double,
    val predicate: String,
    val category: String,
    val description: String
)

fun calculateSevenHabitsGrades(
    logs: List<HabitLog>,
    year: Int,
    month: Int,
    teacherRatingAvailable: Boolean,
    teacherRating: Int = 0
): SevenHabitsGradingResult {
    val uniqueLogsByDate = logs
        .groupBy { it.date }
        .mapNotNull { (_, items) -> items.maxByOrNull { it.timestamp } }

    if (uniqueLogsByDate.isEmpty()) {
        return SevenHabitsGradingResult(
            dailyConsistency = 0.0,
            weeklyProgress = 0.0,
            monthlyAchievement = 0.0,
            teacherRating = if (teacherRatingAvailable) teacherRating else 0,
            finalScore = if (teacherRatingAvailable) teacherRating * 0.1 else 0.0,
            predicate = "E - Kurang",
            category = "Perlu Perbaikan",
            description = "Tidak konsisten, perlu intervensi"
        )
    }

    var totalDailyScore = 0.0
    uniqueLogsByDate.forEach { log ->
        val completedCount = log.habits.values.count { it }
        totalDailyScore += (completedCount / 7.0) * 100.0
    }
    val dailyConsistency = (totalDailyScore / uniqueLogsByDate.size).coerceAtMost(100.0)

    val weeklyTicks = mutableMapOf<Int, Int>()
    uniqueLogsByDate.forEach { log ->
        val completedCount = log.habits.values.count { it }
        val week = extractWeekOfMonth(log.date)
        weeklyTicks[week] = (weeklyTicks[week] ?: 0) + completedCount
    }

    val weeklyScores = (1..5)
        .mapNotNull { week ->
            val daysInWeek = countDaysInWeek(year, month, week)
            if (daysInWeek <= 0) return@mapNotNull null
            val ticks = weeklyTicks[week] ?: 0
            val denom = (daysInWeek * 7).coerceAtLeast(1)
            ((ticks.toDouble() / denom.toDouble()) * 100.0).coerceIn(0.0, 100.0)
        }
    val weeklyProgress = weeklyScores.averageOrZero()

    val totalMonthlyTicks = uniqueLogsByDate.sumOf { log -> log.habits.values.count { it } }
    val monthDays = countDaysInMonth(year, month).coerceAtLeast(1)
    val monthlyDenom = (monthDays * 7).coerceAtLeast(1)
    val monthlyAchievement = ((totalMonthlyTicks.toDouble() / monthlyDenom.toDouble()) * 100.0).coerceIn(0.0, 100.0)

    val baseScore = (
        (dailyConsistency * 0.40) +
            (weeklyProgress * 0.30) +
            (monthlyAchievement * 0.20)
        )
    val finalScore = if (teacherRatingAvailable) {
        (baseScore + (teacherRating * 0.10)).coerceIn(0.0, 100.0)
    } else {
        (baseScore / 0.90).coerceIn(0.0, 100.0)
    }

    val (predicate, category, description) = when {
        finalScore >= 95.0 -> Triple("A - Sangat Baik Sekali", "Sangat Baik Sekali", "Konsisten sempurna")
        finalScore >= 85.0 -> Triple("B - Sangat Baik", "Sangat Baik", "Konsisten baik, sedikit terlewat")
        finalScore >= 70.0 -> Triple("C - Baik", "Baik", "Cukup konsisten, perlu peningkatan")
        finalScore >= 50.0 -> Triple("D - Cukup", "Cukup", "Kurang konsisten, perlu perhatian")
        else -> Triple("E - Kurang", "Perlu Perbaikan", "Tidak konsisten, perlu intervensi")
    }

    return SevenHabitsGradingResult(
        dailyConsistency = dailyConsistency,
        weeklyProgress = weeklyProgress,
        monthlyAchievement = monthlyAchievement,
        teacherRating = if (teacherRatingAvailable) teacherRating else 0,
        finalScore = finalScore,
        predicate = predicate,
        category = category,
        description = description
    )
}

fun extractWeekOfMonth(date: String): Int {
    val day = date.split("-").getOrNull(2)?.toIntOrNull() ?: return 1
    return ((day - 1) / 7 + 1).coerceIn(1, 5)
}

private fun countDaysInWeek(year: Int, month: Int, week: Int): Int {
    val calendar = Calendar.getInstance().apply {
        set(Calendar.YEAR, year)
        set(Calendar.MONTH, month - 1)
    }
    val maxDays = calendar.getActualMaximum(Calendar.DAY_OF_MONTH)
    val startDay = (week - 1) * 7 + 1
    val endDay = minOf(startDay + 6, maxDays)
    return if (startDay > maxDays) 0 else (endDay - startDay + 1)
}

private fun countDaysInMonth(year: Int, month: Int): Int {
    val calendar = Calendar.getInstance().apply {
        set(Calendar.YEAR, year)
        set(Calendar.MONTH, month - 1)
    }
    return calendar.getActualMaximum(Calendar.DAY_OF_MONTH)
}

private fun List<Double>.averageOrZero(): Double = if (isEmpty()) 0.0 else average()

