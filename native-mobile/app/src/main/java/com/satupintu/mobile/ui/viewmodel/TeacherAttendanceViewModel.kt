package com.satupintu.mobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.satupintu.mobile.data.model.Attendance
import com.satupintu.mobile.data.model.Student
import com.satupintu.mobile.data.model.Teacher
import com.satupintu.mobile.data.repository.AttendanceRepository
import com.satupintu.mobile.data.repository.StudentRepository
import com.satupintu.mobile.data.repository.TeacherRepository
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.satupintu.mobile.util.DayScheduleRule
import com.satupintu.mobile.util.HolidayRule
import com.satupintu.mobile.util.isValidSchoolDay
import com.satupintu.mobile.util.normalizeScope
import com.satupintu.mobile.util.parseHolidaySnapshot
import com.satupintu.mobile.util.parseScheduleSnapshot
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.launch
import java.util.*

data class StudentAttendanceItem(
    val student: Student,
    val status: String, // PRESENT, SICK, PERMIT, ALPHA, or UNMARKED
    val notes: String? = null,
    val attendanceId: String? = null // Added to track existing record ID
)

class TeacherAttendanceViewModel : ViewModel() {
    private val studentRepository = StudentRepository()
    private val attendanceRepository = AttendanceRepository()
    private val teacherRepository = TeacherRepository()

    private val _teacher = MutableStateFlow<Teacher?>(null)
    val teacher: StateFlow<Teacher?> = _teacher.asStateFlow()

    private val _attendanceList = MutableStateFlow<List<StudentAttendanceItem>>(emptyList())
    val attendanceList: StateFlow<List<StudentAttendanceItem>> = _attendanceList.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _selectedDate = MutableStateFlow(System.currentTimeMillis())
    val selectedDate: StateFlow<Long> = _selectedDate.asStateFlow()

    // Statistics
    val attendanceStats: StateFlow<Map<String, Int>> = _attendanceList.map { list ->
        mapOf(
            "PRESENT" to list.count { it.status == "PRESENT" },
            "SICK" to list.count { it.status == "SICK" },
            "PERMIT" to list.count { it.status == "PERMIT" },
            "ABSENT" to list.count { it.status == "ABSENT" },
            "TOTAL" to list.size
        )
    }.stateIn(viewModelScope, SharingStarted.Lazily, emptyMap())

    // Monthly Recap
    private val _selectedMonth = MutableStateFlow(Calendar.getInstance().get(Calendar.MONTH))
    val selectedMonth: StateFlow<Int> = _selectedMonth.asStateFlow()

    private val _selectedYear = MutableStateFlow(Calendar.getInstance().get(Calendar.YEAR))
    val selectedYear: StateFlow<Int> = _selectedYear.asStateFlow()

    private val _monthlyRecap = MutableStateFlow<Map<String, Map<String, Int>>>(emptyMap())
    val monthlyRecap: StateFlow<Map<String, Map<String, Int>>> = _monthlyRecap.asStateFlow()
    private val _schedules = MutableStateFlow<Map<Int, DayScheduleRule>>(emptyMap())
    private val _holidays = MutableStateFlow<List<HolidayRule>>(emptyList())

    private var legacyScheduleListener: ValueEventListener? = null
    private var scopedScheduleListener: ValueEventListener? = null
    private var legacyHolidayListener: ValueEventListener? = null
    private var scopedHolidayListener: ValueEventListener? = null
    private var currentScopeKey: String = ""

    fun setMonth(month: Int) {
        _selectedMonth.value = month
        loadMonthlyRecap()
    }

    fun setYear(year: Int) {
        _selectedYear.value = year
        loadMonthlyRecap()
    }

