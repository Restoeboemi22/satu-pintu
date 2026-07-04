package com.satupintu.mobile.data.model

data class VirtualPet(
    val id: String = "",
    val studentId: String = "",
    val schoolId: String = "",
    val petName: String = "Buddy",
    val petType: String = "CAT",
    val status: String = "HAPPY", // HAPPY, SAD, SICK, SLEEPING
    val lastFed: Long = 0L,
    val lastPlayed: Long = 0L,
    val accessories: String? = null,
    val intelligence: Int = 50,
    val energy: Int = 80,
    val social: Int = 60,
    val health: Int = 100,
    val happiness: Int = 100,
    val hunger: Int = 0,
    val level: Int = 1,
    val experiencePoints: Int = 0,
    val coins: Int = 100,
    val lastQuestReset: Long = 0L,
    val updatedAt: Long = 0L
)

data class PetQuest(
    val id: String = "",
    val petId: String = "",
    val title: String = "",
    val description: String = "",
    val target: Int = 1,
    val progress: Int = 0,
    val reward: Int = 0,
    val isCompleted: Boolean = false,
    val type: String = "DAILY" // DAILY, WEEKLY, ONE_TIME
)

data class PetAchievement(
    val id: String = "",
    val petId: String = "",
    val title: String = "",
    val description: String = "",
    val icon: String = "",
    val unlocked: Boolean = false,
    val unlockedAt: Long = 0L
)

