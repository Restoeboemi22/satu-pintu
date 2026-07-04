package com.satupintu.mobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.satupintu.mobile.data.model.BullyingReport
import com.satupintu.mobile.data.model.Student
import com.satupintu.mobile.data.model.Teacher
import com.satupintu.mobile.data.repository.BullyingRepository
import com.satupintu.mobile.data.repository.StudentRepository
import com.satupintu.mobile.data.repository.TeacherRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

class TeacherBullyingViewModel : ViewModel() {
    private val bullyingRepository = BullyingRepository()
    private val studentRepository = StudentRepository()
    private val teacherRepository = TeacherRepository()

    private val _reports = MutableStateFlow<List<BullyingReport>>(emptyList())
    val reports: StateFlow<List<BullyingReport>> = _reports.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _teacher = MutableStateFlow<Teacher?>(null)
    val teacher: StateFlow<Teacher?> = _teacher.asStateFlow()
    private var teacherJob: Job? = null
    private var dataJob: Job? = null

    private fun normalizeIdentity(value: String?): String {
        return value?.trim().orEmpty()
    }

    private fun normalizeClassName(value: String): String {
        return value
            .uppercase()
            .replace("KELAS", "")
            .replace("\\s".toRegex(), "")
            .trim()
    }

    private fun normalizeScope(value: String?): String {
        return value?.trim()?.lowercase().orEmpty()
    }

    fun setTeacherNuptk(nuptk: String) {
        teacherJob?.cancel()
        teacherJob = viewModelScope.launch {
            _isLoading.value = true
            teacherRepository.getTeacherByNuptk(nuptk).collect { teacher ->
                _teacher.value = teacher
                if (teacher != null) {
                    loadData(teacher.homeroomClass, teacher.schoolId)
                } else {
                    _reports.value = emptyList()
                    _isLoading.value = false
                }
            }
        }
    }

    private fun loadData(className: String, schoolId: String) {
        dataJob?.cancel()
        dataJob = viewModelScope.launch {
            val studentsFlow = studentRepository.getStudents(schoolId)
            val reportsFlow = bullyingRepository.getAllReports(schoolId)

            combine(studentsFlow, reportsFlow) { allStudents, allReports ->
                val normalizedClassName = normalizeClassName(className)
                val normalizedSchoolId = normalizeScope(schoolId)
                val classStudents = allStudents.filter { student ->
                    val matchesClass = normalizeClassName(student.className) == normalizedClassName
                    val matchesSchool = normalizedSchoolId.isBlank() || normalizeScope(student.schoolId) == normalizedSchoolId
                    matchesClass && matchesSchool
                }
                val studentByIdentity = LinkedHashMap<String, Student>()
                classStudents.forEach { student ->
                    listOf(
                        normalizeIdentity(student.id),
                        normalizeIdentity(student.nisn)
                    ).filter { it.isNotBlank() }.distinct().forEach { candidate ->
                        if (!studentByIdentity.containsKey(candidate)) {
                            studentByIdentity[candidate] = student
                        }
                    }
                }
                val classStudentIds = studentByIdentity.keys.toSet()
                
                // Filter reports where Reporter OR Victim OR Perpetrator is in this class
                val filteredReports = allReports.filter { report ->
                    val isReporterInClass = classStudentIds.contains(normalizeIdentity(report.reporterId))
                    val isVictimInClass = classStudentIds.contains(normalizeIdentity(report.victimId))
                    val isPerpetratorInClass = classStudentIds.contains(normalizeIdentity(report.perpetratorId))

                    isReporterInClass || isVictimInClass || isPerpetratorInClass
                }.map { report ->
                    report.copy(
                        reporterName = report.reporterName ?: studentByIdentity[normalizeIdentity(report.reporterId)]?.name,
                        victimName = report.victimName ?: studentByIdentity[normalizeIdentity(report.victimId)]?.name,
                        perpetratorName = report.perpetratorName ?: studentByIdentity[normalizeIdentity(report.perpetratorId)]?.name
                    )
                }.sortedByDescending { it.createdAt } // Newest first
                
                filteredReports
            }.collect { filteredReports ->
                _reports.value = filteredReports
                _isLoading.value = false
            }
        }
    }

    fun markAsHandled(reportId: String) {
        bullyingRepository.updateReportStatus(reportId, "RESOLVED") { success ->
            // Optionally handle success/failure toast
        }
    }

    fun markAsUnhandled(reportId: String) {
        bullyingRepository.updateReportStatus(reportId, "PENDING") { success ->
            // Optionally handle success/failure toast
        }
    }
}

