package com.satupintu.mobile.data.repository

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.satupintu.mobile.data.model.PetAchievement
import com.satupintu.mobile.data.model.PetQuest
import com.satupintu.mobile.data.model.VirtualPet
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import java.util.UUID

class VirtualPetRepository {
    private val db = FirebaseDatabase.getInstance().reference
    private fun normalizeScope(value: String?): String = value?.trim()?.lowercase().orEmpty()
    private fun rankPetCandidate(pet: VirtualPet): Long {
        return maxOf(
            pet.updatedAt,
            pet.lastQuestReset,
            pet.lastPlayed,
            pet.lastFed
        )
    }

    private fun parsePet(snapshot: DataSnapshot): VirtualPet? {
        return try {
            snapshot.getValue(VirtualPet::class.java)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun getVirtualPetByStudentId(studentId: String, schoolId: String = ""): Flow<VirtualPet?> = callbackFlow {
        val normalizedSchoolId = normalizeScope(schoolId)
        val normalizedStudentId = studentId.trim()
        val ref = db.child("virtual_pets")
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val exactMatches = mutableListOf<VirtualPet>()
                val legacyMatches = mutableListOf<VirtualPet>()
                for (child in snapshot.children) {
                    val parsedPet = parsePet(child)
                    if (parsedPet == null || parsedPet.studentId.trim() != normalizedStudentId) {
                        continue
                    }

                    val petSchoolId = normalizeScope(parsedPet.schoolId)
                    when {
                        normalizedSchoolId.isBlank() || petSchoolId == normalizedSchoolId -> exactMatches.add(parsedPet)
                        petSchoolId.isBlank() -> legacyMatches.add(parsedPet)
                    }
                }

                val chosenPet = (exactMatches.maxByOrNull(::rankPetCandidate)
                    ?: legacyMatches.maxByOrNull(::rankPetCandidate))
                trySend(chosenPet)
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }
        ref.addValueEventListener(listener)
        awaitClose { ref.removeEventListener(listener) }
    }

    fun getAllPets(schoolId: String = ""): Flow<List<VirtualPet>> = callbackFlow {
        val normalizedSchoolId = normalizeScope(schoolId)
        val ref = db.child("virtual_pets")
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val pets = mutableListOf<VirtualPet>()
                for (child in snapshot.children) {
                    val pet = parsePet(child)
                    if (pet != null && (normalizedSchoolId.isBlank() || normalizeScope(pet.schoolId) == normalizedSchoolId)) {
                        pets.add(pet)
                    }
                }
                trySend(pets)
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }
        ref.addValueEventListener(listener)
        awaitClose { ref.removeEventListener(listener) }
    }

    fun insertVirtualPet(pet: VirtualPet): String {
        val normalizedSchoolId = normalizeScope(pet.schoolId)
        val petId = if (pet.id.isEmpty()) UUID.randomUUID().toString() else pet.id
        val newPet = pet.copy(id = petId, schoolId = normalizedSchoolId)
        db.child("virtual_pets").child(petId).setValue(newPet)
        return petId
    }

    fun updateVirtualPet(pet: VirtualPet) {
        db.child("virtual_pets").child(pet.id).setValue(pet.copy(schoolId = normalizeScope(pet.schoolId)))
    }

