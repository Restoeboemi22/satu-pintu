package com.satupintu.mobile.data.model

data class LiteracyTask(
    val id: String = "",
    val title: String = "",
    val description: String = "",
    val points: Int = 0,
    val durationMinutes: Int = 0,
    val isActive: Boolean = false,
    val createdAt: Long = 0,
    val schoolId: String = ""
)

