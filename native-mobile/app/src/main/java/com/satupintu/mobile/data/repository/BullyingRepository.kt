package com.satupintu.mobile.data.repository

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.satupintu.mobile.data.model.BullyingReport
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

class BullyingRepository {
    private val db = FirebaseDatabase.getInstance().reference
    private fun normalizeScope(value: String?): String = value?.trim()?.lowercase().orEmpty()

    private fun parseReport(snapshot: DataSnapshot): BullyingReport? {
        return try {
            snapshot.getValue(BullyingReport::class.java)?.copy(id = snapshot.key ?: "")
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun getAllReports(schoolId: String = ""): Flow<List<BullyingReport>> = callbackFlow {
        val normalizedSchoolId = normalizeScope(schoolId)
        val ref = if (normalizedSchoolId.isBlank()) {
            db.child("bullying_reports")
        } else {
            db.child("bullying_reports").orderByChild("schoolId").equalTo(normalizedSchoolId)
        }
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val reports = snapshot.children.mapNotNull { child ->
                    parseReport(child)
                }.filter { normalizedSchoolId.isBlank() || normalizeScope(it.schoolId) == normalizedSchoolId }
                trySend(reports)
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }
        ref.addValueEventListener(listener)
        awaitClose { ref.removeEventListener(listener) }
    }

    fun updateReportStatus(reportId: String, status: String, onComplete: (Boolean) -> Unit) {
        val updates = hashMapOf<String, Any>(
            "status" to status,
            "updatedAt" to System.currentTimeMillis()
        )
        
        if (status == "RESOLVED" || status == "CLOSED") {
            updates["resolvedAt"] = System.currentTimeMillis()
        }

        db.child("bullying_reports").child(reportId).updateChildren(updates)
            .addOnSuccessListener { onComplete(true) }
            .addOnFailureListener { onComplete(false) }
    }

    fun createReport(report: BullyingReport, onComplete: (Boolean) -> Unit) {
        val normalizedSchoolId = normalizeScope(report.schoolId)
        if (normalizedSchoolId.isBlank()) {
            onComplete(false)
            return
        }
        val key = db.child("bullying_reports").push().key
        if (key == null) {
            onComplete(false)
            return
        }
        
        val newReport = report.copy(
            id = key, 
            schoolId = normalizedSchoolId,
            createdAt = System.currentTimeMillis(), 
            updatedAt = System.currentTimeMillis()
        )
        
        db.child("bullying_reports").child(key).setValue(newReport)
            .addOnSuccessListener { onComplete(true) }
            .addOnFailureListener { onComplete(false) }
    }

    fun getStudentReports(studentId: String, schoolId: String = ""): Flow<List<BullyingReport>> = callbackFlow {
        val normalizedSchoolId = normalizeScope(schoolId)
        val ref = if (normalizedSchoolId.isBlank()) {
            db.child("bullying_reports")
        } else {
            db.child("bullying_reports").orderByChild("schoolId").equalTo(normalizedSchoolId)
        }
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val reports = snapshot.children.mapNotNull { child ->
                    parseReport(child)
                }.filter {
                    (normalizedSchoolId.isBlank() || normalizeScope(it.schoolId) == normalizedSchoolId) &&
                        (it.reporterId == studentId || (it.isAnonymous && it.reporterId == studentId))
                }.sortedByDescending { it.createdAt }
                
                trySend(reports)
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }
        ref.addValueEventListener(listener)
        awaitClose { ref.removeEventListener(listener) }
    }
}