    fun getPetQuests(petId: String): Flow<List<PetQuest>> = callbackFlow {
        val normalizedPetId = petId.trim()
        val ref = db.child("pet_quests")
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val quests = mutableListOf<PetQuest>()
                for (child in snapshot.children) {
                    val quest = child.getValue(PetQuest::class.java)
                    if (quest != null && quest.petId.trim() == normalizedPetId) {
                        quests.add(quest)
                    }
                }
                trySend(quests)
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }
        ref.addValueEventListener(listener)
        awaitClose { ref.removeEventListener(listener) }
    }

    fun insertPetQuest(quest: PetQuest) {
        val questId = if (quest.id.isEmpty()) UUID.randomUUID().toString() else quest.id
        val newQuest = quest.copy(id = questId)
        db.child("pet_quests").child(questId).setValue(newQuest)
    }

    fun updatePetQuest(quest: PetQuest) {
        db.child("pet_quests").child(quest.id).setValue(quest)
    }
    
    fun deletePetQuest(questId: String) {
        db.child("pet_quests").child(questId).removeValue()
    }

    // Realtime Monitoring Methods
    fun getRealtimeReadingDuration(studentId: String): Flow<Long> = callbackFlow {
        val todayStr = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).format(java.util.Date())
        val ref = db.child("student_activities").child(studentId).child("reading_log").child(todayStr)

        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                var total = 0L
                for (child in snapshot.children) {
                    val duration = child.child("duration").getValue(Long::class.java) ?: 0L
                    total += duration
                }
                trySend(total)
            }
            override fun onCancelled(error: DatabaseError) { close(error.toException()) }
        }
        ref.addValueEventListener(listener)
        awaitClose { ref.removeEventListener(listener) }
    }

    fun getRealtimeHabits(studentId: String): Flow<Int> = callbackFlow {
        val todayStr = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).format(java.util.Date())
        val ref = db.child("seven_habits_logs").child(studentId).child(todayStr).child("habits")

        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                var count = 0
                for (child in snapshot.children) {
                    if (child.getValue(Boolean::class.java) == true) count++
                }
                trySend(count)
            }
            override fun onCancelled(error: DatabaseError) { close(error.toException()) }
        }
        ref.addValueEventListener(listener)
        awaitClose { ref.removeEventListener(listener) }
    }

    fun getRealtimeAttendance(studentId: String): Flow<Map<String, Any?>> = callbackFlow {
        val calendar = java.util.Calendar.getInstance()
        calendar.set(java.util.Calendar.HOUR_OF_DAY, 0)
        calendar.set(java.util.Calendar.MINUTE, 0)
        calendar.set(java.util.Calendar.SECOND, 0)
        calendar.set(java.util.Calendar.MILLISECOND, 0)
        val startOfDay = calendar.timeInMillis

        calendar.set(java.util.Calendar.HOUR_OF_DAY, 23)
        calendar.set(java.util.Calendar.MINUTE, 59)
        calendar.set(java.util.Calendar.SECOND, 59)
        val endOfDay = calendar.timeInMillis

        val ref = db.child("attendance")
        val query = ref.orderByChild("date").startAt(startOfDay.toDouble()).endAt(endOfDay.toDouble())

        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                var latestRecord: DataSnapshot? = null
                var latestScore = Long.MIN_VALUE

                for (child in snapshot.children) {
                    val sId = child.child("studentId").getValue(String::class.java)
                    if (sId == studentId) {
                        val updatedAt = child.child("updatedAt").getValue(Long::class.java) ?: 0L
                        val date = child.child("date").getValue(Long::class.java) ?: 0L
                        val createdAt = child.child("createdAt").getValue(Long::class.java) ?: 0L
                        val score = maxOf(updatedAt, date, createdAt)
                        if (latestRecord == null || score >= latestScore) {
                            latestRecord = child
                            latestScore = score
                        }
                    }
                }

                val status = latestRecord?.child("status")?.getValue(String::class.java)
                val checkOutTime = latestRecord?.child("checkOutTime")?.value?.toString().orEmpty()

                // Return both status and checkOutTime
                val result = mapOf(
                    "status" to status,
                    "checkOutTime" to checkOutTime
                )
                trySend(result)
            }
            override fun onCancelled(error: DatabaseError) { close(error.toException()) }
        }
        query.addValueEventListener(listener)
        awaitClose { query.removeEventListener(listener) }
    }

    fun getRealtimeLiteracyCount(studentId: String, studentName: String, schoolId: String = ""): Flow<Int> = callbackFlow {
        val normalizedSchoolId = normalizeScope(schoolId)
        val ref = db.child("literacy_logs")

        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val sevenDaysAgo = System.currentTimeMillis() - (7L * 24 * 60 * 60 * 1000)
                var count = 0
                for (child in snapshot.children) {
                    val timestamp = child.child("timestamp").getValue(Long::class.java) ?: 0L
                    val logStudentId = child.child("studentId").getValue(String::class.java).orEmpty().trim()
                    val logStudentName = child.child("studentName").getValue(String::class.java).orEmpty().trim()
                    val logSchoolId = normalizeScope(child.child("schoolId").getValue(String::class.java))
                    val matchesStudent = when {
                        logStudentId.isNotEmpty() -> logStudentId == studentId
                        studentName.isNotBlank() -> logStudentName.equals(studentName, ignoreCase = true)
                        else -> false
                    }

                    if ((normalizedSchoolId.isBlank() || logSchoolId == normalizedSchoolId) && matchesStudent && timestamp >= sevenDaysAgo) {
                        count++
                    }
                }
                trySend(count)
            }
            override fun onCancelled(error: DatabaseError) { close(error.toException()) }
        }
        ref.addValueEventListener(listener)
        awaitClose { ref.removeEventListener(listener) }
    }

    fun deletePetQuests(petId: String) {
        val normalizedPetId = petId.trim()
        val ref = db.child("pet_quests")
        ref.addListenerForSingleValueEvent(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                for (child in snapshot.children) {
                    val questPetId = child.child("petId").getValue(String::class.java).orEmpty().trim()
                    if (questPetId == normalizedPetId) {
                        child.ref.removeValue()
                    }
                }
            }
            override fun onCancelled(error: DatabaseError) {}
        })
    }

    fun getPetAchievements(petId: String): Flow<List<PetAchievement>> = callbackFlow {
        val normalizedPetId = petId.trim()
        val ref = db.child("pet_achievements")
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val achievements = mutableListOf<PetAchievement>()
                for (child in snapshot.children) {
                    val achievement = child.getValue(PetAchievement::class.java)
                    if (achievement != null && achievement.petId.trim() == normalizedPetId) {
                        achievements.add(achievement)
                    }
                }
                trySend(achievements)
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }
        ref.addValueEventListener(listener)
        awaitClose { ref.removeEventListener(listener) }
    }

    fun insertPetAchievement(achievement: PetAchievement) {
        val id = if (achievement.id.isEmpty()) java.util.UUID.randomUUID().toString() else achievement.id
        val newAchievement = achievement.copy(id = id)
        db.child("pet_achievements").child(id).setValue(newAchievement)
    }
}

