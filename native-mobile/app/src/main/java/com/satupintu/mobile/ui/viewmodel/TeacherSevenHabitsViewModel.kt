package com.satupintu.mobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.satupintu.mobile.data.model.HabitLog
import com.satupintu.mobile.data.model.Student
import com.satupintu.mobile.data.model.Teacher
import com.satupintu.mobile.data.model.TeacherHabitRubric
import com.satupintu.mobile.data.repository.StudentRepository
import com.satupintu.mobile.data.repository.TeacherRepository
import com.satupintu.mobile.data.repository.TeacherSevenHabitsRepository
import com.satupintu.mobile.util.SevenHabitsGradingResult
import com.satupintu.mobile.util.calculateSevenHabitsGrades
import com.satupintu.mobile.util.extractWeekOfMonth
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.launch
import java.util.Calendar

private val DAYS = listOf("Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu")
private val DEFAULT_RUBRIC = TeacherHabitRubric()

private data class TeacherSevenHabitsSourceBundle(
    val teacher: Teacher?,
    val schoolScopeId: String,
    val students: List<Student>,
    val logs: List<HabitLog>,
    val ratings: Map<String, TeacherHabitRubric>
)

private data class TeacherSevenHabitsFilterBundle(
    val year: Int,
    val month: Int,
    val week: Int,
    val dayName: String
)

data class TeacherSevenHabitsMonitoringRow(
    val student: Student,
    val dayLog: HabitLog?,
    val weekLogs: List<HabitLog>,
    val monthLogs: List<HabitLog>
)

data class TeacherSevenHabitsGradeRow(
    val student: Student,
    val rubric: TeacherHabitRubric,
    val isTeacherRated: Boolean,
    val grading: SevenHabitsGradingResult
)

class TeacherSevenHabitsViewModel : ViewModel() {
    private val studentRepository = StudentRepository()
    private val teacherRepository = TeacherRepository()
    private val sevenHabitsRepository = TeacherSevenHabitsRepository()

    private val _teacher = MutableStateFlow<Teacher?>(null)
    val teacher: StateFlow<Teacher?> = _teacher.asStateFlow()

    private val _schoolScopeId = MutableStateFlow("")

    private val _selectedYear = MutableStateFlow(Calendar.getInstance().get(Calendar.YEAR))
    val selectedYear: StateFlow<Int> = _selectedYear.asStateFlow()

    private val _selectedMonth = MutableStateFlow(Calendar.getInstance().get(Calendar.MONTH) + 1)
    val selectedMonth: StateFlow<Int> = _selectedMonth.asStateFlow()

    private val _selectedWeek = MutableStateFlow(extractWeekOfMonth(buildTodayDateKey()))
    val selectedWeek: StateFlow<Int> = _selectedWeek.asStateFlow()

    private val _selectedDayName = MutableStateFlow(todayDayName())
    val selectedDayName: StateFlow<String> = _selectedDayName.asStateFlow()

    private val _monitoringRows = MutableStateFlow<List<TeacherSevenHabitsMonitoringRow>>(emptyList())
    val monitoringRows: StateFlow<List<TeacherSevenHabitsMonitoringRow>> = _monitoringRows.asStateFlow()

    private val _gradingRows = MutableStateFlow<List<TeacherSevenHabitsGradeRow>>(emptyList())
    val gradingRows: StateFlow<List<TeacherSevenHabitsGradeRow>> = _gradingRows.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isSavingRubric = MutableStateFlow(false)
    val isSavingRubric: StateFlow<Boolean> = _isSavingRubric.asStateFlow()

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    private val studentsFlow = MutableStateFlow<List<Student>>(emptyList())
    private val logsFlow = MutableStateFlow<List<HabitLog>>(emptyList())
    private val teacherRatingsFlow = MutableStateFlow<Map<String, TeacherHabitRubric>>(emptyMap())

    private var teacherJob: Job? = null
    private var ratingsJob: Job? = null

    init {
        observeStudents()
        observeLogs()
        observeDerivedRows()
    }

    fun setTeacherNuptk(nuptk: String) {
        if (nuptk.isBlank()) return
        _schoolScopeId.value = ""
        teacherJob?.cancel()
        teacherJob = viewModelScope.launch {
            teacherRepository.getTeacherByNuptk(nuptk).collect { teacher ->
                _teacher.value = teacher
                observeTeacherRatings(teacher?.schoolId.orEmpty())
            }
        }
    }

    fun setPrincipalSchoolId(schoolId: String) {
        val normalizedSchoolId = schoolId.trim()
        if (normalizedSchoolId == _schoolScopeId.value) return
        teacherJob?.cancel()
        _teacher.value = null
        _schoolScopeId.value = normalizedSchoolId
        observeTeacherRatings(normalizedSchoolId)
    }

