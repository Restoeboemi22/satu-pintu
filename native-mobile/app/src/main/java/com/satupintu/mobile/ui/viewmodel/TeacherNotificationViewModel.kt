package com.satupintu.mobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.satupintu.mobile.data.model.Teacher
import com.satupintu.mobile.data.repository.BullyingRepository
import com.satupintu.mobile.data.repository.LiteracyRepository
import com.satupintu.mobile.data.repository.StudentRepository
import com.satupintu.mobile.data.repository.TeacherRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

data class NotificationItem(
    val id: String,
    val type: NotificationType,
    val title: String,
    val description: String,
    val timestamp: Long,
    val relatedId: String // ID of the log or report
)

enum class NotificationType {
    LITERACY,
    BULLYING
}

class TeacherNotificationViewModel : ViewModel() {
    private val bullyingRepository = BullyingRepository()
    private val literacyRepository = LiteracyRepository()
    private val studentRepository = StudentRepository()
    private val teacherRepository = TeacherRepository()

    private val _notifications = MutableStateFlow<List<NotificationItem>>(emptyList())
    val notifications: StateFlow<List<NotificationItem>> = _notifications.asStateFlow()

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
            .replace("[^A-Z0-9]".toRegex(), "")
            .trim()
    }

    private fun normalizeScope(value: String?): String {
        return value?.trim()?.lowercase().orEmpty()
    }

    fun loadNotifications(teacherNuptk: String) {
        teacherJob?.cancel()
        teacherJob = viewModelScope.launch {
            _isLoading.value = true
            teacherRepository.getTeacherByNuptk(teacherNuptk).collect { teacher ->
                if (teacher != null) {
                    _teacher.value = teacher
                    loadData(teacher.homeroomClass, teacher.schoolId)
                } else {
                    _teacher.value = null
                    _notifications.value = emptyList()
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
            val literacyFlow = literacyRepository.getLiteracyLogs(schoolId)

            combine(studentsFlow, reportsFlow, literacyFlow) { allStudents, allReports, allLogs ->
                val normalizedClassName = normalizeClassName(className)
                val normalizedSchoolId = normalizeScope(schoolId)
                val classStudents = allStudents.filter { student ->
                    val matchesClass = normalizeClassName(student.className) == normalizedClassName
                    val matchesSchool = normalizedSchoolId.isBlank() || normalizeScope(student.schoolId) == normalizedSchoolId
                    matchesClass && matchesSchool
                }
                val classStudentIds = classStudents.flatMap { student ->
                    listOf(normalizeIdentity(student.id), normalizeIdentity(student.nisn))
                }.filter { it.isNotBlank() }.toSet()

                val notifs = mutableListOf<NotificationItem>()

                // 1. Pending Bullying Reports
                val pendingReports = allReports.filter { report ->
                    val isRelevant = classStudentIds.contains(normalizeIdentity(report.reporterId)) ||
                        classStudentIds.contains(normalizeIdentity(report.victimId)) ||
                        classStudentIds.contains(normalizeIdentity(report.perpetratorId))
                    isRelevant && report.status.equals("PENDING", ignoreCase = true)
                }

                pendingReports.forEach { report ->
                    notifs.add(
                        NotificationItem(
                            id = "B-${report.id}",
                            type = NotificationType.BULLYING,
                            title = "Laporan Bullying Baru",
                            description = "Laporan tipe ${report.incidentType} perlu ditinjau.",
                            timestamp = report.createdAt,
                            relatedId = report.id
                        )
                    )
                }

                val pendingLogs = allLogs.filter { log ->
                    classStudentIds.contains(normalizeIdentity(log.studentId)) &&
                        log.status.equals("pending", ignoreCase = true)
                }

                pendingLogs.forEach { log ->
                    notifs.add(
                        NotificationItem(
                            id = "L-${log.id}",
                            type = NotificationType.LITERACY,
                            title = "Tugas Literasi Masuk",
                            description = "${log.studentName} mengumpulkan ringkasan buku '${log.bookTitle}'.",
                            timestamp = log.timestamp,
                            relatedId = log.id
                        )
                    )
                }

                notifs
                    .distinctBy { it.id }
                    .sortedByDescending { it.timestamp }
            }.collect { sortedNotifs ->
                _notifications.value = sortedNotifs
                _isLoading.value = false
            }
        }
    }
}

