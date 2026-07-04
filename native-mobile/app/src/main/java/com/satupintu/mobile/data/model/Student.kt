package com.satupintu.mobile.data.model

data class Student(
    val id: String = "",
    val name: String = "",
    val nisn: String = "",
    val schoolId: String = "",
    val className: String = "", // Maps to "kelas" in DB
    val gender: String = "", // "L" or "P"
    val parentName: String? = null,
    val parentPhone: String? = null,
    val deviceId: String? = null
)

