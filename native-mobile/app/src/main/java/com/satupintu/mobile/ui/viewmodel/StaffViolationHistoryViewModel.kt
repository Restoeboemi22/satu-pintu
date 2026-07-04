package com.satupintu.mobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.satupintu.mobile.data.model.DisciplineRule
import com.satupintu.mobile.data.repository.DisciplineRepository
import com.satupintu.mobile.data.repository.StudentRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class ViolationHistoryItem(
    val id: String,
    val studentName: String,
    val studentClass: String,
    val violationName: String,
    val date: String,
    val timestamp: Long
)

class StaffViolationHistoryViewModel : ViewModel() {
    private val disciplineRepository = DisciplineRepository()
    private val studentRepository = StudentRepository()

    private val _allViolations = MutableStateFlow<List<ViolationHistoryItem>>(emptyList())
    private val _filteredViolations = MutableStateFlow<List<ViolationHistoryItem>>(emptyList())
    val filteredViolations: StateFlow<List<ViolationHistoryItem>> = _filteredViolations.asStateFlow()

    private val _availableClasses = MutableStateFlow<List<String>>(emptyList())
    val availableClasses: StateFlow<List<String>> = _availableClasses.asStateFlow()

    private val _selectedClass = MutableStateFlow<String?>(null)
    val selectedClass: StateFlow<String?> = _selectedClass.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    private var currentSchoolScope = ""
    private var dataJob: Job? = null

    private fun normalizeIdentity(value: String?): String {
        return value?.trim().orEmpty()
    }

    init {
        loadData(currentSchoolScope)
    }

    private fun loadData(schoolId: String) {
        dataJob?.cancel()
        dataJob = viewModelScope.launch {
            _isLoading.value = true
            val dateFormatter = SimpleDateFormat("dd MMM yyyy", Locale("id", "ID"))

            combine(
                disciplineRepository.getAllRecords(schoolId),
                studentRepository.getStudents(schoolId),
                disciplineRepository.getRules(schoolId)
            ) { records, students, rules ->
                val scopedStudents = if (schoolId.isBlank()) {
                    students
                } else {
                    students.filter { it.schoolId.trim().lowercase() == schoolId }
                }
                val studentMap = LinkedHashMap<String, com.satupintu.mobile.data.model.Student>()
                scopedStudents.forEach { student ->
                    listOf(
                        normalizeIdentity(student.id),
                        normalizeIdentity(student.nisn)
                    ).filter { it.isNotBlank() }.distinct().forEach { candidate ->
                        if (!studentMap.containsKey(candidate)) {
                            studentMap[candidate] = student
                        }
                    }
                }
                val ruleMap = rules.associateBy(DisciplineRule::id)

                val scopedViolations = if (schoolId.isBlank()) {
                    records
                } else {
                    records.filter { it.schoolId.trim().lowercase() == schoolId }
                }

                val violations = scopedViolations.mapNotNull { record ->
                    val student = studentMap[normalizeIdentity(record.studentId)]
                    val ruleName = ruleMap[record.ruleId]?.ruleName
                        ?: record.ruleNameSnapshot
                            .takeIf { it.isNotBlank() }
                        ?: "Pelanggaran Lain"

                    if (student != null || record.studentNameSnapshot.isNotBlank()) {
                        ViolationHistoryItem(
                            id = record.id,
                            studentName = student?.name ?: record.studentNameSnapshot,
                            studentClass = student?.className ?: record.classNameSnapshot,
                            violationName = ruleName,
                            date = dateFormatter.format(Date(record.date)),
                            timestamp = record.date
                        )
                    } else {
                        null
                    }
                }.sortedByDescending { it.timestamp }

                val classes = scopedStudents.map { it.className }.distinct().sorted()

                Pair(violations, classes)
            }.collect { (violations, classes) ->
                _allViolations.value = violations
                _availableClasses.value = classes
                applyFilter()
                _isLoading.value = false
            }
        }
    }

    fun setSchoolScope(schoolId: String) {
        val normalized = schoolId.trim().lowercase()
        if (normalized == currentSchoolScope) return
        currentSchoolScope = normalized
        loadData(normalized)
    }

    fun filterByClass(className: String?) {
        _selectedClass.value = className
        applyFilter()
    }

    private fun applyFilter() {
        val currentClass = _selectedClass.value
        if (currentClass == null) {
            _filteredViolations.value = _allViolations.value
        } else {
            _filteredViolations.value = _allViolations.value.filter { it.studentClass == currentClass }
        }
    }
}