    private fun loadMonthlyRecap() {
        viewModelScope.launch {
            val month = _selectedMonth.value
            val year = _selectedYear.value
            
            val teacherSchoolScope = normalizeScope(_teacher.value?.schoolId)
            val studentsFlow = studentRepository.getStudents(teacherSchoolScope)
            val monthlyAttendanceFlow = attendanceRepository.getAttendanceByMonth(month, year, teacherSchoolScope)

            combine(studentsFlow, monthlyAttendanceFlow, _schedules, _holidays) { students, records, schedules, holidays ->
                val targetClass = _teacher.value?.homeroomClass ?: ""
                val classStudents = students.filter {
                    it.className == targetClass &&
                        (teacherSchoolScope.isBlank() || normalizeScope(it.schoolId) == teacherSchoolScope)
                }

                val calendar = Calendar.getInstance()
                calendar.set(Calendar.YEAR, year)
                calendar.set(Calendar.MONTH, month)
                calendar.set(Calendar.DAY_OF_MONTH, 1)
                val daysInMonth = calendar.getActualMaximum(Calendar.DAY_OF_MONTH)
                val today = Calendar.getInstance()

                val recapMap = mutableMapOf<String, Map<String, Int>>()
                
                classStudents.forEach { student ->
                    val studentRecords = records.filter { attendance ->
                        matchesStudent(attendance, student) && matchesAttendanceScope(attendance, teacherSchoolScope)
                    }
                    var h = 0
                    var s = 0
                    var i = 0
                    var a = 0

                    // Iterasi setiap hari dalam bulan (sama dengan web)
                    for (day in 1..daysInMonth) {
                        calendar.set(Calendar.DAY_OF_MONTH, day)
                        calendar.set(Calendar.HOUR_OF_DAY, 0)
                        calendar.set(Calendar.MINUTE, 0)
                        calendar.set(Calendar.SECOND, 0)
                        calendar.set(Calendar.MILLISECOND, 0)

                        if (!isValidSchoolDay(calendar, schedules, holidays)) continue

                        // Cari record absen untuk hari ini
                        val log = studentRecords.find {
                            val logCalendar = Calendar.getInstance()
                            logCalendar.timeInMillis = it.date
                            logCalendar.get(Calendar.YEAR) == year &&
                            logCalendar.get(Calendar.MONTH) == month &&
                            logCalendar.get(Calendar.DAY_OF_MONTH) == day
                        }

                        if (log != null) {
                            when (log.status) {
                                "PRESENT", "LATE" -> h++ // LATE dihitung sebagai Hadir (sama dengan web)
                                "SICK" -> s++
                                "PERMIT" -> i++
                                "ABSENT" -> a++
                            }
                        } else {
                            // Tidak ada record = Alpha (sama dengan web)
                            a++
                        }
                    }

                    val stats = mapOf(
                        "PRESENT" to h,
                        "SICK" to s,
                        "PERMIT" to i,
                        "ABSENT" to a
                    )
                    recapMap[preferredStudentIdentity(student)] = stats
                }
                recapMap
            }.collect {
                _monthlyRecap.value = it
            }
        }
    }

    fun setTeacherNuptk(nuptk: String) {
        viewModelScope.launch {
            teacherRepository.getTeacherByNuptk(nuptk).collect { teacher ->
                _teacher.value = teacher
                attachRuleListeners(normalizeScope(teacher?.schoolId))
                loadDataForDate(_selectedDate.value)
                loadMonthlyRecap()
            }
        }
    }

    init {
        // Observe selectedDate changes and reload data
        viewModelScope.launch {
            _selectedDate.collect { date ->
                loadDataForDate(date)
            }
        }
    }

