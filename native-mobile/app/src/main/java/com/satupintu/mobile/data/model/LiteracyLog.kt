package com.satupintu.mobile.data.model

data class LiteracyLog(
    val id: String = "",
    val studentId: String = "",
    val studentName: String = "",
    val studentClass: String = "",
    val schoolId: String = "",
    val taskId: String = "",
    val taskTitle: String = "",
    val bookTitle: String = "",
    val author: String = "",
    val summary: String = "",
    val status: String = "pending", // pending, reviewed
    val grade: String? = null,
    val feedback: String? = null,
    val timestamp: Long = System.currentTimeMillis()
)

