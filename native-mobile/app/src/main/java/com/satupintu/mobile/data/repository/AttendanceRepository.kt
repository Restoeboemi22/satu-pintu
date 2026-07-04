package com.satupintu.mobile.data.repository

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.satupintu.mobile.data.model.Attendance
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import java.text.SimpleDateFormat
import java.util.*

class AttendanceRepository {
    private val db = FirebaseDatabase.getInstance().reference

    private fun normalizeScope(value: String?): String {
        return value?.trim()?.lowercase().orEmpty()
    }

    private fun parseAttendance(snapshot: DataSnapshot): Attendance? {
        return try {
            val id = snapshot.key ?: return null
            Attendance(
                id = id,
                studentId = snapshot.child("studentId").getValue(String::class.java) ?: "",
                schoolId = snapshot.child("schoolId").getValue(String::class.java) ?: "",
                date = snapshot.child("date").getValue(Long::class.java) ?: 0L,
                status = snapshot.child("status").getValue(String::class.java) ?: "ABSENT",
                checkInTime = snapshot.child("checkInTime").getValue(String::class.java) ?: "",
                checkOutTime = snapshot.child("checkOutTime").getValue(String::class.java),
                checkInMethod = snapshot.child("checkInMethod").getValue(String::class.java) ?: "MANUAL",
                notes = snapshot.child("notes").getValue(String::class.java),
                proofDocument = snapshot.child("proofDocument").getValue(String::class.java),
                recordedBy = snapshot.child("recordedBy").getValue(String::class.java),
                latitude = snapshot.child("latitude").getValue(Double::class.java),
                longitude = snapshot.child("longitude").getValue(Double::class.java),
                locationAccuracyMeters = snapshot.child("locationAccuracyMeters").getValue(Float::class.java),
                locationProvider = snapshot.child("locationProvider").getValue(String::class.java),
                isMockLocation = snapshot.child("isMockLocation").getValue(Boolean::class.java) ?: false,
                deviceTimeTrusted = snapshot.child("deviceTimeTrusted").getValue(Boolean::class.java) ?: true
            )
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun getAttendanceByDate(dateMillis: Long, schoolId: String = ""): Flow<List<Attendance>> = callbackFlow {
        // Format date to YYYY-MM-DD for simpler querying if node structure supports it
        // Or query by timestamp range.
        // Let's assume a structure: attendance -> YYYY-MM-DD -> studentId -> AttendanceRecord
        // OR attendance -> autoId (with timestamp field).
        
        // Let's use a flat structure with query for simplicity and flexibility
        // attendance -> list of records
        
        val ref = db.child("attendance")
        
        // Create start and end of day timestamps
        val calendar = Calendar.getInstance()
        calendar.timeInMillis = dateMillis
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        val startOfDay = calendar.timeInMillis
        
        calendar.set(Calendar.HOUR_OF_DAY, 23)
        calendar.set(Calendar.MINUTE, 59)
        calendar.set(Calendar.SECOND, 59)
        val endOfDay = calendar.timeInMillis

        // Query by date field
        val query = ref.orderByChild("date").startAt(startOfDay.toDouble()).endAt(endOfDay.toDouble())

        // OPTIMIZATION FOR 300+ USERS: Use addListenerForSingleValueEvent
        val normalizedSchoolId = normalizeScope(schoolId)
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val records = snapshot.children.mapNotNull(::parseAttendance).filter { attendance ->
                    normalizedSchoolId.isBlank() || normalizeScope(attendance.schoolId) == normalizedSchoolId
                }
                trySend(records)
                close() // Close Flow after single emission
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }

        // Use single fetch
        query.addListenerForSingleValueEvent(listener)
        awaitClose { } // No listener to remove
    }

    fun getAttendanceByMonth(month: Int, year: Int, schoolId: String = ""): Flow<List<Attendance>> = callbackFlow {
        val ref = db.child("attendance")

        val calendar = Calendar.getInstance()
        calendar.set(Calendar.YEAR, year)
        calendar.set(Calendar.MONTH, month)
        calendar.set(Calendar.DAY_OF_MONTH, 1)
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        val startOfMonth = calendar.timeInMillis

        // Set to last day of month
        calendar.add(Calendar.MONTH, 1)
        calendar.add(Calendar.MILLISECOND, -1)
        val endOfMonth = calendar.timeInMillis

        val query = ref.orderByChild("date").startAt(startOfMonth.toDouble()).endAt(endOfMonth.toDouble())

        val normalizedSchoolId = normalizeScope(schoolId)
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val records = snapshot.children.mapNotNull(::parseAttendance).filter { attendance ->
                    normalizedSchoolId.isBlank() || normalizeScope(attendance.schoolId) == normalizedSchoolId
                }
                trySend(records)
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }

        query.addValueEventListener(listener)
        awaitClose { query.removeEventListener(listener) }
    }

    fun saveAttendance(attendance: Attendance, onComplete: (Boolean) -> Unit) {
        val normalizedSchoolId = normalizeScope(attendance.schoolId)
        if (normalizedSchoolId.isBlank()) {
            onComplete(false)
            return
        }
        val ref = if (attendance.id.isNotEmpty()) {
            db.child("attendance").child(attendance.id)
        } else {
            db.child("attendance").push()
        }
        
        val attendanceWithId = if (attendance.id.isEmpty()) {
            attendance.copy(id = ref.key ?: "", schoolId = normalizedSchoolId)
        } else {
            attendance.copy(schoolId = normalizedSchoolId)
        }

        ref.setValue(attendanceWithId).addOnCompleteListener { task ->
            onComplete(task.isSuccessful)
        }
    }

    fun deleteAttendance(attendanceId: String, schoolId: String = "", onComplete: (Boolean) -> Unit) {
        val ref = db.child("attendance").child(attendanceId)
        val normalizedSchoolId = normalizeScope(schoolId)
        if (normalizedSchoolId.isBlank()) {
            onComplete(false)
            return
        }
        ref.addListenerForSingleValueEvent(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                if (!snapshot.exists()) {
                    onComplete(false)
                    return
                }
                val recordSchoolId = normalizeScope(snapshot.child("schoolId").getValue(String::class.java))
                if (recordSchoolId != normalizedSchoolId) {
                    onComplete(false)
                    return
                }
                ref.removeValue().addOnCompleteListener { task ->
                    onComplete(task.isSuccessful)
                }
            }

            override fun onCancelled(error: DatabaseError) {
                onComplete(false)
            }
        })
    }
}

