package com.satupintu.mobile.data.repository

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.satupintu.mobile.data.model.Student
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

class StudentRepository {
    private val db = FirebaseDatabase.getInstance().reference
    private fun normalizeScope(value: String?): String = value?.trim()?.lowercase().orEmpty()

    fun getStudents(schoolId: String = ""): Flow<List<Student>> = callbackFlow {
        val normalizedSchoolId = normalizeScope(schoolId)
        val masterRef = if (normalizedSchoolId.isBlank()) {
            db.child("master_students")
        } else {
            db.child("master_students").orderByChild("schoolId").equalTo(normalizedSchoolId)
        }
        val legacyRef = db.child("students")

        fun readStudents(snapshot: DataSnapshot): List<Student> {
            val students = mutableListOf<Student>()
            for (classSnapshot in snapshot.children) {
                // Support flat structure (students/{nisn}) and nested legacy structure.
                if (classSnapshot.hasChild("name") || classSnapshot.hasChild("nisn")) {
                    val student = parseStudent(classSnapshot)
                    if (student != null) students.add(student)
                } else {
                    for (studentSnapshot in classSnapshot.children) {
                        val student = parseStudent(studentSnapshot)
                        if (student != null) students.add(student)
                    }
                }
            }
            return students
                .filter { normalizedSchoolId.isBlank() || normalizeScope(it.schoolId) == normalizedSchoolId }
                .sortedBy { it.name }
        }

        val masterListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val masterStudents = readStudents(snapshot)
                if (masterStudents.isNotEmpty() || normalizedSchoolId.isNotBlank()) {
                    trySend(masterStudents)
                } else {
                    legacyRef.addListenerForSingleValueEvent(object : ValueEventListener {
                        override fun onDataChange(legacySnapshot: DataSnapshot) {
                            trySend(readStudents(legacySnapshot))
                        }

                        override fun onCancelled(error: DatabaseError) {
                            close(error.toException())
                        }
                    })
                }
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }

        masterRef.addValueEventListener(masterListener)
        awaitClose { masterRef.removeEventListener(masterListener) }
    }

    private fun parseStudent(snapshot: DataSnapshot): Student? {
        try {
            val id = snapshot.child("nisn").getValue(String::class.java) ?: snapshot.key ?: return null
            val name = snapshot.child("name").getValue(String::class.java) ?: snapshot.child("nama").getValue(String::class.java) ?: ""
            val nisn = snapshot.child("nisn").getValue(String::class.java) ?: ""
            val schoolId = snapshot.child("schoolId").getValue(String::class.java) ?: ""
            val className = snapshot.child("class").getValue(String::class.java) ?: snapshot.child("kelas").getValue(String::class.java) ?: ""
            val gender = snapshot.child("gender").getValue(String::class.java) ?: snapshot.child("jenis_kelamin").getValue(String::class.java) ?: ""
            val parentName = snapshot.child("parentName").getValue(String::class.java) ?: snapshot.child("nama_orang_tua").getValue(String::class.java)
            val parentPhone = snapshot.child("parentPhone").getValue(String::class.java) ?: snapshot.child("no_hp_ortu").getValue(String::class.java)
            val deviceId = snapshot.child("deviceId").getValue(String::class.java)
                ?: snapshot.child("device").getValue(String::class.java)

            return Student(
                id = id,
                name = name,
                nisn = nisn,
                schoolId = schoolId,
                className = className,
                gender = gender,
                parentName = parentName,
                parentPhone = parentPhone,
                deviceId = deviceId
            )
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        }
    }
}

