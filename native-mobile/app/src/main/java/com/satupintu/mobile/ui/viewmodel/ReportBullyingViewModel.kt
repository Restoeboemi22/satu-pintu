package com.satupintu.mobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.satupintu.mobile.data.model.BullyingReport
import com.satupintu.mobile.data.repository.BullyingRepository
import com.satupintu.mobile.data.repository.StudentRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class ReportBullyingViewModel : ViewModel() {
    private val bullyingRepository = BullyingRepository()
    private val studentRepository = StudentRepository()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isSuccess = MutableStateFlow(false)
    val isSuccess: StateFlow<Boolean> = _isSuccess.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    fun submitReport(
        userCredential: String,
        studentId: String,
        schoolId: String,
        isAnonymous: Boolean,
        category: String,
        incidentType: String,
        description: String,
        victimName: String,
        perpetratorName: String,
        incidentLocation: String,
        incidentDate: Long
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            try {
                var reporterId: String? = null
                var reporterName: String? = null
                var reporterSchoolId = ""
                var victimId: String? = null
                var perpetratorId: String? = null
                val identityCandidates = linkedSetOf(
                    normalizeIdentity(userCredential),
                    normalizeIdentity(studentId)
                ).filter { it.isNotBlank() }.toSet()
                val normalizedSchoolId = schoolId.trim().lowercase()
                
                // Find student by session identity to get stable ID and name regardless of anonymity
                try {
                    val students = studentRepository.getStudents(normalizedSchoolId).first()
                    val student = students.find {
                        identityCandidates.contains(normalizeIdentity(it.id)) ||
                            identityCandidates.contains(normalizeIdentity(it.nisn))
                    }
                    if (student != null) {
                        reporterId = student.id
                        reporterName = student.name
                        reporterSchoolId = student.schoolId
                        val scopedStudents = students.filter {
                            reporterSchoolId.isBlank() || it.schoolId.trim().equals(reporterSchoolId.trim(), ignoreCase = true)
                        }
                        victimId = scopedStudents.find {
                            normalizeName(it.name) == normalizeName(victimName)
                        }?.let { normalizeIdentity(it.id).ifBlank { normalizeIdentity(it.nisn) } }
                        perpetratorId = scopedStudents.find {
                            normalizeName(it.name) == normalizeName(perpetratorName)
                        }?.let { normalizeIdentity(it.id).ifBlank { normalizeIdentity(it.nisn) } }
                    } else {
                        // Fallback if not found
                        reporterName = userCredential
                    }
                } catch (e: Exception) {
                    // Fallback on error
                    reporterName = userCredential
                }
                
                // Note: We always save the real name now. 
                // The 'isAnonymous' flag will control VISIBILITY, not DATA content.
                // The UI (Teacher App & Web) will format it as "Name (Anonim)"

                val report = BullyingReport(
                    reporterId = reporterId ?: identityCandidates.firstOrNull().orEmpty(),
                    reporterName = reporterName,
                    schoolId = reporterSchoolId.trim().ifBlank { normalizedSchoolId },
                    isAnonymous = isAnonymous,
                    victimId = victimId,
                    category = category,
                    incidentType = incidentType,
                    description = description,
                    victimName = victimName,
                    perpetratorId = perpetratorId,
                    perpetratorName = perpetratorName,
                    incidentLocation = incidentLocation,
                    incidentDate = incidentDate,
                    status = "PENDING",
                    priority = "MEDIUM"
                )

                bullyingRepository.createReport(report) { success ->
                    _isLoading.value = false
                    if (success) {
                        _isSuccess.value = true
                    } else {
                        _error.value = "Gagal mengirim laporan"
                    }
                }
            } catch (e: Exception) {
                _isLoading.value = false
                _error.value = e.message ?: "Terjadi kesalahan"
            }
        }
    }
    
    fun resetState() {
        _isSuccess.value = false
        _error.value = null
    }

    private fun normalizeIdentity(value: String?): String {
        return value?.trim().orEmpty()
    }

    private fun normalizeName(value: String?): String {
        return value
            ?.trim()
            ?.lowercase()
            ?.replace("[^a-z0-9]".toRegex(), "")
            .orEmpty()
    }
}

