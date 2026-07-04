package com.satupintu.mobile.data.model

data class User(
    val fullName: String,
    val username: String,
    val email: String,
    val role: String = "Siswa",
    val className: String = "",
    val schoolName: String = ""
)

