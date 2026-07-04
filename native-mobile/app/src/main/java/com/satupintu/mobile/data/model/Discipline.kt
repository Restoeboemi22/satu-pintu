package com.satupintu.mobile.data.model

data class DisciplineRule(
    val id: Int = 0,
    val ruleName: String = "",
    val category: String = "VIOLATION", // VIOLATION or ACHIEVEMENT
    val points: Int = 0,
    val severity: String = "LOW",
    val description: String? = null,
    val isActive: Boolean = true
)

data class DisciplineRecord(
    val id: String = "",
    val schoolId: String = "",
    val studentId: String = "",
    val studentNameSnapshot: String = "",
    val classNameSnapshot: String = "",
    val ruleId: Int = 0,
    val ruleNameSnapshot: String = "",
    val date: Long = 0,
    val points: Int = 0,
    val description: String? = null,
    val evidence: String? = null,
    val recordedBy: String? = null,
    val reportedByUserId: String = "",
    val reportedByName: String = "",
    val reportedByRole: String = "",
    val sourceApp: String = "",
    val followUpStatus: String = "OPEN",
    val followUpNote: String? = null,
    val status: String = "APPROVED",
    val createdAt: Long = 0,
    val updatedAt: Long = 0
)

