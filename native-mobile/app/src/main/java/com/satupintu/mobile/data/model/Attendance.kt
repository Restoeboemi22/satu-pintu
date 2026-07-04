package com.satupintu.mobile.data.model

data class Attendance(
    val id: String = "",
    val studentId: String = "",
    val schoolId: String = "",
    val date: Long = 0,
    val status: String = "ABSENT",
    val checkInTime: String = "",
    val checkOutTime: String? = null,
    val checkInMethod: String = "MANUAL",
    val notes: String? = null,
    val proofDocument: String? = null,
    val recordedBy: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val locationAccuracyMeters: Float? = null,
    val locationProvider: String? = null,
    val isMockLocation: Boolean = false,
    val deviceTimeTrusted: Boolean = true
)

enum class AttendanceStatus {
    PRESENT, ABSENT, LATE, SICK, PERMIT
}

