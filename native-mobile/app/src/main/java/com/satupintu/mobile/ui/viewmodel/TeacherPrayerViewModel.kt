package com.satupintu.mobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.google.firebase.database.ktx.getValue
import com.satupintu.mobile.data.model.Student
import com.satupintu.mobile.data.model.Teacher
import com.satupintu.mobile.data.repository.StudentRepository
import com.satupintu.mobile.data.repository.TeacherRepository
import com.satupintu.mobile.util.DayScheduleRule
import com.satupintu.mobile.util.HolidayRule
import com.satupintu.mobile.util.isValidPrayerDay
import com.satupintu.mobile.util.normalizeScope
import com.satupintu.mobile.util.parseHolidaySnapshot
import com.satupintu.mobile.util.parseScheduleSnapshot
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.util.Calendar

data class TeacherPrayerItem(
    val student: Student,
    val status: String,
    val submittedAt: Long? = null
)

data class TeacherPrayerStats(
    val prayCount: Int = 0,
    val notYetCount: Int = 0
)

data class TeacherPrayerMonthlyStats(
    val prayCount: Int = 0,
    val notPrayCount: Int = 0,
    val permitCount: Int = 0,
    val halanganCount: Int = 0
)

data class ManualPrayerResult(
    val success: Boolean,
    val message: String
)

data class ManualPrayerSubmission(
    val item: TeacherPrayerItem,
    val status: String
)

private data class MonthlyPrayerRuleContext(
    val month: Int,
    val year: Int,
    val schedules: Map<Int, DayScheduleRule>,
    val holidays: List<HolidayRule>
)

private data class PrayerLog(
    val studentId: String = "",
    val nisn: String = "",
    val date: Long = 0L,
    val status: String = ""
)

class TeacherPrayerViewModel : ViewModel() {
    private val teacherRepository = TeacherRepository()
    private val studentRepository = StudentRepository()
    private val prayerRef = FirebaseDatabase.getInstance().getReference("prayer_attendance")

    private val _teacher = MutableStateFlow<Teacher?>(null)
    val teacher: StateFlow<Teacher?> = _teacher.asStateFlow()

    private val _students = MutableStateFlow<List<Student>>(emptyList())
    private val _logs = MutableStateFlow<List<PrayerLog>>(emptyList())
    private val _prayerItems = MutableStateFlow<List<TeacherPrayerItem>>(emptyList())
    val prayerItems: StateFlow<List<TeacherPrayerItem>> = _prayerItems.asStateFlow()

    private val _stats = MutableStateFlow(TeacherPrayerStats())
    val stats: StateFlow<TeacherPrayerStats> = _stats.asStateFlow()

    private val _selectedDate = MutableStateFlow(System.currentTimeMillis())
    val selectedDate: StateFlow<Long> = _selectedDate.asStateFlow()

    private val _selectedMonth = MutableStateFlow(Calendar.getInstance().get(Calendar.MONTH))
    val selectedMonth: StateFlow<Int> = _selectedMonth.asStateFlow()

    private val _selectedYear = MutableStateFlow(Calendar.getInstance().get(Calendar.YEAR))
    val selectedYear: StateFlow<Int> = _selectedYear.asStateFlow()

    private val _monthlyRecap = MutableStateFlow<Map<String, TeacherPrayerMonthlyStats>>(emptyMap())
    val monthlyRecap: StateFlow<Map<String, TeacherPrayerMonthlyStats>> = _monthlyRecap.asStateFlow()
    private val _prayerSchedules = MutableStateFlow<Map<Int, DayScheduleRule>>(emptyMap())
    private val _holidays = MutableStateFlow<List<HolidayRule>>(emptyList())

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isSubmitting = MutableStateFlow(false)
    val isSubmitting: StateFlow<Boolean> = _isSubmitting.asStateFlow()

    private var prayerListener: ValueEventListener? = null
    private var legacyPrayerScheduleListener: ValueEventListener? = null
    private var scopedPrayerScheduleListener: ValueEventListener? = null
    private var legacyHolidayListener: ValueEventListener? = null
    private var scopedHolidayListener: ValueEventListener? = null
    private var currentScopeKey: String = ""

