package com.satupintu.mobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.satupintu.mobile.data.model.DisciplineRecord
import com.satupintu.mobile.data.model.DisciplineRule
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class DisciplineUiState {
    object Loading : DisciplineUiState()
    data class Success(
        val violationPoints: Int,
        val achievementPoints: Int,
        val records: List<DisciplineRecordWithRule>
    ) : DisciplineUiState()
    data class Error(val message: String) : DisciplineUiState()
}

data class DisciplineRecordWithRule(
    val record: DisciplineRecord,
    val rule: DisciplineRule?
)

class DisciplineViewModel : ViewModel() {
    private val _uiState = MutableStateFlow<DisciplineUiState>(DisciplineUiState.Loading)
    val uiState: StateFlow<DisciplineUiState> = _uiState.asStateFlow()

    private val db = FirebaseDatabase.getInstance()

    fun loadData(userCredential: String, studentId: String, schoolId: String) {
        viewModelScope.launch {
            _uiState.value = DisciplineUiState.Loading

            resolveStudentSnapshot(
                userCredential = userCredential,
                studentId = studentId,
                onResolved = { studentSnapshot ->
                    if (studentSnapshot != null) {
                        val identityCandidates = linkedSetOf(
                            normalizeIdentity(studentSnapshot.key),
                            normalizeIdentity(studentSnapshot.child("id").getValue(String::class.java)),
                            normalizeIdentity(studentSnapshot.child("nisn").getValue(String::class.java)),
                            normalizeIdentity(studentId),
                            normalizeIdentity(userCredential)
                        ).filter { it.isNotBlank() }.toSet()

                        val resolvedSchoolId = schoolId.ifBlank {
                            studentSnapshot.child("schoolId").getValue(String::class.java).orEmpty()
                        }

                        fetchRulesAndRecords(identityCandidates, resolvedSchoolId)
                    } else {
                        _uiState.value = DisciplineUiState.Error("Data siswa tidak ditemukan.")
                    }
                },
                onError = { message ->
                    _uiState.value = DisciplineUiState.Error(message)
                }
            )
        }
    }

    private fun resolveStudentSnapshot(
        userCredential: String,
        studentId: String,
        onResolved: (DataSnapshot?) -> Unit,
        onError: (String) -> Unit
    ) {
        val identityCandidates = linkedSetOf(
            normalizeIdentity(userCredential),
            normalizeIdentity(studentId)
        ).filter { it.isNotBlank() }.toSet()

        fun findMatchingStudent(snapshot: DataSnapshot): DataSnapshot? {
            return snapshot.children.firstOrNull { child ->
                identityCandidates.contains(normalizeIdentity(child.key)) ||
                    identityCandidates.contains(normalizeIdentity(child.child("id").getValue(String::class.java))) ||
                    identityCandidates.contains(normalizeIdentity(child.child("nisn").getValue(String::class.java))) ||
                    identityCandidates.contains(normalizeIdentity(child.child("username").getValue(String::class.java)))
            }
        }

        db.getReference("master_students").addListenerForSingleValueEvent(object : ValueEventListener {
            override fun onDataChange(masterSnapshot: DataSnapshot) {
                val masterStudent = findMatchingStudent(masterSnapshot)
                if (masterStudent != null) {
                    onResolved(masterStudent)
                    return
                }

                db.getReference("students").addListenerForSingleValueEvent(object : ValueEventListener {
                    override fun onDataChange(snapshot: DataSnapshot) {
                        onResolved(findMatchingStudent(snapshot))
                    }

                    override fun onCancelled(error: DatabaseError) {
                        onError(error.message)
                    }
                })
            }

            override fun onCancelled(error: DatabaseError) {
                onError(error.message)
            }
        })
    }

    private fun fetchRulesAndRecords(studentIdentityCandidates: Set<String>, schoolId: String) {
        db.getReference("discipline_rules").addListenerForSingleValueEvent(object : ValueEventListener {
            override fun onDataChange(globalRulesSnapshot: DataSnapshot) {
                val globalRules = parseRules(globalRulesSnapshot)
                val normalizedSchoolId = normalizeScope(schoolId)

                if (normalizedSchoolId.isBlank()) {
                    fetchRecords(studentIdentityCandidates, globalRules)
                    return
                }

                db.getReference("discipline_rules_by_school").child(normalizedSchoolId)
                    .addListenerForSingleValueEvent(object : ValueEventListener {
                        override fun onDataChange(scopedRulesSnapshot: DataSnapshot) {
                            val scopedRules = parseRules(scopedRulesSnapshot)
                            fetchRecords(
                                studentIdentityCandidates,
                                if (scopedRules.isNotEmpty()) scopedRules else globalRules
                            )
                        }

                        override fun onCancelled(error: DatabaseError) {
                            _uiState.value = DisciplineUiState.Error("Gagal memuat aturan sekolah: ${error.message}")
                        }
                    })
            }

            override fun onCancelled(error: DatabaseError) {
                _uiState.value = DisciplineUiState.Error("Gagal memuat aturan: ${error.message}")
            }
        })
    }

    private fun fetchRecords(studentIdentityCandidates: Set<String>, rulesMap: Map<Int, DisciplineRule>) {
        val recordsRef = db.getReference("discipline_records")
        recordsRef.addListenerForSingleValueEvent(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val recordsWithRules = mutableListOf<DisciplineRecordWithRule>()
                var totalViolation = 0
                var totalAchievement = 0

                for (child in snapshot.children) {
                    val record = child.getValue(DisciplineRecord::class.java)
                    if (record != null && studentIdentityCandidates.contains(normalizeIdentity(record.studentId))) {
                        val rule = rulesMap[record.ruleId]
                        recordsWithRules.add(DisciplineRecordWithRule(record, rule))
                        
                        // Calculate points
                        if (rule != null) {
                            if (rule.category == "VIOLATION") {
                                totalViolation += record.points
                            } else {
                                totalAchievement += record.points
                            }
                        } else {
                            // Fallback if rule not found but points exist in record
                             // Assuming standard convention if needed, or just ignore
                             // totalViolation += record.points 
                        }
                    }
                }
                
                // Sort by date descending
                recordsWithRules.sortByDescending { it.record.date }

                _uiState.value = DisciplineUiState.Success(
                    violationPoints = totalViolation,
                    achievementPoints = totalAchievement,
                    records = recordsWithRules
                )
            }

            override fun onCancelled(error: DatabaseError) {
                _uiState.value = DisciplineUiState.Error("Gagal memuat catatan: ${error.message}")
            }
        })
    }

    private fun parseRules(snapshot: DataSnapshot): Map<Int, DisciplineRule> {
        val rulesMap = mutableMapOf<Int, DisciplineRule>()
        for (child in snapshot.children) {
            val rule = child.getValue(DisciplineRule::class.java)
            if (rule != null) {
                val resolvedId = if (rule.id != 0) rule.id else child.key?.toIntOrNull() ?: 0
                if (resolvedId != 0) {
                    rulesMap[resolvedId] = rule.copy(id = resolvedId)
                }
            }
        }
        return rulesMap
    }

    private fun normalizeIdentity(value: String?): String {
        return value?.trim().orEmpty()
    }

    private fun normalizeScope(value: String?): String {
        return value?.trim()?.lowercase().orEmpty()
    }
}