    private fun attachRuleListeners(scopeKey: String) {
        if (currentScopeKey == scopeKey && (legacyScheduleListener != null || scopedScheduleListener != null)) {
            return
        }

        detachRuleListeners()
        currentScopeKey = scopeKey

        legacyScheduleListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                if (_schedules.value.isEmpty() || scopedScheduleListener == null) {
                    _schedules.value = parseScheduleSnapshot(snapshot)
                }
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        FirebaseDatabase.getInstance().getReference("schedules")
            .addValueEventListener(legacyScheduleListener as ValueEventListener)

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

        scopedScheduleListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                _schedules.value = if (snapshot.exists()) parseScheduleSnapshot(snapshot) else emptyMap()
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        FirebaseDatabase.getInstance().getReference("school_settings")
            .child(scopeKey)
            .child("attendance")
            .child("schedules")
            .addValueEventListener(scopedScheduleListener as ValueEventListener)

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
        legacyScheduleListener?.let {
            FirebaseDatabase.getInstance().getReference("schedules").removeEventListener(it)
        }
        scopedScheduleListener?.let {
            if (currentScopeKey.isNotBlank()) {
                FirebaseDatabase.getInstance().getReference("school_settings")
                    .child(currentScopeKey)
                    .child("attendance")
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

        legacyScheduleListener = null
        scopedScheduleListener = null
        legacyHolidayListener = null
        scopedHolidayListener = null
        currentScopeKey = ""
    }

    private fun loadDataForDate(date: Long) {
        viewModelScope.launch {
            val teacherSchoolScope = normalizeScope(_teacher.value?.schoolId)
            val studentsFlow = studentRepository.getStudents(teacherSchoolScope)
            val attendanceFlow = attendanceRepository.getAttendanceByDate(date, teacherSchoolScope)

            combine(studentsFlow, attendanceFlow) { students, attendances ->
                val targetClass = _teacher.value?.homeroomClass ?: ""
                students
                    .filter {
                        it.className == targetClass &&
                            (teacherSchoolScope.isBlank() || normalizeScope(it.schoolId) == teacherSchoolScope)
                    }
                    .map { student ->
                    // Find attendance record for this student
                    val record = attendances.find { attendance ->
                        matchesStudent(attendance, student) && matchesAttendanceScope(attendance, teacherSchoolScope)
                    }
                    StudentAttendanceItem(
                        student = student,
                        status = record?.status ?: "UNMARKED",
                        notes = record?.notes,
                        attendanceId = record?.id
                    )
                }
            }.collect { items ->
                _attendanceList.value = items
                _isLoading.value = false
            }
        }
    }

    fun setDate(date: Long) {
        _selectedDate.value = date
        _isLoading.value = true
    }

    fun updateNote(studentId: String, note: String) {
        val currentItem = _attendanceList.value.find { preferredStudentIdentity(it.student) == studentId } ?: return
        
        // Optimistic update
        val updatedList = _attendanceList.value.map {
            if (preferredStudentIdentity(it.student) == studentId) it.copy(notes = note) else it
        }
        _attendanceList.value = updatedList
        
        // Save to repo
        val resolvedStudentId = preferredStudentIdentity(currentItem.student)
        val newRecord = Attendance(
            id = currentItem.attendanceId ?: "", 
            studentId = resolvedStudentId,
            schoolId = currentItem.student.schoolId,
            date = _selectedDate.value,
            status = currentItem.status, // Keep existing status
            checkInTime = System.currentTimeMillis().toString(),
            notes = note
        )
        attendanceRepository.saveAttendance(newRecord) { success ->
            // If new record created, we might want to reload to get the new ID, 
            // but for now relying on optimistic UI and eventual consistency is okay.
            // Ideally, saveAttendance should return the ID.
            if (success && currentItem.attendanceId.isNullOrEmpty()) {
                // Force reload to get the new ID if it was a new record
                loadDataForDate(_selectedDate.value)
            }
        }
    }

    fun markAllPresent() {
        val currentList = _attendanceList.value
        val updatedList = currentList.map { it.copy(status = "PRESENT") }
        _attendanceList.value = updatedList // Optimistic update

        // Save all to repo
        // Note: In a real app, you might want to batch this or use a specific API endpoint
        // For Firebase RTDB, we can just loop and save for now (or construct a multi-path update)
        currentList.forEach { item ->
            val newRecord = Attendance(
                id = "",
                studentId = preferredStudentIdentity(item.student),
                schoolId = item.student.schoolId,
                date = _selectedDate.value,
                status = "PRESENT",
                checkInTime = System.currentTimeMillis().toString(),
                notes = item.notes
            )
            attendanceRepository.saveAttendance(newRecord) { }
        }
    }

    fun updateAttendance(studentId: String, status: String) {
        val currentItem = _attendanceList.value.find { preferredStudentIdentity(it.student) == studentId } ?: return
        val resolvedStudentId = preferredStudentIdentity(currentItem.student)
        
        val newRecord = Attendance(
            id = currentItem.attendanceId ?: "",
            studentId = resolvedStudentId,
            schoolId = currentItem.student.schoolId,
            date = _selectedDate.value,
            status = status,
            checkInTime = System.currentTimeMillis().toString(),
            notes = currentItem.notes
        )
        
        // Optimistic update
        val updatedList = _attendanceList.value.map {
            if (preferredStudentIdentity(it.student) == studentId) it.copy(status = status) else it
        }
        _attendanceList.value = updatedList

        attendanceRepository.saveAttendance(newRecord) { success ->
            if (!success) {
                // Revert if failed (optional, usually RTDB is reliable offline)
            } else if (currentItem.attendanceId.isNullOrEmpty()) {
                 // Force reload to get the new ID if it was a new record
                 loadDataForDate(_selectedDate.value)
            }
        }
    }

    fun saveAttendanceSelections(
        selections: Map<String, String>,
        onComplete: (Boolean) -> Unit
    ) {
        if (selections.isEmpty()) {
            onComplete(true)
            return
        }

        val currentItems = _attendanceList.value.associateBy { preferredStudentIdentity(it.student) }
        var remaining = selections.size
        var allSuccess = true

        fun finishOne(success: Boolean) {
            if (!success) allSuccess = false
            remaining -= 1
            if (remaining == 0) {
                loadDataForDate(_selectedDate.value)
                onComplete(allSuccess)
            }
        }

        selections.forEach { (studentId, status) ->
            val currentItem = currentItems[studentId]
            if (currentItem == null) {
                finishOne(false)
                return@forEach
            }

            if (status == "UNMARKED") {
                val attendanceId = currentItem.attendanceId
                if (attendanceId.isNullOrBlank()) {
                    finishOne(true)
                } else {
                    attendanceRepository.deleteAttendance(attendanceId, currentItem.student.schoolId) { success ->
                        finishOne(success)
                    }
                }
                return@forEach
            }

            val newRecord = Attendance(
                id = currentItem.attendanceId ?: "",
                studentId = preferredStudentIdentity(currentItem.student),
                schoolId = currentItem.student.schoolId,
                date = _selectedDate.value,
                status = status,
                checkInTime = System.currentTimeMillis().toString(),
                notes = currentItem.notes
            )

            attendanceRepository.saveAttendance(newRecord) { success ->
                finishOne(success)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        detachRuleListeners()
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

    private fun matchesStudent(attendance: Attendance, student: Student): Boolean {
        val attendanceId = normalizeIdentity(attendance.studentId)
        if (attendanceId.isBlank()) return false
        return studentIdentityCandidates(student).contains(attendanceId)
    }

    private fun matchesAttendanceScope(attendance: Attendance, scopeKey: String): Boolean {
        if (scopeKey.isBlank()) return true
        val attendanceScope = normalizeScope(attendance.schoolId)
        return attendanceScope.isBlank() || attendanceScope == scopeKey
    }
}

