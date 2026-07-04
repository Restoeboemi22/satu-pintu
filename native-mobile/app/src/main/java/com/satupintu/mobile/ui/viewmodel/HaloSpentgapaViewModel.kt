package com.satupintu.mobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.satupintu.mobile.data.model.BullyingReport
import com.satupintu.mobile.data.repository.BullyingRepository
import com.satupintu.mobile.data.repository.StudentRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

class HaloSpentgapaViewModel : ViewModel() {
    private val repository = BullyingRepository()
    private val studentRepository = StudentRepository()
    
    private val _reports = MutableStateFlow<List<BullyingReport>>(emptyList())
    val reports: StateFlow<List<BullyingReport>> = _reports

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    fun loadReports(studentCredential: String, studentId: String, schoolId: String) {
        _isLoading.value = true
        viewModelScope.launch {
            try {
                val students = try {
                    studentRepository.getStudents(schoolId).first()
                } catch (e: Exception) {
                    emptyList()
                }

                val identityCandidates = linkedSetOf(
                    normalizeIdentity(studentCredential),
                    normalizeIdentity(studentId)
                ).filter { it.isNotBlank() }.toMutableSet()

                val student = students.firstOrNull {
                    identityCandidates.contains(normalizeIdentity(it.id)) ||
                        identityCandidates.contains(normalizeIdentity(it.nisn))
                }
                student?.let {
                    identityCandidates += normalizeIdentity(it.id)
                    identityCandidates += normalizeIdentity(it.nisn)
                }

                val resolvedSchoolId = schoolId.ifBlank { student?.schoolId.orEmpty() }

                repository.getAllReports(resolvedSchoolId).map { reports ->
                    reports.filter { report ->
                        identityCandidates.contains(normalizeIdentity(report.reporterId))
                    }.sortedByDescending { it.createdAt }
                }.collect {
                    _reports.value = it
                    _isLoading.value = false
                }
            } catch (e: Exception) {
                _isLoading.value = false
                // Handle error
            }
        }
    }

    private fun normalizeIdentity(value: String?): String {
        return value?.trim().orEmpty()
    }
}