    init {
        observePrayerLogs()

        val filteredStudentsFlow = combine(_teacher, _students, _searchQuery) { teacher, students, query ->
            filterStudents(teacher, students, query)
        }

        viewModelScope.launch {
            combine(filteredStudentsFlow, _logs, _selectedDate, _prayerSchedules, _holidays) { filteredStudents, logs, selectedDate, schedules, holidays ->
                val (startOfDay, endOfDay) = getDayRange(selectedDate)
                val targetDay = Calendar.getInstance().apply {
                    timeInMillis = selectedDate
                    set(Calendar.HOUR_OF_DAY, 0)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }
                val isValidDay = isValidPrayerDay(targetDay, schedules, holidays)

                filteredStudents.map { student ->
                    val todayLog = logs
                        .filter { log ->
                            matchesStudent(log, student) && log.date in startOfDay..endOfDay
                        }
                        .maxByOrNull { it.date }

                    TeacherPrayerItem(
                        student = student,
                        status = if (isValidDay) toPrayerLabel(todayLog?.status) else "Hari Nonaktif",
                        submittedAt = todayLog?.date
                    )
                }
            }.collect { items ->
                _prayerItems.value = items
                _stats.value = TeacherPrayerStats(
                    prayCount = items.count { it.status == "Sudah Presensi" },
                    notYetCount = items.count { it.status == "Belum Presensi" }
                )
                _isLoading.value = false
            }
        }

        viewModelScope.launch {
            val monthlyRuleFlow = combine(_selectedMonth, _selectedYear, _prayerSchedules, _holidays) { month, year, schedules, holidays ->
                MonthlyPrayerRuleContext(month, year, schedules, holidays)
            }

            combine(filteredStudentsFlow, _logs, monthlyRuleFlow) { filteredStudents, logs, ruleContext ->
                buildMonthlyRecap(
                    filteredStudents,
                    logs,
                    ruleContext.month,
                    ruleContext.year,
                    ruleContext.schedules,
                    ruleContext.holidays
                )
            }.collect { recap ->
                _monthlyRecap.value = recap
            }
        }
    }

    fun setTeacherNuptk(nuptk: String) {
        viewModelScope.launch {
            teacherRepository.getTeacherByNuptk(nuptk).collect { teacher ->
                _teacher.value = teacher
                val schoolScope = normalizeScope(teacher?.schoolId)
                attachRuleListeners(schoolScope)
                loadStudents(schoolScope)
            }
        }
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
    }

    fun setMonth(month: Int) {
        _selectedMonth.value = month
    }

    fun setYear(year: Int) {
        _selectedYear.value = year
    }

    fun setSelectedDate(date: Long) {
        _selectedDate.value = date
    }

    fun submitManualPrayer(
        selectedItems: List<ManualPrayerSubmission>,
        selectedDate: Long,
        onComplete: (ManualPrayerResult) -> Unit
    ) {
        if (selectedItems.isEmpty()) {
            onComplete(ManualPrayerResult(false, "Pilih siswa yang akan dicatat manual."))
            return
        }

        _isSubmitting.value = true
        val now = System.currentTimeMillis()
        val storedDate = createStoredTimestampForSelectedDate(selectedDate, now)
        val updates = mutableMapOf<String, Any?>()

        selectedItems.forEach { selection ->
            val item = selection.item
            val key = prayerRef.push().key ?: return@forEach
            val schoolId = normalizeScope(item.student.schoolId)
            val resolvedStudentId = preferredStudentIdentity(item.student)
            val payload = mapOf(
                "schoolId" to schoolId,
                "studentId" to resolvedStudentId,
                "nisn" to normalizeIdentity(item.student.nisn),
                "studentName" to item.student.name,
                "date" to storedDate,
                "status" to selection.status,
                "recordedBy" to "TEACHER_MANUAL",
                "createdAt" to now,
                "updatedAt" to now
            )
            payload.forEach { (field, value) ->
                updates["$key/$field"] = value
            }
        }

        if (updates.isEmpty()) {
            _isSubmitting.value = false
            onComplete(ManualPrayerResult(false, "Tidak ada data yang bisa disimpan."))
            return
        }

        prayerRef.updateChildren(updates)
            .addOnSuccessListener {
                _isSubmitting.value = false
                onComplete(ManualPrayerResult(true, "Presensi sholat manual berhasil disimpan."))
            }
            .addOnFailureListener { error ->
                _isSubmitting.value = false
                onComplete(ManualPrayerResult(false, "Gagal menyimpan presensi manual: ${error.message}"))
            }
    }

    private fun loadStudents(schoolId: String = "") {
        viewModelScope.launch {
            studentRepository.getStudents(schoolId).collect { students ->
                _students.value = students
            }
        }
    }

    private fun observePrayerLogs() {
        prayerListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val logs = mutableListOf<PrayerLog>()
                for (child in snapshot.children) {
                    val studentId = child.child("studentId").getValue(String::class.java) ?: ""
                    val nisn = child.child("nisn").getValue(String::class.java) ?: ""
                    val date = child.child("date").getValue(Long::class.java)
                        ?: child.child("createdAt").getValue(Long::class.java)
                        ?: 0L
                    val status = child.child("status").getValue(String::class.java) ?: ""
                    logs.add(
                        PrayerLog(
                            studentId = studentId,
                            nisn = nisn,
                            date = date,
                            status = status
                        )
                    )
                }
                _logs.value = logs
            }

