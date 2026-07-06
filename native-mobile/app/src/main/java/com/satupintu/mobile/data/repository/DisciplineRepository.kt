package com.satupintu.mobile.data.repository

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.satupintu.mobile.data.model.DisciplineRecord
import com.satupintu.mobile.data.model.DisciplineRule
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

class DisciplineRepository {
    private val db = FirebaseDatabase.getInstance().reference
    private val schoolRuleRoot = "discipline_rules_by_school"
    private val fallbackRules = listOf(
        DisciplineRule(id = 1, ruleName = "Terlambat Sekolah", category = "VIOLATION", points = 5, severity = "LOW", description = "Datang ke sekolah setelah bel masuk berbunyi (07.00 WIB)", isActive = true),
        DisciplineRule(id = 2, ruleName = "Atribut Tidak Lengkap", category = "VIOLATION", points = 5, severity = "LOW", description = "Tidak memakai topi, dasi, atau kaos kaki sesuai ketentuan", isActive = true),
        DisciplineRule(id = 3, ruleName = "Seragam Tidak Rapi", category = "VIOLATION", points = 5, severity = "LOW", description = "Baju tidak dimasukkan (putra) atau tidak sesuai jadwal", isActive = true),
        DisciplineRule(id = 4, ruleName = "Rambut Panjang (Putra)", category = "VIOLATION", points = 10, severity = "LOW", description = "Rambut menyentuh kerah baju atau menutupi telinga/alis", isActive = true),
        DisciplineRule(id = 5, ruleName = "Membuang Sampah Sembarangan", category = "VIOLATION", points = 5, severity = "LOW", description = "Tidak membuang sampah pada tempat yang disediakan", isActive = true),
        DisciplineRule(id = 11, ruleName = "Bolos Pelajaran", category = "VIOLATION", points = 20, severity = "MEDIUM", description = "Meninggalkan kelas saat jam pelajaran tanpa ijin", isActive = true),
        DisciplineRule(id = 12, ruleName = "Pulang Awal", category = "VIOLATION", points = 20, severity = "MEDIUM", description = "Pulang sebelum waktunya tanpa ijin resmi dari sekolah atau guru", isActive = true),
        DisciplineRule(id = 13, ruleName = "Merusak Fasilitas Sekolah", category = "VIOLATION", points = 25, severity = "MEDIUM", description = "Mencoret meja/dinding atau merusak alat sekolah", isActive = true),
        DisciplineRule(id = 14, ruleName = "Berkata Kotor/Kasar", category = "VIOLATION", points = 15, severity = "MEDIUM", description = "Mengucapkan kata-kata tidak pantas kepada teman/guru", isActive = true),
        DisciplineRule(id = 21, ruleName = "Merokok/Vape", category = "VIOLATION", points = 50, severity = "HIGH", description = "Merokok atau membawa rokok/vape di lingkungan sekolah", isActive = true),
        DisciplineRule(id = 22, ruleName = "Berkelahi", category = "VIOLATION", points = 75, severity = "HIGH", description = "Melakukan perkelahian fisik dengan teman", isActive = true),
        DisciplineRule(id = 23, ruleName = "Bullying/Perundungan", category = "VIOLATION", points = 75, severity = "HIGH", description = "Melakukan perundungan fisik atau verbal", isActive = true),
        DisciplineRule(id = 24, ruleName = "Membawa Senjata Tajam", category = "VIOLATION", points = 100, severity = "CRITICAL", description = "Membawa senjata tajam yang membahayakan", isActive = true),
        DisciplineRule(id = 51, ruleName = "Juara Lomba Sekolah", category = "ACHIEVEMENT", points = 15, severity = "LOW", description = "Juara 1/2/3 lomba tingkat sekolah (Class Meeting dll)", isActive = true),
        DisciplineRule(id = 52, ruleName = "Juara Lomba Kabupaten", category = "ACHIEVEMENT", points = 25, severity = "MEDIUM", description = "Mewakili sekolah dan juara di tingkat kabupaten", isActive = true),
        DisciplineRule(id = 53, ruleName = "Petugas Upacara", category = "ACHIEVEMENT", points = 5, severity = "LOW", description = "Menjadi petugas upacara bendera hari Senin", isActive = true),
        DisciplineRule(id = 54, ruleName = "Hafalan Al-Quran", category = "ACHIEVEMENT", points = 20, severity = "MEDIUM", description = "Menyelesaikan hafalan Juz 30 atau surat pilihan", isActive = true)
    )

    private fun normalizeScope(schoolId: String?): String {
        return schoolId?.trim()?.lowercase() ?: ""
    }

