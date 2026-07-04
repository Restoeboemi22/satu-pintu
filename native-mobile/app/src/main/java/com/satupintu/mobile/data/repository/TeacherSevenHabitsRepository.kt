package com.satupintu.mobile.data.repository

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.satupintu.mobile.data.model.HabitLog
import com.satupintu.mobile.data.model.TeacherHabitRubric
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

class TeacherSevenHabitsRepository {
    private val db = FirebaseDatabase.getInstance().reference
    private fun normalizeScope(value: String?): String = value?.trim()?.lowercase().orEmpty()

    fun getAllLogs(schoolId: String = ""): Flow<List<HabitLog>> = callbackFlow {
        val normalizedSchoolId = normalizeScope(schoolId)
        val ref = db.child("seven_habits_logs")
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val logs = mutableListOf<HabitLog>()
                snapshot.children.forEach { studentSnapshot ->
                    val fallbackStudentId = studentSnapshot.key.orEmpty()
                    studentSnapshot.children.forEach { logSnapshot ->
                        val parsed = parseHabitLog(logSnapshot, fallbackStudentId)
                        if (parsed != null && (normalizedSchoolId.isBlank() || normalizeScope(parsed.schoolId) == normalizedSchoolId)) {
                            logs.add(parsed)
                        }
                    }
                }
                trySend(logs.sortedByDescending { it.date })
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }

        ref.addValueEventListener(listener)
        awaitClose { ref.removeEventListener(listener) }
    }

    fun getTeacherRatings(schoolId: String): Flow<Map<String, TeacherHabitRubric>> = callbackFlow {
        val normalizedSchoolId = schoolId.trim()
        if (normalizedSchoolId.isBlank()) {
            trySend(emptyMap())
            close()
            return@callbackFlow
        }

        val ref = db.child("seven_habits_teacher_ratings").child(normalizedSchoolId)
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val ratings = snapshot.children.associate { ratingSnapshot ->
                    val key = ratingSnapshot.key.orEmpty()
                    val honesty = ratingSnapshot.child("honesty").getValue(Int::class.java)
                        ?: ratingSnapshot.child("honesty").getValue(Long::class.java)?.toInt()
                        ?: 0
                    val behavior = ratingSnapshot.child("behavior").getValue(Int::class.java)
                        ?: ratingSnapshot.child("behavior").getValue(Long::class.java)?.toInt()
                        ?: 0
                    val initiative = ratingSnapshot.child("initiative").getValue(Int::class.java)
                        ?: ratingSnapshot.child("initiative").getValue(Long::class.java)?.toInt()
                        ?: 0
                    val commitment = ratingSnapshot.child("commitment").getValue(Int::class.java)
                        ?: ratingSnapshot.child("commitment").getValue(Long::class.java)?.toInt()
                        ?: 0
                    val ratedAt = ratingSnapshot.child("ratedAt").getValue(Long::class.java) ?: 1L

                    key to TeacherHabitRubric(
                        honesty = honesty,
                        behavior = behavior,
                        initiative = initiative,
                        commitment = commitment,
                        ratedAt = ratedAt
                    )
                }
                trySend(ratings)
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }

        ref.addValueEventListener(listener)
        awaitClose { ref.removeEventListener(listener) }
    }

    fun saveTeacherRating(
        schoolId: String,
        studentId: String,
        month: Int,
        year: Int,
        rubric: TeacherHabitRubric,
        onComplete: (Boolean, String?) -> Unit
    ) {
        val normalizedSchoolId = schoolId.trim()
        val normalizedStudentId = studentId.trim()
        if (normalizedSchoolId.isBlank() || normalizedStudentId.isBlank()) {
            onComplete(false, "Konteks sekolah atau siswa belum tersedia.")
            return
        }

        val ratingKey = "${normalizedStudentId}_${month}_${year}"
        val rubricToSave = rubric.copy(ratedAt = System.currentTimeMillis())
        db.child("seven_habits_teacher_ratings")
            .child(normalizedSchoolId)
            .child(ratingKey)
            .setValue(rubricToSave)
            .addOnCompleteListener { task ->
                onComplete(task.isSuccessful, task.exception?.message)
            }
    }

    private fun parseHabitLog(snapshot: DataSnapshot, fallbackStudentId: String): HabitLog? {
        val date = snapshot.child("date").getValue(String::class.java)
            ?: snapshot.key
            ?: return null
        val studentId = snapshot.child("studentId").getValue(String::class.java)
            ?: fallbackStudentId
        if (studentId.isBlank()) return null

        val habitsNode = snapshot.child("habits")
        val habits = linkedMapOf(
            "habit1" to readHabitValue(habitsNode, snapshot, "habit1"),
            "habit2" to readHabitValue(habitsNode, snapshot, "habit2"),
            "habit3" to readHabitValue(habitsNode, snapshot, "habit3"),
            "habit4" to readHabitValue(habitsNode, snapshot, "habit4"),
            "habit5" to readHabitValue(habitsNode, snapshot, "habit5"),
            "habit6" to readHabitValue(habitsNode, snapshot, "habit6"),
            "habit7" to readHabitValue(habitsNode, snapshot, "habit7")
        )

        return HabitLog(
            id = snapshot.child("id").getValue(String::class.java) ?: "${studentId}_$date",
            studentId = studentId,
            schoolId = snapshot.child("schoolId").getValue(String::class.java).orEmpty(),
            date = date,
            habits = habits,
            timestamp = snapshot.child("timestamp").getValue(Long::class.java) ?: 0L
        )
    }

    private fun readHabitValue(
        habitsNode: DataSnapshot,
        rootNode: DataSnapshot,
        key: String
    ): Boolean {
        return habitsNode.child(key).getValue(Boolean::class.java)
            ?: rootNode.child(key).getValue(Boolean::class.java)
            ?: false
    }
}