            override fun onCancelled(error: DatabaseError) {
                _isLoading.value = false
            }
        }

        prayerRef.addValueEventListener(prayerListener as ValueEventListener)
    }

    override fun onCleared() {
        super.onCleared()
        prayerListener?.let { prayerRef.removeEventListener(it) }
        detachRuleListeners()
    }

    private fun attachRuleListeners(scopeKey: String) {
        if (currentScopeKey == scopeKey && (legacyPrayerScheduleListener != null || scopedPrayerScheduleListener != null)) {
            return
        }

        detachRuleListeners()
        currentScopeKey = scopeKey

        legacyPrayerScheduleListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                if (_prayerSchedules.value.isEmpty() || scopedPrayerScheduleListener == null) {
                    _prayerSchedules.value = parseScheduleSnapshot(snapshot)
                }
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        FirebaseDatabase.getInstance().getReference("prayer_schedules")
            .addValueEventListener(legacyPrayerScheduleListener as ValueEventListener)

        legacyHolidayListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                if (_holidays.value.isEmpty() || scopedHolidayListener == null) {
                    _holidays.value = parseHolidaySnapshot(snapshot)
                }
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        FirebaseDatabase.getInstance().getReference("holidays")
            .addValueEventListener(legacyHolidayListener as ValueEventListener)

        if (scopeKey.isBlank()) return

        scopedPrayerScheduleListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                _prayerSchedules.value = if (snapshot.exists()) parseScheduleSnapshot(snapshot) else emptyMap()
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        FirebaseDatabase.getInstance().getReference("school_settings")
            .child(scopeKey)
            .child("prayer")
            .child("schedules")
            .addValueEventListener(scopedPrayerScheduleListener as ValueEventListener)

        scopedHolidayListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                _holidays.value = if (snapshot.exists()) parseHolidaySnapshot(snapshot) else emptyList()
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        FirebaseDatabase.getInstance().getReference("school_settings")
            .child(scopeKey)
            .child("attendance")
            .child("holidays")
            .addValueEventListener(scopedHolidayListener as ValueEventListener)
    }

    private fun detachRuleListeners() {
        legacyPrayerScheduleListener?.let {
            FirebaseDatabase.getInstance().getReference("prayer_schedules").removeEventListener(it)
        }
        scopedPrayerScheduleListener?.let {
            if (currentScopeKey.isNotBlank()) {
                FirebaseDatabase.getInstance().getReference("school_settings")
                    .child(currentScopeKey)
                    .child("prayer")
                    .child("schedules")
                    .removeEventListener(it)
            }
        }
        legacyHolidayListener?.let {
            FirebaseDatabase.getInstance().getReference("holidays").removeEventListener(it)
        }
        scopedHolidayListener?.let {
            if (currentScopeKey.isNotBlank()) {
                FirebaseDatabase.getInstance().getReference("school_settings")
                    .child(currentScopeKey)
                    .child("attendance")
                    .child("holidays")
                    .removeEventListener(it)
            }
        }
        legacyPrayerScheduleListener = null
        scopedPrayerScheduleListener = null
        legacyHolidayListener = null
        scopedHolidayListener = null
        currentScopeKey = ""
    }

    private fun normalizeClassName(value: String): String {
        return value
            .uppercase()
            .replace("KELAS", "")
            .replace(" ", "")
            .trim()
    }

    private fun filterStudents(
        teacher: Teacher?,
        students: List<Student>,
        query: String
    ): List<Student> {
        val className = normalizeClassName(teacher?.homeroomClass.orEmpty())
        if (className.isBlank()) return emptyList()

        return students
            .filter { normalizeClassName(it.className) == className }
            .filter {
                query.isBlank() ||
                    it.name.contains(query, ignoreCase = true) ||
                    it.nisn.contains(query, ignoreCase = true) ||
                    it.id.contains(query, ignoreCase = true)
            }
            .sortedBy { it.name }
    }

    private fun getDayRange(targetTimeInMillis: Long): Pair<Long, Long> {
        val startOfDay = Calendar.getInstance().apply {
            timeInMillis = targetTimeInMillis
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
        val endOfDay = Calendar.getInstance().apply {
            timeInMillis = targetTimeInMillis
            set(Calendar.HOUR_OF_DAY, 23)
            set(Calendar.MINUTE, 59)
            set(Calendar.SECOND, 59)
            set(Calendar.MILLISECOND, 999)
        }.timeInMillis
        return startOfDay to endOfDay
    }

    private fun createStoredTimestampForSelectedDate(selectedDate: Long, fallbackNow: Long): Long {
        val selectedCalendar = Calendar.getInstance().apply { timeInMillis = selectedDate }
        val nowCalendar = Calendar.getInstance().apply { timeInMillis = fallbackNow }
        selectedCalendar.set(Calendar.HOUR_OF_DAY, nowCalendar.get(Calendar.HOUR_OF_DAY))
        selectedCalendar.set(Calendar.MINUTE, nowCalendar.get(Calendar.MINUTE))
        selectedCalendar.set(Calendar.SECOND, nowCalendar.get(Calendar.SECOND))
        selectedCalendar.set(Calendar.MILLISECOND, nowCalendar.get(Calendar.MILLISECOND))
        return selectedCalendar.timeInMillis
    }

    private fun matchesStudent(log: PrayerLog, student: Student): Boolean {
        val logCandidates = linkedSetOf(
            normalizeIdentity(log.studentId),
            normalizeIdentity(log.nisn)
        ).filter { it.isNotBlank() }
        if (logCandidates.isEmpty()) return false

        return studentIdentityCandidates(student).any { candidate ->
            logCandidates.contains(candidate)
        }
    }

    private fun toPrayerLabel(status: String?): String {
        return when (status?.uppercase()) {
            "PRAY" -> "Sudah Presensi"
            "PERMIT" -> "Izin"
            "HALANGAN" -> "Halangan"
            "NOT_PRAY" -> "Tidak Sholat"
            else -> "Belum Presensi"
        }
    }

    private fun buildMonthlyRecap(
        students: List<Student>,
        logs: List<PrayerLog>,
        month: Int,
        year: Int,
        schedules: Map<Int, DayScheduleRule>,
        holidays: List<HolidayRule>
    ): Map<String, TeacherPrayerMonthlyStats> {
        if (students.isEmpty()) return emptyMap()

        val result = linkedMapOf<String, TeacherPrayerMonthlyStats>()
        val today = Calendar.getInstance()
        val isCurrentMonth = today.get(Calendar.YEAR) == year && today.get(Calendar.MONTH) == month
        val lastDay = if (isCurrentMonth) {
            today.get(Calendar.DAY_OF_MONTH)
        } else {
            Calendar.getInstance().apply {
                set(Calendar.YEAR, year)
                set(Calendar.MONTH, month)
                set(Calendar.DAY_OF_MONTH, 1)
            }.getActualMaximum(Calendar.DAY_OF_MONTH)
        }

        students.forEach { student ->
            var prayCount = 0
            var notPrayCount = 0
            var permitCount = 0
            var halanganCount = 0

            for (day in 1..lastDay) {
                val start = Calendar.getInstance().apply {
                    set(Calendar.YEAR, year)
                    set(Calendar.MONTH, month)
                    set(Calendar.DAY_OF_MONTH, day)
                    set(Calendar.HOUR_OF_DAY, 0)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }

                if (!isValidPrayerDay(start, schedules, holidays)) {
                    continue
                }

                val end = (start.clone() as Calendar).apply {
                    set(Calendar.HOUR_OF_DAY, 23)
                    set(Calendar.MINUTE, 59)
                    set(Calendar.SECOND, 59)
                    set(Calendar.MILLISECOND, 999)
                }

                val dayLog = logs
                    .filter { log -> matchesStudent(log, student) && log.date in start.timeInMillis..end.timeInMillis }
                    .maxByOrNull { it.date }

                when (dayLog?.status?.uppercase()) {
                    "PRAY" -> prayCount += 1
                    "PERMIT" -> permitCount += 1
                    "HALANGAN" -> halanganCount += 1
                    else -> notPrayCount += 1
                }
            }

            result[studentIdentityKey(student)] = TeacherPrayerMonthlyStats(
                prayCount = prayCount,
                notPrayCount = notPrayCount,
                permitCount = permitCount,
                halanganCount = halanganCount
            )
        }

        return result
    }

    private fun normalizeIdentity(value: String?): String {
        return value?.trim().orEmpty()
    }

    private fun studentIdentityCandidates(student: Student): List<String> {
        return listOf(
            normalizeIdentity(student.id),
            normalizeIdentity(student.nisn)
        ).filter { it.isNotBlank() }.distinct()
    }

    private fun preferredStudentIdentity(student: Student): String {
        return studentIdentityCandidates(student).firstOrNull().orEmpty()
    }

    private fun studentIdentityKey(student: Student): String {
        return preferredStudentIdentity(student)
    }
}