    private fun parseRules(snapshot: DataSnapshot): List<DisciplineRule> {
        return snapshot.children.mapNotNull { child ->
            try {
                child.getValue(DisciplineRule::class.java)?.let { rule ->
                    if (rule.id != 0) {
                        rule
                    } else {
                        val numericId = child.key?.toIntOrNull() ?: return@let null
                        rule.copy(id = numericId)
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }
    }

    private fun parseRecord(snapshot: DataSnapshot): DisciplineRecord? {
        return try {
            snapshot.getValue(DisciplineRecord::class.java)?.copy(id = snapshot.key ?: "")
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun getRules(schoolId: String = ""): Flow<List<DisciplineRule>> = callbackFlow {
        val globalRef = db.child("discipline_rules")
        val scopedId = normalizeScope(schoolId)
        val scopedRef = if (scopedId.isNotBlank()) db.child(schoolRuleRoot).child(scopedId) else null
        var globalRules: List<DisciplineRule> = emptyList()
        var scopedRules: List<DisciplineRule> = emptyList()

        fun emitRules() {
            val activeRules = when {
                scopedRules.isNotEmpty() -> scopedRules
                globalRules.isNotEmpty() -> globalRules
                else -> fallbackRules
            }
            trySend(activeRules)
        }

        val globalListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                globalRules = parseRules(snapshot)
                emitRules()
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }

        val scopedListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                scopedRules = parseRules(snapshot)
                emitRules()
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }

        globalRef.addValueEventListener(globalListener)
        scopedRef?.addValueEventListener(scopedListener)
        awaitClose {
            globalRef.removeEventListener(globalListener)
            if (scopedRef != null) {
                scopedRef.removeEventListener(scopedListener)
            }
        }
    }

    fun getRecordsByStudent(studentId: String, schoolId: String = ""): Flow<List<DisciplineRecord>> = callbackFlow {
        val ref = db.child("discipline_records")
        val query = ref.orderByChild("studentId").equalTo(studentId)
        val normalizedSchoolId = normalizeScope(schoolId)
        
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val records = snapshot.children.mapNotNull { child ->
                    parseRecord(child)
                }.filter { record ->
                    normalizedSchoolId.isBlank() || normalizeScope(record.schoolId) == normalizedSchoolId
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

    fun getAllRecords(schoolId: String = ""): Flow<List<DisciplineRecord>> = callbackFlow {
        val ref = db.child("discipline_records")
        val normalizedSchoolId = normalizeScope(schoolId)
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val records = snapshot.children.mapNotNull { child ->
                    parseRecord(child)
                }.filter { record ->
                    normalizedSchoolId.isBlank() || normalizeScope(record.schoolId) == normalizedSchoolId
                }
                trySend(records)
            }

            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }
        ref.addValueEventListener(listener)
        awaitClose { ref.removeEventListener(listener) }
    }

    fun saveRecord(record: DisciplineRecord, onComplete: (Boolean) -> Unit) {
        val now = System.currentTimeMillis()
        val normalizedSchoolId = normalizeScope(record.schoolId)
        if (normalizedSchoolId.isBlank()) {
            onComplete(false)
            return
        }
        val normalizedRecord = record.copy(
            schoolId = normalizedSchoolId,
            createdAt = if (record.createdAt > 0) record.createdAt else now,
            updatedAt = now,
            status = if (record.status.isBlank()) "APPROVED" else record.status
        )

        // 1. First, check for the student's Virtual Pet
        val petRef = db.child("virtual_pets").orderByChild("studentId").equalTo(normalizedRecord.studentId)
        
        petRef.addListenerForSingleValueEvent(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val updates = HashMap<String, Any>()
                
                // Generate new key for the record
                val recordKey = db.child("discipline_records").push().key ?: return
                val newRecord = normalizedRecord.copy(id = recordKey)
                updates["/discipline_records/$recordKey"] = newRecord

                // If pet exists and this is a VIOLATION, apply penalty
                for (child in snapshot.children) {
                    val petSchoolId = normalizeScope(child.child("schoolId").getValue(String::class.java))
                    if (petSchoolId != normalizedSchoolId) continue
                    val petId = child.key
                    val currentHappiness = child.child("happiness").getValue(Int::class.java) ?: 100
                    
                    // Logic: Reduce Happiness by the violation points
                    // Ensure it doesn't drop below 0
                    val penalty = normalizedRecord.points
                    val newHappiness = (currentHappiness - penalty).coerceAtLeast(0)
                    
                    if (petId != null) {
                        updates["/virtual_pets/$petId/happiness"] = newHappiness
                        updates["/virtual_pets/$petId/updatedAt"] = System.currentTimeMillis()
                    }
                }

                // Perform atomic update
                db.updateChildren(updates)
                    .addOnSuccessListener { onComplete(true) }
                    .addOnFailureListener { onComplete(false) }
            }

            override fun onCancelled(error: DatabaseError) {
                // If checking pet fails, just save the record normally as fallback
                saveRecordFallback(normalizedRecord, onComplete)
            }
        })
    }

    private fun saveRecordFallback(record: DisciplineRecord, onComplete: (Boolean) -> Unit) {
        if (normalizeScope(record.schoolId).isBlank()) {
            onComplete(false)
            return
        }
        val ref = db.child("discipline_records").push()
        val newRecord = record.copy(id = ref.key ?: "")
        ref.setValue(newRecord)
            .addOnSuccessListener { onComplete(true) }
            .addOnFailureListener { onComplete(false) }
    }
}

