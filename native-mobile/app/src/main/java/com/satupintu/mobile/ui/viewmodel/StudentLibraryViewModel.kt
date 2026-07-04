package com.satupintu.mobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.satupintu.mobile.data.model.Book
import com.satupintu.mobile.data.model.LiteracyTask
import com.satupintu.mobile.data.repository.LibraryRepository
import com.satupintu.mobile.data.repository.LiteracyRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class StudentLibraryViewModel : ViewModel() {
    private val repository = LibraryRepository()
    private val literacyRepository = LiteracyRepository()
    
    private val _books = MutableStateFlow<List<Book>>(emptyList())
    private val _allTasks = MutableStateFlow<List<LiteracyTask>>(emptyList())
    private val _tasks = MutableStateFlow<List<LiteracyTask>>(emptyList())
    val tasks: StateFlow<List<LiteracyTask>> = _tasks.asStateFlow()
    
    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()
    
    private val _selectedCategory = MutableStateFlow("Semua")
    val selectedCategory: StateFlow<String> = _selectedCategory.asStateFlow()
    private val _schoolScope = MutableStateFlow("")
    private val _studentScope = MutableStateFlow("")
    private var tasksJob: Job? = null
    private var logsJob: Job? = null

    val filteredBooks: StateFlow<List<Book>> = combine(_books, _searchQuery, _selectedCategory) { books, query, category ->
        if (books.isEmpty()) return@combine emptyList()
        
        books.filter { book ->
            val matchesQuery = if (query.isBlank()) true else {
                book.displayTitle.contains(query, ignoreCase = true) || 
                book.displayAuthor.contains(query, ignoreCase = true)
            }
            
            val matchesCategory = if (category == "Semua") true else {
                // Check against displayCategory (which might be "Main > Sub") OR just Main Category if we had it
                // Since displayCategory logic is: category ?: kategori ?: "Umum"
                // And the chips are derived from displayCategory
                // exact match should work.
                book.displayCategory.equals(category, ignoreCase = true)
            }
            
            matchesQuery && matchesCategory
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    
    val categories: StateFlow<List<String>> = _books.map { books ->
        val cats = books.map { it.displayCategory }.distinct().sorted().toMutableList()
        if (!cats.contains("Semua")) {
            cats.add(0, "Semua")
        }
        // Ensure "Semua" is first if it was already there or added
        val finalCats = mutableListOf("Semua")
        finalCats.addAll(cats.filter { it != "Semua" })
        finalCats
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), listOf("Semua"))

    private val _allLogs = MutableStateFlow<List<com.satupintu.mobile.data.model.LiteracyLog>>(emptyList())
    private val _logs = MutableStateFlow<List<com.satupintu.mobile.data.model.LiteracyLog>>(emptyList())
    val logs: StateFlow<List<com.satupintu.mobile.data.model.LiteracyLog>> = _logs.asStateFlow()

    init {
        fetchBooks()
        fetchTasks()
        fetchLogs()
    }

    private fun applySchoolScope() {
        val scope = _schoolScope.value.trim().lowercase()
        val studentScope = _studentScope.value.trim()
        _tasks.value = _allTasks.value.filter { task ->
            val taskScope = task.schoolId.trim().lowercase()
            scope.isBlank() || taskScope == scope
        }
        _logs.value = _allLogs.value.filter { log ->
            val logScope = log.schoolId.trim().lowercase()
            val matchesSchool = scope.isBlank() || logScope == scope
            val matchesStudent = studentScope.isBlank() || log.studentId.trim() == studentScope
            matchesSchool && matchesStudent
        }
    }

    fun setSchoolScope(schoolId: String) {
        val next = schoolId.trim().lowercase()
        if (_schoolScope.value == next) return
        _schoolScope.value = next
        fetchTasks()
        fetchLogs()
    }

    fun setStudentScope(studentId: String) {
        val next = studentId.trim()
        if (_studentScope.value == next) return
        _studentScope.value = next
        fetchLogs()
    }

    private fun fetchBooks() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                repository.getBooks().collect { bookList ->
                    _books.value = bookList
                    _isLoading.value = false
                    _error.value = null
                }
            } catch (e: Exception) {
                _error.value = "Gagal memuat buku: ${e.message}"
                _isLoading.value = false
            }
        }
    }
    
    private fun fetchTasks() {
        tasksJob?.cancel()
        tasksJob = viewModelScope.launch {
            try {
                literacyRepository.getLiteracyTasks(_schoolScope.value).collect { taskList ->
                    _allTasks.value = taskList
                    applySchoolScope()
                }
            } catch (e: Exception) {
                // Ignore task error for now or log it
            }
        }
    }

    private fun fetchLogs() {
        logsJob?.cancel()
        logsJob = viewModelScope.launch {
            try {
                literacyRepository.getLiteracyLogs(
                    schoolId = _schoolScope.value,
                    studentId = _studentScope.value
                ).collect { logList ->
                    _allLogs.value = logList
                    applySchoolScope()
                }
            } catch (e: Exception) {
                 // Ignore
            }
        }
    }

    fun submitLiteracyReport(
        studentId: String,
        studentName: String,
        studentClass: String,
        taskId: String,
        taskTitle: String,
        bookTitle: String,
        author: String,
        summary: String,
        schoolId: String,
        onComplete: (Boolean) -> Unit
    ) {
        viewModelScope.launch {
             try {
                 val normalizedStudentId = studentId.trim()
                 val normalizedSchoolId = schoolId.trim().lowercase()
                 if (normalizedStudentId.isBlank() || normalizedSchoolId.isBlank()) {
                     onComplete(false)
                     return@launch
                 }

                 literacyRepository.submitLog(
                     com.satupintu.mobile.data.model.LiteracyLog(
                        id = "", // Auto-generated
                        studentId = normalizedStudentId,
                        studentName = studentName.trim(),
                        studentClass = studentClass.trim(),
                        schoolId = normalizedSchoolId,
                        taskId = taskId.trim(),
                        taskTitle = taskTitle.trim(),
                        bookTitle = bookTitle.trim(),
                        author = author.trim(),
                        summary = summary.trim(),
                        status = "pending",
                        timestamp = System.currentTimeMillis()
                     )
                 ) { success ->
                     onComplete(success)
                 }
             } catch (e: Exception) {
                 onComplete(false)
             }
        }
    }
    
    fun deleteLiteracyLog(logId: String, onComplete: (Boolean) -> Unit) {
        viewModelScope.launch {
            try {
                literacyRepository.deleteLog(logId) { success ->
                    onComplete(success)
                }
            } catch (e: Exception) {
                onComplete(false)
            }
        }
    }

    
    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
    }
    
    fun onCategorySelected(category: String) {
        _selectedCategory.value = category
    }

    fun refreshBooks() {
        fetchBooks()
    }
}

