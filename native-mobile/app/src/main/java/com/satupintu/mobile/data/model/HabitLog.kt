package com.satupintu.mobile.data.model

data class HabitLog(
    val id: String = "",
    val studentId: String = "",
    val schoolId: String = "",
    val date: String = "", // YYYY-MM-DD
    val habits: Map<String, Boolean> = mapOf(
        "habit1" to false,
        "habit2" to false,
        "habit3" to false,
        "habit4" to false,
        "habit5" to false,
        "habit6" to false,
        "habit7" to false
    ),
    val timestamp: Long = System.currentTimeMillis()
)

