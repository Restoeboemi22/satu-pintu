package com.satupintu.mobile.data.repository

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.Query
import com.google.firebase.database.ValueEventListener
import com.satupintu.mobile.data.model.Teacher
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

class TeacherRepository {
    private val db = FirebaseDatabase.getInstance().reference

    private fun parseTeacherSnapshot(snapshot: DataSnapshot): Teacher? {
        return try {
            val id = snapshot.key ?: ""
            val name = snapshot.child("name").getValue(String::class.java)
                ?: snapshot.child("nama").getValue(String::class.java)
                ?: ""
            val nuptkVal = snapshot.child("nuptk").getValue(String::class.java) ?: id
            val homeroomClass = snapshot.child("homeroomClass").getValue(String::class.java)
                ?: snapshot.child("class").getValue(String::class.java)
                ?: snapshot.child("kelas").getValue(String::class.java)
                ?: snapshot.child("wali_kelas").getValue(String::class.java)
                ?: ""
            val schoolId = snapshot.child("schoolId").getValue(String::class.java) ?: ""
            val email = snapshot.child("email").getValue(String::class.java) ?: ""
            val phone = snapshot.child("phone").getValue(String::class.java)
                ?: snapshot.child("no_hp").getValue(String::class.java)
                ?: ""

            Teacher(
                id = id,
                nuptk = nuptkVal,
                name = name,
                homeroomClass = homeroomClass,
                schoolId = schoolId,
                email = email,
                phone = phone
            )
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun getTeacherByNuptk(nuptk: String): Flow<Teacher?> = callbackFlow {
        val directRef = db.child("master_teachers").child(nuptk)
        var legacyQuery: Query? = null
        var legacyListener: ValueEventListener? = null

        val directListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                if (snapshot.exists()) {
                    trySend(parseTeacherSnapshot(snapshot))
                } else {
                    if (legacyQuery == null || legacyListener == null) {
                        val ref = db.child("teachers")
                        val query = ref.orderByChild("nuptk").equalTo(nuptk)
                        legacyQuery = query

                        val listener = object : ValueEventListener {
                            override fun onDataChange(legacySnapshot: DataSnapshot) {
                                if (legacySnapshot.exists()) {
                                    val child = legacySnapshot.children.first()
                                    trySend(parseTeacherSnapshot(child))
                                } else {
                                    trySend(null)
                                }
                            }

                            override fun onCancelled(error: DatabaseError) {
                                close(error.toException())
                            }
                        }
                        legacyListener = listener
                        query.addValueEventListener(listener)
                    }
                }
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }

        directRef.addValueEventListener(directListener)
        awaitClose {
            directRef.removeEventListener(directListener)
            val q = legacyQuery
            val l = legacyListener
            if (q != null && l != null) q.removeEventListener(l)
        }
    }
}