    fun setYear(year: Int) {
        _selectedYear.value = year
    }

    fun setMonth(month: Int) {
        _selectedMonth.value = month
    }

    fun setWeek(week: Int) {
        _selectedWeek.value = week.coerceIn(1, 5)
    }

    fun setDayName(dayName: String) {
        if (dayName in DAYS) {
            _selectedDayName.value = dayName
        }
    }

    fun saveTeacherRubric(
        studentId: String,
        rubric: TeacherHabitRubric,
        onComplete: ((Boolean) -> Unit)? = null
    ) {
        val teacherValue = _teacher.value
        if (teacherValue == null) {
            _message.value = "Data guru belum siap."
            onComplete?.invoke(false)
            return
        }

        _isSavingRubric.value = true
        sevenHabitsRepository.saveTeacherRating(
            schoolId = teacherValue.schoolId,
            studentId = studentId,
            month = _selectedMonth.value,
            year = _selectedYear.value,
            rubric = rubric
        ) { success, errorMessage ->
            _isSavingRubric.value = false
            if (success) {
                val ratingKey = buildRatingKey(studentId, _selectedMonth.value, _selectedYear.value)
                teacherRatingsFlow.value = teacherRatingsFlow.value + (ratingKey to rubric.copy(ratedAt = System.currentTimeMillis()))
                _message.value = "Nilai guru berhasil disimpan."
            } else {
                _message.value = errorMessage ?: "Gagal menyimpan nilai guru."
            }
            onComplete?.invoke(success)
        }
    }

    fun clearMessage() {
        _message.value = null
    }

    private fun observeStudents() {
        viewModelScope.launch {
            combine(_teacher, _schoolScopeId) { teacher, schoolScopeId ->
                schoolScopeId.ifBlank { teacher?.schoolId.orEmpty() }
            }.flatMapLatest { effectiveSchoolId ->
                studentRepository.getStudents(effectiveSchoolId)
            }.collect {
                studentsFlow.value = it
            }
        }
    }

    private fun observeLogs() {
        viewModelScope.launch {
            combine(_teacher, _schoolScopeId) { teacher, schoolScopeId ->
                schoolScopeId.ifBlank { teacher?.schoolId.orEmpty() }
            }.flatMapLatest { effectiveSchoolId ->
                sevenHabitsRepository.getAllLogs(effectiveSchoolId)
            }.collect {
                logsFlow.value = it
            }
        }
    }

    private fun observeTeacherRatings(schoolId: String) {
        ratingsJob?.cancel()
        ratingsJob = viewModelScope.launch {
            sevenHabitsRepository.getTeacherRatings(schoolId).collect {
                teacherRatingsFlow.value = it
            }
        }
    }

    private fun observeDerivedRows() {
        viewModelScope.launch {
            val sourceFlow = combine(
                _teacher,
                _schoolScopeId,
                studentsFlow,
                logsFlow,
                teacherRatingsFlow
            ) { teacher, schoolScopeId, students, logs, ratings ->
                TeacherSevenHabitsSourceBundle(
                    teacher = teacher,
                    schoolScopeId = schoolScopeId,
                    students = students,
                    logs = logs,
                    ratings = ratings
                )
            }

            val filterFlow = combine(
                _selectedYear,
                _selectedMonth,
                _selectedWeek,
                _selectedDayName
            ) { year, month, week, dayName ->
                TeacherSevenHabitsFilterBundle(
                    year = year,
                    month = month,
                    week = week,
                    dayName = dayName
                )
            }

            combine(sourceFlow, filterFlow) { source, filter ->
                val teacher = source.teacher
                val schoolScopeId = source.schoolScopeId
                val students = source.students
                val logs = source.logs
                val ratings = source.ratings
                val year = filter.year
                val month = filter.month
                val week = filter.week
                val dayName = filter.dayName
                val classStudents = filterStudentsForScope(teacher, schoolScopeId, students)
                val monitoring = classStudents.map { student ->
                    val studentMonthLogs = logs.filter { log ->
                        matchesStudent(log.studentId, student) &&
                            extractYear(log.date) == year &&
                            extractMonth(log.date) == month
                    }
                    val studentWeekLogs = studentMonthLogs.filter { log ->
                        extractWeekOfMonth(log.date) == week
                    }
                    TeacherSevenHabitsMonitoringRow(
                        student = student,
                        dayLog = studentWeekLogs.find { log -> extractDayName(log.date) == dayName },
                        weekLogs = studentWeekLogs,
                        monthLogs = studentMonthLogs
                    )
                }

                val grading = classStudents.map { student ->
                    val studentLogs = logs.filter { log ->
                        matchesStudent(log.studentId, student) &&
                            extractYear(log.date) == year &&
                            extractMonth(log.date) == month
                    }
                    val rubricFromId = ratings[buildRatingKey(student.id, month, year)]
                    val rubricFromNisn = ratings[buildRatingKey(student.nisn, month, year)]
                    val rubric = rubricFromId ?: rubricFromNisn ?: DEFAULT_RUBRIC
                    val isTeacherRated = (rubricFromId != null || rubricFromNisn != null) && rubric.ratedAt > 0L

                    TeacherSevenHabitsGradeRow(
                        student = student,
                        rubric = rubric,
                        isTeacherRated = isTeacherRated,
                        grading = calculateSevenHabitsGrades(
                            logs = studentLogs,
                            year = year,
                            month = month,
                            teacherRatingAvailable = isTeacherRated,
                            teacherRating = rubric.total
                        )
                    )
                }

                Pair(monitoring, grading)
            }.collect { (monitoring, grading) ->
                _monitoringRows.value = monitoring
                _gradingRows.value = grading
                _isLoading.value = false
            }
        }
    }

