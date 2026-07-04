package com.satupintu.mobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.satupintu.mobile.data.model.LiteracyLog
import com.satupintu.mobile.data.model.Teacher
import com.satupintu.mobile.data.repository.LiteracyRepository
import com.satupintu.mobile.data.repository.StudentRepository
import com.satupintu.mobile.data.repository.TeacherRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

class TeacherLiteracyViewModel : ViewModel() {
    private val repository = LiteracyRepository()
    private val studentRepository = StudentRepository()
    private val teacherRepository = TeacherRepository()
    
    private val _allLogs = MutableStateFlow<List<LiteracyLog>>(emptyList())
    private val _logs = MutableStateFlow<List<LiteracyLog>>(emptyList())
    val logs: StateFlow<List<LiteracyLog>> = _logs.asStateFlow()
    private val _teacher = MutableStateFlow<Teacher?>(null)
    val teacher: StateFlow<Teacher?> = _teacher.asStateFlow()
    private val _students = MutableStateFlow<List<com.satupintu.mobile.data.model.Student>>(emptyList())
    
    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    private var teacherJob: Job? = null

    init {
        viewModelScope.launch {
            combine(_allLogs, _teacher, _students) { logs, teacher, allStudents ->
                val schoolScope = normalizeScope(teacher?.schoolId)
                val classScope = normalizeClassName(teacher?.homeroomClass.orEmpty())

                val classStudents = allStudents.filter { student ->
                    val matchesClass = classScope.isBlank() || normalizeClassName(student.className) == classScope
                    val matchesSchool = schoolScope.isBlank() || normalizeScope(student.schoolId) == schoolScope
                    matchesClass && matchesSchool
                }

                val allowedStudentIds = classStudents
                    .flatMap { student -> listOf(normalizeIdentity(student.id), normalizeIdentity(student.nisn)) }
                    .filter { it.isNotBlank() }
                    .toSet()

                val allowedStudentNames = classStudents
                    .map { normalizeName(it.name) }
                    .filter { it.isNotBlank() }
                    .toSet()

                logs.filter { log ->
                    val logStudentId = normalizeIdentity(log.studentId)
                    val logStudentName = normalizeName(log.studentName)
                    val matchesRoster = (logStudentId.isNotBlank() && allowedStudentIds.contains(logStudentId)) ||
                        (logStudentId.isBlank() && logStudentName.isNotBlank() && allowedStudentNames.contains(logStudentName))

                    if (!matchesRoster) return@filter false

                    val logScope = normalizeScope(log.schoolId)
                    val matchesSchool = schoolScope.isBlank() || logScope == schoolScope || logScope.isBlank()
                    matchesSchool
                }.sortedByDescending { it.timestamp }
            }.collect { filtered ->
                _logs.value = filtered
            }
        }
    }

    fun setTeacherNuptk(nuptk: String) {
        teacherJob?.cancel()
        teacherJob = viewModelScope.launch {
            teacherRepository.getTeacherByNuptk(nuptk).collect { teacher ->
                _teacher.value = teacher
                val schoolScope = normalizeScope(teacher?.schoolId)
                loadStudents(schoolScope)
                loadLogs(schoolScope)
            }
        }
    }

    private fun loadStudents(schoolId: String = "") {
        viewModelScope.launch {
            studentRepository.getStudents(schoolId).collect { students ->
                _students.value = students
            }
        }
    }

    private fun loadLogs(schoolId: String = "") {
        viewModelScope.launch {
            repository.getLiteracyLogs(schoolId).collect { fetchedLogs ->
                _allLogs.value = fetchedLogs
                _isLoading.value = false
            }
        }
    }

    fun submitGrade(logId: String, grade: String, feedback: String) {
        repository.updateLogGrade(logId, grade, feedback) { success ->
            // Optionally handle success/failure toast here or rely on real-time update
        }
    }

    fun deleteLog(logId: String) {
        repository.deleteLog(logId) { success ->
            // Handle success/failure if needed
        }
    }

    private fun normalizeClassName(value: String): String {
        return value
            .uppercase()
            .replace("KELAS", "")
            .replace("[^A-Z0-9]".toRegex(), "")
            .trim()
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

    private fun normalizeScope(value: String?): String {
        return value?.trim()?.lowercase().orEmpty()
    }
}

