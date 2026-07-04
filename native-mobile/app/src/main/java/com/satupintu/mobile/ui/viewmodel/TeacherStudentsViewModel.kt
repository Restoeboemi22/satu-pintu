package com.satupintu.mobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.satupintu.mobile.data.model.Student
import com.satupintu.mobile.data.model.Teacher
import com.satupintu.mobile.data.model.VirtualPet
import com.satupintu.mobile.data.repository.StudentRepository
import com.satupintu.mobile.data.repository.TeacherRepository
import com.satupintu.mobile.data.repository.VirtualPetRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

class TeacherStudentsViewModel : ViewModel() {
    private val repository = StudentRepository()
    private val teacherRepository = TeacherRepository()
    private val petRepository = VirtualPetRepository()

    private val _teacher = MutableStateFlow<Teacher?>(null)
    val teacher: StateFlow<Teacher?> = _teacher.asStateFlow()

    private val _students = MutableStateFlow<List<Student>>(emptyList())
    
    // Map of StudentID -> VirtualPet
    private val _studentPets = MutableStateFlow<Map<String, VirtualPet>>(emptyMap())
    val studentPets: StateFlow<Map<String, VirtualPet>> = _studentPets.asStateFlow()
    
    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _filteredStudents = MutableStateFlow<List<Student>>(emptyList())
    val filteredStudents: StateFlow<List<Student>> = _filteredStudents.asStateFlow()
    private var teacherJob: Job? = null

    fun setTeacherNuptk(nuptk: String) {
        teacherJob?.cancel()
        teacherJob = viewModelScope.launch {
            teacherRepository.getTeacherByNuptk(nuptk).collect { teacher ->
                _teacher.value = teacher
            }
        }
    }

    init {
        loadStudents()
        loadPets()
        
        // Combine students, search query, and teacher to update filtered list
        viewModelScope.launch {
            combine(_students, _searchQuery, _teacher) { students, query, teacher ->
                val targetClass = normalizeClassName(teacher?.homeroomClass.orEmpty())
                val teacherSchoolScope = normalizeScope(teacher?.schoolId)
                val classStudents = if (targetClass.isBlank()) {
                    emptyList()
                } else {
                    students.filter { student ->
                        val studentClass = normalizeClassName(student.className)
                        val studentSchoolScope = normalizeScope(student.schoolId)
                        val matchesClass = studentClass == targetClass ||
                            studentClass.contains(targetClass) ||
                            targetClass.contains(studentClass)
                        val matchesSchool = teacherSchoolScope.isBlank() || studentSchoolScope == teacherSchoolScope
                        matchesClass && matchesSchool
                    }
                }
                
                if (query.isBlank()) {
                    classStudents
                } else {
                    classStudents.filter { 
                        it.name.contains(query, ignoreCase = true) ||
                        it.nisn.contains(query, ignoreCase = true) ||
                        it.className.contains(query, ignoreCase = true)
                    }
                }
            }.collect {
                _filteredStudents.value = it
            }
        }
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

    private fun loadStudents() {
        viewModelScope.launch {
            repository.getStudents().collect { fetchedStudents ->
                _students.value = fetchedStudents
                _isLoading.value = false
            }
        }
    }
    
    private fun loadPets() {
        viewModelScope.launch {
            petRepository.getAllPets().collect { pets ->
                // Create a map of StudentID -> Pet for O(1) lookup
                val petMap = pets.associateBy { it.studentId }
                _studentPets.value = petMap
            }
        }
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
    }
}