    private fun filterStudentsForScope(
        teacher: Teacher?,
        schoolScopeId: String,
        students: List<Student>
    ): List<Student> {
        val normalizedSchoolScopeId = schoolScopeId.trim()
        if (normalizedSchoolScopeId.isNotBlank()) {
            return students
                .filter { student ->
                    student.schoolId.trim().equals(normalizedSchoolScopeId, ignoreCase = true)
                }
                .sortedWith(compareBy<Student> { normalizeClassName(it.className) }.thenBy { it.name })
        }

        val targetClass = normalizeClassName(teacher?.homeroomClass.orEmpty())
        val targetSchoolId = teacher?.schoolId?.trim().orEmpty()
        if (targetClass.isBlank()) return emptyList()

        return students
            .filter { student ->
                val studentClass = normalizeClassName(student.className)
                val classMatches = studentClass == targetClass ||
                    studentClass.contains(targetClass) ||
                    targetClass.contains(studentClass)
                val schoolMatches = targetSchoolId.isBlank() ||
                    student.schoolId.trim().equals(targetSchoolId, ignoreCase = true)
                classMatches && schoolMatches
            }
            .sortedBy { it.name }
    }

    private fun matchesStudent(logStudentId: String, student: Student): Boolean {
        val normalizedLogId = logStudentId.trim()
        return normalizedLogId == student.id.trim() || normalizedLogId == student.nisn.trim()
    }

    private fun normalizeClassName(value: String): String {
        return value
            .uppercase()
            .replace("KELAS", "")
            .replace("\\s".toRegex(), "")
            .trim()
    }

    private fun buildRatingKey(studentId: String, month: Int, year: Int): String {
        return "${studentId.trim()}_${month}_${year}"
    }

    private fun extractYear(date: String): Int {
        return date.split("-").getOrNull(0)?.toIntOrNull() ?: 0
    }

    private fun extractMonth(date: String): Int {
        return date.split("-").getOrNull(1)?.toIntOrNull() ?: 0
    }

    private fun extractDayName(date: String): String {
        val parts = date.split("-")
        val year = parts.getOrNull(0)?.toIntOrNull() ?: return ""
        val month = parts.getOrNull(1)?.toIntOrNull()?.minus(1) ?: return ""
        val day = parts.getOrNull(2)?.toIntOrNull() ?: return ""
        val calendar = Calendar.getInstance().apply {
            set(Calendar.YEAR, year)
            set(Calendar.MONTH, month)
            set(Calendar.DAY_OF_MONTH, day)
        }
        val index = when (calendar.get(Calendar.DAY_OF_WEEK)) {
            Calendar.MONDAY -> 0
            Calendar.TUESDAY -> 1
            Calendar.WEDNESDAY -> 2
            Calendar.THURSDAY -> 3
            Calendar.FRIDAY -> 4
            Calendar.SATURDAY -> 5
            else -> 6
        }
        return DAYS[index]
    }

    private fun todayDayName(): String {
        return extractDayName(buildTodayDateKey())
    }

    private fun buildTodayDateKey(): String {
        val calendar = Calendar.getInstance()
        val year = calendar.get(Calendar.YEAR)
        val month = calendar.get(Calendar.MONTH) + 1
        val day = calendar.get(Calendar.DAY_OF_MONTH)
        return "%04d-%02d-%02d".format(year, month, day)
    }
}

