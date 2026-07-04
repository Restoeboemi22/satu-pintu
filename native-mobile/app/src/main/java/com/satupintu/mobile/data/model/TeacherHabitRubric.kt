package com.satupintu.mobile.data.model

data class TeacherHabitRubric(
    val honesty: Int = 0,
    val behavior: Int = 0,
    val initiative: Int = 0,
    val commitment: Int = 0,
    val ratedAt: Long = 0L,
    val total: Int = honesty + behavior + initiative + commitment
)

