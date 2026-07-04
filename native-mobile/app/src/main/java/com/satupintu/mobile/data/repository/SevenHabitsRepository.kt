package com.satupintu.mobile.data.repository

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.satupintu.mobile.data.model.HabitLog
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import java.text.SimpleDateFormat
import java.util.*

class SevenHabitsRepository {
    private val db = FirebaseDatabase.getInstance().reference

    fun getStudentLogs(studentId: String): Flow<Map<String, HabitLog>> = callbackFlow {
        val ref = db.child("seven_habits_logs").child(studentId)

        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val logs = mutableMapOf<String, HabitLog>()
                for (child in snapshot.children) {
                    val log = child.getValue(HabitLog::class.java)
                    if (log != null && log.date.isNotEmpty()) {
                        logs[log.date] = log
                    }
                }
                trySend(logs)
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }

        ref.addValueEventListener(listener)
        awaitClose { ref.removeEventListener(listener) }
    }

    fun saveLog(log: HabitLog, onComplete: (Boolean) -> Unit) {
        val ref = db.child("seven_habits_logs").child(log.studentId).child(log.date)
        ref.setValue(log).addOnCompleteListener { task ->
            onComplete(task.isSuccessful)
        }
    }
}

