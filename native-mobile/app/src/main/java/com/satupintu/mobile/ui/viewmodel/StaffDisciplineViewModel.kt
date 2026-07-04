package com.satupintu.mobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.satupintu.mobile.data.model.DisciplineRecord
import com.satupintu.mobile.data.model.DisciplineRule
import com.satupintu.mobile.data.model.Student
import com.satupintu.mobile.data.repository.DisciplineRepository
import com.satupintu.mobile.data.repository.StudentRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

class StaffDisciplineViewModel : ViewModel() {
    private val disciplineRepository = DisciplineRepository()
    private val studentRepository = StudentRepository()

    private val _allStudents = MutableStateFlow<List<Student>>(emptyList())
    val allStudents: StateFlow<List<Student>> = _allStudents.asStateFlow()

    private val _filteredStudents = MutableStateFlow<List<Student>>(emptyList())
    val filteredStudents: StateFlow<List<Student>> = _filteredStudents.asStateFlow()

    private val _availableClasses = MutableStateFlow<List<String>>(emptyList())
    val availableClasses: StateFlow<List<String>> = _availableClasses.asStateFlow()

    private val _selectedClass = MutableStateFlow<String?>(null)
    val selectedClass: StateFlow<String?> = _selectedClass.asStateFlow()

    private val _rules = MutableStateFlow<List<DisciplineRule>>(emptyList())
    val rules: StateFlow<List<DisciplineRule>> = _rules.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _selectedStudent = MutableStateFlow<Student?>(null)
    val selectedStudent: StateFlow<Student?> = _selectedStudent.asStateFlow()

    private val _reporterCredential = MutableStateFlow("")
    private val _reporterName = MutableStateFlow("Petugas OSIS")
    private var currentSchoolScope = ""
    private var dataJob: Job? = null
    
    // Internal tracking for search query
    private var currentSearchQuery = ""

    init {
        loadInitialData()
    }

    private fun loadInitialData() {
        loadInitialData(currentSchoolScope)
    }

    private fun loadInitialData(schoolId: String) {
        dataJob?.cancel()
        dataJob = viewModelScope.launch {
            _isLoading.value = true
            try {
                combine(
                    disciplineRepository.getRules(schoolId),
                    studentRepository.getStudents(schoolId)
                ) { rulesList, studentsList ->
                    Pair(rulesList, studentsList)
                }.collect { (rulesList, studentsList) ->
                    val scopedStudents = if (schoolId.isBlank()) {
                        studentsList
                    } else {
                        studentsList.filter { it.schoolId.trim().lowercase() == schoolId }
                    }

                    _rules.value = rulesList.filter { it.isActive }

                    _allStudents.value = scopedStudents

                    // Extract unique classes and sort them
                    val classes = scopedStudents.map { it.className }.distinct().sorted()
                    _availableClasses.value = classes

                    applyFilters()
                    _isLoading.value = false
                }
            } catch (e: Exception) {
                // Handle error
                _isLoading.value = false
            }
        }
    }

    fun setSchoolScope(schoolId: String) {
        val normalized = schoolId.trim().lowercase()
        if (normalized == currentSchoolScope) return
        currentSchoolScope = normalized
        loadInitialData(normalized)
    }

    fun searchStudents(query: String) {
        currentSearchQuery = query
        applyFilters()
    }
    
    fun filterByClass(className: String?) {
        _selectedClass.value = className
        applyFilters()
    }
    
    private fun applyFilters() {
        var result = _allStudents.value
        
        // Filter by Class
        val selectedCls = _selectedClass.value
        if (selectedCls != null) {
            result = result.filter { it.className == selectedCls }
        }
        
        // Filter by Search Query
        if (currentSearchQuery.isNotBlank()) {
            result = result.filter {
                it.name.contains(currentSearchQuery, ignoreCase = true) || 
                it.className.contains(currentSearchQuery, ignoreCase = true)
            }
        }
        
        _filteredStudents.value = result.sortedBy { it.name }
    }

    fun selectStudent(student: Student) {
        _selectedStudent.value = student
    }

    fun clearSelection() {
        _selectedStudent.value = null
    }

    fun setReporterSession(displayName: String, credential: String) {
        val normalizedName = displayName.trim()
        _reporterName.value = if (normalizedName.isNotEmpty()) normalizedName else "Petugas OSIS"
        _reporterCredential.value = credential.trim()
    }

    fun addRecord(rule: DisciplineRule, description: String, date: Long, onComplete: (Boolean) -> Unit) {
        val student = _selectedStudent.value ?: return
        val now = System.currentTimeMillis()
        val reporterName = _reporterName.value.ifBlank { "Petugas OSIS" }
        val studentIdentifier = student.id.ifBlank { student.nisn }
        
        val record = DisciplineRecord(
            schoolId = student.schoolId,
            studentId = studentIdentifier,
            studentNameSnapshot = student.name,
            classNameSnapshot = student.className,
            ruleId = rule.id,
            ruleNameSnapshot = rule.ruleName,
            date = date,
            points = rule.points,
            description = description.trim().ifBlank { null },
            recordedBy = reporterName,
            reportedByUserId = _reporterCredential.value.ifBlank { reporterName },
            reportedByName = reporterName,
            reportedByRole = "osis",
            sourceApp = "gas_student_app_osis_mode",
            status = "APPROVED",
            createdAt = now,
            updatedAt = now
        )

        _isLoading.value = true
        disciplineRepository.saveRecord(record) { success ->
            _isLoading.value = false
            onComplete(success)
        }
    }
}

