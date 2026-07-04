package com.satupintu.mobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.Query
import com.google.firebase.database.ValueEventListener
import com.satupintu.mobile.util.DayScheduleRule
import com.satupintu.mobile.util.HolidayRule
import com.satupintu.mobile.util.isValidPrayerDay
import com.satupintu.mobile.util.isValidSchoolDay
import com.satupintu.mobile.util.parseHolidaySnapshot
import com.satupintu.mobile.util.parseScheduleSnapshot
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.LinkedHashMap
import java.util.Locale
import kotlin.math.roundToInt

data class PrincipalAttendanceSummary(
    val totalStudents: Int = 0,
    val hadir: Int = 0,
    val sakit: Int = 0,
    val izin: Int = 0,
    val alpha: Int = 0,
    val terlambat: Int = 0,
    val validSchoolDays: Int = 0,
    val effectiveObligation: Int = 0
) {
    val attendanceRate: Float
        get() = if (effectiveObligation > 0) hadir.toFloat() / effectiveObligation.toFloat() else if (totalStudents == 0) 0f else hadir.toFloat() / totalStudents.toFloat()
}

data class PrincipalLiteracySummary(
    val activeTasks: Int = 0,
    val reportsThisWeek: Int = 0,
    val reportsThisMonth: Int = 0,
    val reviewedReports: Int = 0,
    val pendingReports: Int = 0,
    val studentsSubmittedThisMonth: Int = 0,
    val totalStudents: Int = 0,
    val totalVisitDays: Int = 0,
    val totalBorrows: Int = 0,
    val totalTasksDone: Int = 0,
    val averageScore: Int = 0,
    val veryActiveCount: Int = 0,
    val activeCount: Int = 0,
    val enoughActiveCount: Int = 0,
    val needsSupportCount: Int = 0,
    val inactiveCount: Int = 0
) {
    val participationRate: Float
        get() = if (totalStudents == 0) 0f else studentsSubmittedThisMonth.toFloat() / totalStudents.toFloat()
}

data class PrincipalPrayerSummary(
    val totalStudents: Int = 0,
    val pray: Int = 0,
    val permit: Int = 0,
    val halangan: Int = 0,
    val notPray: Int = 0,
    val validPrayerDays: Int = 0,
    val effectiveObligation: Int = 0
) {
    val prayerRate: Float
        get() = if (effectiveObligation > 0) pray.toFloat() / effectiveObligation.toFloat() else if (totalStudents == 0) 0f else pray.toFloat() / totalStudents.toFloat()
}

data class PrincipalDisciplineSummary(
    val violationsThisWeek: Int = 0,
    val violationsThisMonth: Int = 0,
    val openFollowUps: Int = 0,
    val studentsFlagged: Int = 0,
    val totalPointsThisMonth: Int = 0
) {
    val resolutionRate: Float
        get() = if (violationsThisMonth == 0) 1f else (violationsThisMonth - openFollowUps).toFloat() / violationsThisMonth.toFloat()
}

data class PrincipalBullyingSummary(
    val reportsThisMonth: Int = 0,
    val activeReports: Int = 0,
    val resolvedReports: Int = 0,
    val highPriorityReports: Int = 0
) {
    val resolutionRate: Float
        get() = if (reportsThisMonth == 0) 1f else resolvedReports.toFloat() / reportsThisMonth.toFloat()
}

data class PrincipalClassSummary(
    val className: String,
    val totalStudents: Int,
    val attendanceRate: Float,
    val prayerRate: Float,
    val literacyRate: Float
)

data class PrincipalAttentionStudent(
    val nisn: String,
    val name: String,
    val className: String,
    val reasons: List<String>,
    val score: Int,
    val categories: Set<String>
)

data class PrincipalRecentActivity(
    val title: String,
    val subtitle: String,
    val timestampLabel: String
)

data class PrincipalRecentIssue(
    val title: String,
    val subtitle: String,
    val badge: String,
    val kind: String,
    val timestamp: Long,
    val timestampLabel: String
)

data class PrincipalDashboardUiState(
    val principalName: String = "",
    val schoolId: String = "",
    val schoolName: String = "",
    val isLoading: Boolean = true,
    val attendanceRecapMonth: Int = Calendar.getInstance().get(Calendar.MONTH) + 1,
    val attendanceRecapYear: Int = Calendar.getInstance().get(Calendar.YEAR),
    val prayerRecapMonth: Int = Calendar.getInstance().get(Calendar.MONTH) + 1,
    val prayerRecapYear: Int = Calendar.getInstance().get(Calendar.YEAR),
    val attendance: PrincipalAttendanceSummary = PrincipalAttendanceSummary(),
    val attendanceRecap: PrincipalAttendanceSummary = PrincipalAttendanceSummary(),
    val literacy: PrincipalLiteracySummary = PrincipalLiteracySummary(),
    val prayer: PrincipalPrayerSummary = PrincipalPrayerSummary(),
    val prayerRecap: PrincipalPrayerSummary = PrincipalPrayerSummary(),
    val discipline: PrincipalDisciplineSummary = PrincipalDisciplineSummary(),
    val bullying: PrincipalBullyingSummary = PrincipalBullyingSummary(),
    val classSummaries: List<PrincipalClassSummary> = emptyList(),
    val attendanceRecapClassSummaries: List<PrincipalClassSummary> = emptyList(),
    val prayerRecapClassSummaries: List<PrincipalClassSummary> = emptyList(),
    val attentionStudents: List<PrincipalAttentionStudent> = emptyList(),
    val recentIssues: List<PrincipalRecentIssue> = emptyList(),
    val recentActivities: List<PrincipalRecentActivity> = emptyList(),
    val lastUpdatedLabel: String = "-"
)

private data class PrincipalStudentRecord(
    val id: String,
    val nisn: String,
    val name: String,
    val className: String,
    val schoolId: String
)

private data class PrincipalAttendanceRecord(
    val studentId: String,
    val date: Long,
    val status: String,
    val schoolId: String,
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L
)

private data class PrincipalPrayerRecord(
    val studentId: String,
    val date: Long,
    val status: String,
    val schoolId: String
)

private data class PrincipalLiteracyRecord(
    val studentId: String,
    val studentName: String,
    val taskId: String,
    val taskTitle: String,
    val bookTitle: String,
    val summary: String,
    val status: String,
    val timestamp: Long,
    val schoolId: String
)

private data class PrincipalLiteracyReportRecord(
    val studentId: String,
    val taskId: String,
    val taskTitle: String,
    val bookTitle: String,
    val summary: String,
    val status: String,
    val timestamp: Long,
    val schoolId: String
)

private data class PrincipalBorrowRecord(
    val studentId: String,
    val borrowDate: Long,
    val returnDate: Long,
    val schoolId: String
)

private data class PrincipalTaskRecord(
    val title: String,
    val isActive: Boolean,
    val schoolId: String
)

private data class PrincipalDisciplineRecord(
    val id: String,
    val studentId: String,
    val studentName: String,
    val className: String,
    val ruleName: String,
    val date: Long,
    val points: Int,
    val followUpStatus: String,
    val status: String,
    val schoolId: String
)

private data class PrincipalBullyingRecord(
    val id: String,
    val reporterId: String,
    val reporterName: String,
    val victimId: String,
    val victimName: String,
    val perpetratorId: String,
    val perpetratorName: String,
    val category: String,
    val incidentType: String,
    val priority: String,
    val status: String,
    val createdAt: Long,
    val schoolId: String
)

class PrincipalDashboardViewModel : ViewModel() {
    private val db = FirebaseDatabase.getInstance().reference

    private val _session = MutableStateFlow(PrincipalDashboardUiState())
    private val _attendanceRecapMonth = MutableStateFlow(Calendar.getInstance().get(Calendar.MONTH) + 1)
    private val _attendanceRecapYear = MutableStateFlow(Calendar.getInstance().get(Calendar.YEAR))
    private val _prayerRecapMonth = MutableStateFlow(Calendar.getInstance().get(Calendar.MONTH) + 1)
    private val _prayerRecapYear = MutableStateFlow(Calendar.getInstance().get(Calendar.YEAR))
    private val _students = MutableStateFlow<List<PrincipalStudentRecord>>(emptyList())
    private val _attendanceLogsScoped = MutableStateFlow<List<PrincipalAttendanceRecord>>(emptyList())
    private val _attendanceLogsTodayFallback = MutableStateFlow<List<PrincipalAttendanceRecord>>(emptyList())
    private val _prayerLogs = MutableStateFlow<List<PrincipalPrayerRecord>>(emptyList())
    private val _literacyLogs = MutableStateFlow<List<PrincipalLiteracyRecord>>(emptyList())
    private val _literacyReports = MutableStateFlow<List<PrincipalLiteracyReportRecord>>(emptyList())
    private val _borrowRecords = MutableStateFlow<List<PrincipalBorrowRecord>>(emptyList())
    private val _tasks = MutableStateFlow<List<PrincipalTaskRecord>>(emptyList())
    private val _disciplineRecords = MutableStateFlow<List<PrincipalDisciplineRecord>>(emptyList())
    private val _bullyingReports = MutableStateFlow<List<PrincipalBullyingRecord>>(emptyList())
    private val _attendanceSchedules = MutableStateFlow<Map<Int, DayScheduleRule>>(emptyMap())
    private val _prayerSchedules = MutableStateFlow<Map<Int, DayScheduleRule>>(emptyMap())
    private val _holidays = MutableStateFlow<List<HolidayRule>>(emptyList())
    private val _uiState = MutableStateFlow(PrincipalDashboardUiState())
    val uiState: StateFlow<PrincipalDashboardUiState> = _uiState.asStateFlow()
    val attendanceRecapMonth: StateFlow<Int> = _attendanceRecapMonth.asStateFlow()
    val attendanceRecapYear: StateFlow<Int> = _attendanceRecapYear.asStateFlow()
    val prayerRecapMonth: StateFlow<Int> = _prayerRecapMonth.asStateFlow()
    val prayerRecapYear: StateFlow<Int> = _prayerRecapYear.asStateFlow()

    private val studentRef = db.child("master_students")
    private val attendanceRef = db.child("attendance")
    private val prayerRef = db.child("prayer_attendance")
    private val literacyRef = db.child("literacy_logs")
    private val literacyReportRef = db.child("literacy_reports")
    private val borrowRef = db.child("borrow_records")
    private val taskRef = db.child("literacy_tasks")
    private val disciplineRef = db.child("discipline_records")
    private val bullyingRef = db.child("bullying_reports")

    private var studentListener: ValueEventListener? = null
    private var attendanceListener: ValueEventListener? = null
    private var attendanceTodayListener: ValueEventListener? = null
    private var prayerListener: ValueEventListener? = null
    private var literacyListener: ValueEventListener? = null
    private var literacyReportListener: ValueEventListener? = null
    private var borrowListener: ValueEventListener? = null
    private var taskListener: ValueEventListener? = null
    private var disciplineListener: ValueEventListener? = null
    private var bullyingListener: ValueEventListener? = null
    private var legacyAttendanceScheduleListener: ValueEventListener? = null
    private var scopedAttendanceScheduleListener: ValueEventListener? = null
    private var legacyPrayerScheduleListener: ValueEventListener? = null
    private var scopedPrayerScheduleListener: ValueEventListener? = null
    private var legacyHolidayListener: ValueEventListener? = null
    private var scopedHolidayListener: ValueEventListener? = null
    private var currentScopeKey: String = ""

    private var studentQuery: Query? = null
    private var attendanceQuery: Query? = null
    private var attendanceTodayQuery: Query? = null
    private var prayerQuery: Query? = null
    private var literacyQuery: Query? = null
    private var literacyReportQuery: Query? = null
    private var borrowQuery: Query? = null
    private var taskQuery: Query? = null
    private var disciplineQuery: Query? = null
    private var bullyingQuery: Query? = null

    init {
        viewModelScope.launch {
            combine(_session, _students) { session, students ->
                PrincipalInputs(session = session, students = students)
            }
                .combine(_attendanceLogsScoped) { inputs, logs -> inputs.copy(attendanceLogsScoped = logs) }
                .combine(_attendanceLogsTodayFallback) { inputs, logs -> inputs.copy(attendanceLogsTodayFallback = logs) }
                .combine(_prayerLogs) { inputs, logs -> inputs.copy(prayerLogs = logs) }
                .combine(_literacyLogs) { inputs, logs -> inputs.copy(literacyLogs = logs) }
                .combine(_literacyReports) { inputs, reports -> inputs.copy(literacyReports = reports) }
                .combine(_borrowRecords) { inputs, records -> inputs.copy(borrowRecords = records) }
                .combine(_tasks) { inputs, tasks -> inputs.copy(tasks = tasks) }
                .combine(_disciplineRecords) { inputs, records -> inputs.copy(disciplineRecords = records) }
                .combine(_bullyingReports) { inputs, reports -> inputs.copy(bullyingReports = reports) }
                .combine(_attendanceSchedules) { inputs, schedules -> inputs.copy(attendanceSchedules = schedules) }
                .combine(_prayerSchedules) { inputs, schedules -> inputs.copy(prayerSchedules = schedules) }
                .combine(_holidays) { inputs, holidays -> inputs.copy(holidays = holidays) }
                .combine(_attendanceRecapMonth) { inputs, month -> inputs.copy(selectedAttendanceRecapMonth = month) }
                .combine(_attendanceRecapYear) { inputs, year -> inputs.copy(selectedAttendanceRecapYear = year) }
                .combine(_prayerRecapMonth) { inputs, month -> inputs.copy(selectedPrayerRecapMonth = month) }
                .combine(_prayerRecapYear) { inputs, year -> inputs.copy(selectedPrayerRecapYear = year) }
                .collect { inputs ->
                    val attendance = if (inputs.attendanceLogsScoped.isNotEmpty()) inputs.attendanceLogsScoped else inputs.attendanceLogsTodayFallback
                    _uiState.value = buildUiState(
                        session = inputs.session,
                        students = inputs.students,
                        attendanceLogs = attendance,
                        prayerLogs = inputs.prayerLogs,
                        literacyLogs = inputs.literacyLogs,
                        literacyReports = inputs.literacyReports,
                        borrowRecords = inputs.borrowRecords,
                        tasks = inputs.tasks,
                        disciplineRecords = inputs.disciplineRecords,
                        bullyingReports = inputs.bullyingReports,
                        attendanceSchedules = inputs.attendanceSchedules,
                        prayerSchedules = inputs.prayerSchedules,
                        holidays = inputs.holidays,
                        selectedAttendanceRecapMonth = inputs.selectedAttendanceRecapMonth,
                        selectedAttendanceRecapYear = inputs.selectedAttendanceRecapYear,
                        selectedPrayerRecapMonth = inputs.selectedPrayerRecapMonth,
                        selectedPrayerRecapYear = inputs.selectedPrayerRecapYear
                    )
                }
        }
    }

    fun setAttendanceRecapMonth(month: Int) {
        if (month !in 1..12) return
        _attendanceRecapMonth.value = month
    }

    fun setAttendanceRecapYear(year: Int) {
        if (year !in 2000..2100) return
        _attendanceRecapYear.value = year
    }

    fun setPrayerRecapMonth(month: Int) {
        if (month !in 1..12) return
        _prayerRecapMonth.value = month
    }

    fun setPrayerRecapYear(year: Int) {
        if (year !in 2000..2100) return
        _prayerRecapYear.value = year
    }

    fun setSession(schoolId: String, schoolName: String, principalName: String) {
        val scope = normalizeScope(schoolId)
        if (scope.isBlank()) {
            _session.value = PrincipalDashboardUiState(
                principalName = principalName,
                schoolId = schoolId,
                schoolName = schoolName,
                isLoading = false
            )
            clearListeners()
            return
        }

        val nextKey = "$scope|$principalName|$schoolName"
        if (currentScopeKey == nextKey) return
        currentScopeKey = nextKey

        _session.value = PrincipalDashboardUiState(
            principalName = principalName,
            schoolId = schoolId,
            schoolName = schoolName,
            isLoading = true
        )

        attachStudentsListener(scope)
        attachAttendanceListener(scope)
        attachPrayerListener(scope)
        attachLiteracyListener(scope)
        attachLiteracyReportListener(scope)
        attachBorrowListener(scope)
        attachTaskListener(scope)
        attachDisciplineListener(scope)
        attachBullyingListener(scope)
        attachRuleListeners(scope)
    }

    private fun attachStudentsListener(scope: String) {
        studentQuery?.let { query ->
            studentListener?.let { query.removeEventListener(it) }
        }
        val query = studentRef.orderByChild("schoolId").equalTo(scope)
        studentQuery = query
        studentListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val students = snapshot.children.mapNotNull { child ->
                    val id = readString(child, "id").ifBlank { child.key.orEmpty() }
                    val nisn = readString(child, "nisn")
                    if (id.isBlank() && nisn.isBlank()) return@mapNotNull null
                    PrincipalStudentRecord(
                        id = id,
                        nisn = nisn.ifBlank { id },
                        name = readString(child, "name", "nama").ifBlank { "Siswa" },
                        className = readString(child, "class", "kelas").ifBlank { "-" },
                        schoolId = scope
                    )
                }.sortedBy { it.name }
                _students.value = students
            }

            override fun onCancelled(error: DatabaseError) {
                _students.value = emptyList()
            }
        }
        query.addValueEventListener(studentListener as ValueEventListener)
    }

    private fun attachAttendanceListener(scope: String) {
        attendanceQuery?.let { query -> attendanceListener?.let { query.removeEventListener(it) } }
        attendanceTodayQuery?.let { query -> attendanceTodayListener?.let { query.removeEventListener(it) } }

        val scopedQuery = attendanceRef.orderByChild("schoolId").equalTo(scope)
        attendanceQuery = scopedQuery
        attendanceListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                _attendanceLogsScoped.value = snapshot.children.mapNotNull { child ->
                    val studentId = readString(child, "studentId", "nisn")
                    if (studentId.isBlank()) return@mapNotNull null
                    PrincipalAttendanceRecord(
                        studentId = studentId,
                        date = readLong(child, "date", "createdAt"),
                        status = readString(child, "status").uppercase(Locale.ROOT),
                        schoolId = scope,
                        createdAt = readLong(child, "createdAt"),
                        updatedAt = readLong(child, "updatedAt", "date", "createdAt")
                    )
                }
            }

            override fun onCancelled(error: DatabaseError) {
                _attendanceLogsScoped.value = emptyList()
            }
        }
        scopedQuery.addValueEventListener(attendanceListener as ValueEventListener)

        val (startOfDay, endOfDay) = buildDayRange(System.currentTimeMillis())
        val todayQuery = attendanceRef.orderByChild("date").startAt(startOfDay.toDouble()).endAt(endOfDay.toDouble())
        attendanceTodayQuery = todayQuery
        attendanceTodayListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                _attendanceLogsTodayFallback.value = snapshot.children.mapNotNull { child ->
                    val studentId = readString(child, "studentId", "nisn")
                    if (studentId.isBlank()) return@mapNotNull null
                    PrincipalAttendanceRecord(
                        studentId = studentId,
                        date = readLong(child, "date", "createdAt"),
                        status = readString(child, "status").uppercase(Locale.ROOT),
                        schoolId = normalizeScope(readString(child, "schoolId")),
                        createdAt = readLong(child, "createdAt"),
                        updatedAt = readLong(child, "updatedAt", "date", "createdAt")
                    )
                }
            }

            override fun onCancelled(error: DatabaseError) {
                _attendanceLogsTodayFallback.value = emptyList()
            }
        }
        todayQuery.addValueEventListener(attendanceTodayListener as ValueEventListener)
    }

    private fun attachPrayerListener(scope: String) {
        prayerQuery?.let { query -> prayerListener?.let { query.removeEventListener(it) } }
        val query = prayerRef.orderByChild("schoolId").equalTo(scope)
        prayerQuery = query
        prayerListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                _prayerLogs.value = snapshot.children.mapNotNull { child ->
                    val studentId = readString(child, "studentId", "nisn")
                    if (studentId.isBlank()) return@mapNotNull null
                    PrincipalPrayerRecord(
                        studentId = studentId,
                        date = readLong(child, "date", "createdAt"),
                        status = readString(child, "status").uppercase(Locale.ROOT),
                        schoolId = scope
                    )
                }
            }

            override fun onCancelled(error: DatabaseError) {
                _prayerLogs.value = emptyList()
            }
        }
        query.addValueEventListener(prayerListener as ValueEventListener)
    }

    private fun attachLiteracyListener(scope: String) {
        literacyQuery?.let { query -> literacyListener?.let { query.removeEventListener(it) } }
        val query = literacyRef.orderByChild("schoolId").equalTo(scope)
        literacyQuery = query
        literacyListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                _literacyLogs.value = snapshot.children.mapNotNull { child ->
                    val studentId = readString(child, "studentId", "nisn", "studentNisn")
                    if (studentId.isBlank()) return@mapNotNull null
                    PrincipalLiteracyRecord(
                        studentId = studentId,
                        studentName = readString(child, "studentName", "name", "nama").ifBlank { "Siswa" },
                        taskId = readString(child, "taskId"),
                        taskTitle = readString(child, "taskTitle", "title").ifBlank { "Laporan literasi" },
                        bookTitle = readString(child, "bookTitle"),
                        summary = readString(child, "summary"),
                        status = readString(child, "status").lowercase(Locale.ROOT),
                        timestamp = readLong(child, "timestamp", "submissionDate", "createdAt"),
                        schoolId = scope
                    )
                }
            }

            override fun onCancelled(error: DatabaseError) {
                _literacyLogs.value = emptyList()
            }
        }
        query.addValueEventListener(literacyListener as ValueEventListener)
    }

    private fun attachLiteracyReportListener(scope: String) {
        literacyReportQuery?.let { query -> literacyReportListener?.let { query.removeEventListener(it) } }
        val query = literacyReportRef.orderByChild("schoolId").equalTo(scope)
        literacyReportQuery = query
        literacyReportListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                _literacyReports.value = snapshot.children.mapNotNull { child ->
                    val studentId = readString(child, "studentId", "nisn", "studentNisn")
                    if (studentId.isBlank()) return@mapNotNull null
                    PrincipalLiteracyReportRecord(
                        studentId = studentId,
                        taskId = readString(child, "taskId"),
                        taskTitle = readString(child, "taskTitle", "title"),
                        bookTitle = readString(child, "bookTitle"),
                        summary = readString(child, "summary"),
                        status = readString(child, "status").lowercase(Locale.ROOT),
                        timestamp = readLong(child, "submissionDate", "timestamp", "createdAt"),
                        schoolId = scope
                    )
                }
            }

            override fun onCancelled(error: DatabaseError) {
                _literacyReports.value = emptyList()
            }
        }
        query.addValueEventListener(literacyReportListener as ValueEventListener)
    }

    private fun attachBorrowListener(scope: String) {
        borrowQuery?.let { query -> borrowListener?.let { query.removeEventListener(it) } }
        val query = borrowRef.orderByChild("schoolId").equalTo(scope)
        borrowQuery = query
        borrowListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                _borrowRecords.value = snapshot.children.mapNotNull { child ->
                    val studentId = readString(child, "studentId", "nisn", "studentNisn")
                    if (studentId.isBlank()) return@mapNotNull null
                    PrincipalBorrowRecord(
                        studentId = studentId,
                        borrowDate = readLong(child, "borrowDate", "createdAt"),
                        returnDate = readLong(child, "returnDate"),
                        schoolId = scope
                    )
                }
            }

            override fun onCancelled(error: DatabaseError) {
                _borrowRecords.value = emptyList()
            }
        }
        query.addValueEventListener(borrowListener as ValueEventListener)
    }

    private fun attachTaskListener(scope: String) {
        taskQuery?.let { query -> taskListener?.let { query.removeEventListener(it) } }
        val query = taskRef.orderByChild("schoolId").equalTo(scope)
        taskQuery = query
        taskListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                _tasks.value = snapshot.children.mapNotNull { child ->
                    val title = readString(child, "title", "judul")
                    if (title.isBlank()) return@mapNotNull null
                    PrincipalTaskRecord(
                        title = title,
                        isActive = child.child("isActive").getValue(Boolean::class.java) ?: false,
                        schoolId = scope
                    )
                }
            }

            override fun onCancelled(error: DatabaseError) {
                _tasks.value = emptyList()
            }
        }
        query.addValueEventListener(taskListener as ValueEventListener)
    }

    private fun attachDisciplineListener(scope: String) {
        disciplineQuery?.let { query -> disciplineListener?.let { query.removeEventListener(it) } }
        val query = disciplineRef.orderByChild("schoolId").equalTo(scope)
        disciplineQuery = query
        disciplineListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                _disciplineRecords.value = snapshot.children.mapNotNull { child ->
                    val studentId = readString(child, "studentId", "nisn")
                    if (studentId.isBlank()) return@mapNotNull null
                    PrincipalDisciplineRecord(
                        id = child.key.orEmpty(),
                        studentId = studentId,
                        studentName = readString(child, "studentNameSnapshot", "studentName", "name", "nama"),
                        className = readString(child, "classNameSnapshot", "class", "kelas"),
                        ruleName = readString(child, "ruleNameSnapshot", "ruleName", "title").ifBlank { "Pelanggaran" },
                        date = readLong(child, "date", "createdAt", "updatedAt"),
                        points = readInt(child, "points"),
                        followUpStatus = readString(child, "followUpStatus").uppercase(Locale.ROOT),
                        status = readString(child, "status").uppercase(Locale.ROOT),
                        schoolId = scope
                    )
                }
            }

            override fun onCancelled(error: DatabaseError) {
                _disciplineRecords.value = emptyList()
            }
        }
        query.addValueEventListener(disciplineListener as ValueEventListener)
    }

    private fun attachBullyingListener(scope: String) {
        bullyingQuery?.let { query -> bullyingListener?.let { query.removeEventListener(it) } }
        val query = bullyingRef.orderByChild("schoolId").equalTo(scope)
        bullyingQuery = query
        bullyingListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                _bullyingReports.value = snapshot.children.mapNotNull { child ->
                    PrincipalBullyingRecord(
                        id = child.key.orEmpty(),
                        reporterId = readString(child, "reporterId"),
                        reporterName = readString(child, "reporterName"),
                        victimId = readString(child, "victimId"),
                        victimName = readString(child, "victimName"),
                        perpetratorId = readString(child, "perpetratorId"),
                        perpetratorName = readString(child, "perpetratorName"),
                        category = readString(child, "category").ifBlank { "BULLYING" }.uppercase(Locale.ROOT),
                        incidentType = readString(child, "incidentType").ifBlank { "OTHER" }.uppercase(Locale.ROOT),
                        priority = readString(child, "priority").ifBlank { "MEDIUM" }.uppercase(Locale.ROOT),
                        status = readString(child, "status").ifBlank { "PENDING" }.uppercase(Locale.ROOT),
                        createdAt = readLong(child, "createdAt", "updatedAt", "incidentDate"),
                        schoolId = scope
                    )
                }
            }

            override fun onCancelled(error: DatabaseError) {
                _bullyingReports.value = emptyList()
            }
        }
        query.addValueEventListener(bullyingListener as ValueEventListener)
    }

    private fun buildUiState(
        session: PrincipalDashboardUiState,
        students: List<PrincipalStudentRecord>,
        attendanceLogs: List<PrincipalAttendanceRecord>,
        prayerLogs: List<PrincipalPrayerRecord>,
        literacyLogs: List<PrincipalLiteracyRecord>,
        literacyReports: List<PrincipalLiteracyReportRecord>,
        borrowRecords: List<PrincipalBorrowRecord>,
        tasks: List<PrincipalTaskRecord>,
        disciplineRecords: List<PrincipalDisciplineRecord>,
        bullyingReports: List<PrincipalBullyingRecord>,
        attendanceSchedules: Map<Int, DayScheduleRule>,
        prayerSchedules: Map<Int, DayScheduleRule>,
        holidays: List<HolidayRule>,
        selectedAttendanceRecapMonth: Int,
        selectedAttendanceRecapYear: Int,
        selectedPrayerRecapMonth: Int,
        selectedPrayerRecapYear: Int
    ): PrincipalDashboardUiState {
        val schoolScope = normalizeScope(session.schoolId)
        if (schoolScope.isBlank()) {
            return session.copy(isLoading = false)
        }

        val scopedStudents = students.filter { normalizeScope(it.schoolId) == schoolScope }
        val studentIds = scopedStudents.flatMap { studentIdentityCandidates(it) }.toSet()
        val studentMap = buildStudentIdentityMap(scopedStudents)
        val todayRange = buildDayRange(System.currentTimeMillis())
        val monthRange = buildMonthRange(System.currentTimeMillis())
        val selectedAttendanceRecapRange = buildMonthRange(selectedAttendanceRecapYear, selectedAttendanceRecapMonth)
        val selectedPrayerRecapRange = buildMonthRange(selectedPrayerRecapYear, selectedPrayerRecapMonth)
        val weekRange = buildWeekRange(System.currentTimeMillis())
        val todayCalendar = Calendar.getInstance().apply {
            timeInMillis = System.currentTimeMillis()
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val isAttendanceDayValid = isValidSchoolDay(todayCalendar, attendanceSchedules, holidays)
        val isPrayerDayValid = isValidPrayerDay(todayCalendar, prayerSchedules, holidays)

        val scopedAttendance = attendanceLogs.filter { log ->
            matchesScope(log.schoolId, schoolScope) || (log.schoolId.isBlank() && studentIds.contains(normalizeIdentity(log.studentId)))
        }
        val scopedPrayer = prayerLogs.filter { log ->
            matchesScope(log.schoolId, schoolScope) || (log.schoolId.isBlank() && studentIds.contains(normalizeIdentity(log.studentId)))
        }
        val scopedLiteracy = literacyLogs.filter { log ->
            matchesScope(log.schoolId, schoolScope) || (log.schoolId.isBlank() && studentIds.contains(normalizeIdentity(log.studentId)))
        }
        val scopedLiteracyReports = literacyReports.filter { report ->
            matchesScope(report.schoolId, schoolScope) || (report.schoolId.isBlank() && studentIds.contains(normalizeIdentity(report.studentId)))
        }
        val scopedBorrows = borrowRecords.filter { record ->
            matchesScope(record.schoolId, schoolScope) || (record.schoolId.isBlank() && studentIds.contains(normalizeIdentity(record.studentId)))
        }
        val scopedTasks = tasks.filter { task ->
            task.isActive && matchesScope(task.schoolId, schoolScope)
        }
        val scopedDiscipline = disciplineRecords.filter { record ->
            matchesScope(record.schoolId, schoolScope) || (record.schoolId.isBlank() && studentIds.contains(normalizeIdentity(record.studentId)))
        }
        val scopedBullying = bullyingReports.filter { report ->
            matchesScope(report.schoolId, schoolScope) || (
                report.schoolId.isBlank() && (
                    studentIds.contains(normalizeIdentity(report.reporterId)) ||
                        studentIds.contains(normalizeIdentity(report.victimId)) ||
                        studentIds.contains(normalizeIdentity(report.perpetratorId))
                    )
                )
        }

        val attendanceSummary = if (isAttendanceDayValid) {
            buildAttendanceSummary(scopedStudents, scopedAttendance, todayRange.first, todayRange.second)
        } else {
            PrincipalAttendanceSummary(totalStudents = scopedStudents.size)
        }
        val attendanceRecapSummary = buildAttendanceRecapSummary(
            students = scopedStudents,
            logs = scopedAttendance,
            monthRange = selectedAttendanceRecapRange,
            selectedMonth = selectedAttendanceRecapMonth,
            selectedYear = selectedAttendanceRecapYear
        )
        val prayerSummary = if (isPrayerDayValid) {
            buildPrayerSummary(scopedStudents, scopedPrayer, todayRange.first, todayRange.second)
        } else {
            PrincipalPrayerSummary(totalStudents = scopedStudents.size)
        }
        val prayerRecapSummary = buildPrayerRecapSummary(
            students = scopedStudents,
            logs = scopedPrayer,
            monthRange = selectedPrayerRecapRange,
            selectedMonth = selectedPrayerRecapMonth,
            selectedYear = selectedPrayerRecapYear,
            schedules = prayerSchedules,
            holidays = holidays
        )
        val literacySummary = buildLiteracySummary(scopedStudents, scopedLiteracy, scopedLiteracyReports, scopedBorrows, scopedTasks, weekRange, monthRange)
        val disciplineSummary = buildDisciplineSummary(scopedDiscipline, weekRange, monthRange)
        val bullyingSummary = buildBullyingSummary(scopedBullying, monthRange)
        val classSummaries = buildClassSummaries(
            students = scopedStudents,
            attendanceLogs = scopedAttendance,
            prayerLogs = scopedPrayer,
            literacyLogs = scopedLiteracy,
            literacyReports = scopedLiteracyReports,
            dayRange = todayRange,
            monthRange = monthRange,
            isAttendanceDayValid = isAttendanceDayValid,
            isPrayerDayValid = isPrayerDayValid
        )
        val attendanceRecapClassSummaries = buildAttendanceRecapClassSummaries(
            students = scopedStudents,
            attendanceLogs = scopedAttendance,
            monthRange = selectedAttendanceRecapRange,
            selectedMonth = selectedAttendanceRecapMonth,
            selectedYear = selectedAttendanceRecapYear
        )
        val prayerRecapClassSummaries = buildPrayerRecapClassSummaries(
            students = scopedStudents,
            prayerLogs = scopedPrayer,
            monthRange = selectedPrayerRecapRange,
            selectedMonth = selectedPrayerRecapMonth,
            selectedYear = selectedPrayerRecapYear,
            schedules = prayerSchedules,
            holidays = holidays
        )
        val attendanceToday = latestAttendancePerStudent(scopedAttendance.filter { it.date in todayRange.first..todayRange.second })
        val prayerToday = latestPrayerPerStudent(scopedPrayer.filter { it.date in todayRange.first..todayRange.second })
        val disciplineThisMonth = scopedDiscipline.filter { it.date in monthRange.first..monthRange.second }
        val literacySubmittersThisMonth = buildLiteracySubmitters(scopedLiteracy, scopedLiteracyReports, monthRange)
        val activeBullying = scopedBullying.filter { isBullyingActive(it.status) }
        val attentionStudents = buildAttentionStudents(
            students = scopedStudents,
            attendanceToday = attendanceToday,
            prayerToday = prayerToday,
            literacySubmittersThisMonth = literacySubmittersThisMonth,
            disciplineThisMonth = disciplineThisMonth,
            activeBullying = activeBullying,
            isAttendanceDayValid = isAttendanceDayValid,
            isPrayerDayValid = isPrayerDayValid
        )
        val recentIssues = buildRecentIssues(
            disciplineLogs = scopedDiscipline,
            bullyingReports = scopedBullying,
            studentMap = studentMap
        )
        val recentActivities = buildRecentActivities(
            logs = scopedLiteracy,
            reports = scopedLiteracyReports,
            studentMap = studentMap
        )

        return session.copy(
            isLoading = false,
            attendanceRecapMonth = selectedAttendanceRecapMonth,
            attendanceRecapYear = selectedAttendanceRecapYear,
            prayerRecapMonth = selectedPrayerRecapMonth,
            prayerRecapYear = selectedPrayerRecapYear,
            attendance = attendanceSummary,
            attendanceRecap = attendanceRecapSummary,
            prayer = prayerSummary,
            prayerRecap = prayerRecapSummary,
            literacy = literacySummary,
            discipline = disciplineSummary,
            bullying = bullyingSummary,
            classSummaries = classSummaries,
            attendanceRecapClassSummaries = attendanceRecapClassSummaries,
            prayerRecapClassSummaries = prayerRecapClassSummaries,
            attentionStudents = attentionStudents,
            recentIssues = recentIssues,
            recentActivities = recentActivities,
            lastUpdatedLabel = formatTimestamp(System.currentTimeMillis())
        )
    }

    private fun buildAttendanceSummary(
        students: List<PrincipalStudentRecord>,
        logs: List<PrincipalAttendanceRecord>,
        dayStart: Long,
        dayEnd: Long
    ): PrincipalAttendanceSummary {
        val latestByStudent = latestAttendancePerStudent(logs.filter { it.date in dayStart..dayEnd })
        var hadir = 0
        var sakit = 0
        var izin = 0
        var alpha = 0
        var terlambat = 0

        students.forEach { student ->
            when (findByStudentIdentity(latestByStudent, student)?.status) {
                "PRESENT" -> hadir += 1
                "LATE" -> {
                    hadir += 1
                    terlambat += 1
                }
                "SICK" -> sakit += 1
                "PERMIT" -> izin += 1
                else -> alpha += 1
            }
        }

        return PrincipalAttendanceSummary(
            totalStudents = students.size,
            hadir = hadir,
            sakit = sakit,
            izin = izin,
            alpha = alpha,
            terlambat = terlambat,
            validSchoolDays = if (students.isEmpty()) 0 else 1,
            effectiveObligation = students.size
        )
    }

    private fun buildAttendanceRecapSummary(
        students: List<PrincipalStudentRecord>,
        logs: List<PrincipalAttendanceRecord>,
        monthRange: Pair<Long, Long>,
        selectedMonth: Int,
        selectedYear: Int
    ): PrincipalAttendanceSummary {
        if (students.isEmpty()) return PrincipalAttendanceSummary()
        val recapDateKeys = buildAttendanceRecapDateKeys(monthRange, selectedMonth, selectedYear)
        if (recapDateKeys.isEmpty()) {
            return PrincipalAttendanceSummary(totalStudents = students.size)
        }
        val recapLogMap = buildAttendanceRecapLogMap(students, logs, monthRange, recapDateKeys.toSet())
        var hadir = 0
        var sakit = 0
        var izin = 0
        var alpha = 0
        var terlambat = 0

        students.forEach { student ->
            val canonicalId = canonicalStudentId(student)
            if (canonicalId.isBlank()) return@forEach
            recapDateKeys.forEach { dateKey ->
                when (recapLogMap[buildStudentDateKey(canonicalId, dateKey)]?.status) {
                    "PRESENT" -> hadir += 1
                    "LATE" -> {
                        hadir += 1
                        terlambat += 1
                    }
                    "SICK" -> sakit += 1
                    "PERMIT" -> izin += 1
                    else -> alpha += 1
                }
            }
        }

        return PrincipalAttendanceSummary(
            totalStudents = students.size,
            hadir = hadir,
            sakit = sakit,
            izin = izin,
            alpha = alpha,
            terlambat = terlambat,
            validSchoolDays = recapDateKeys.size,
            effectiveObligation = recapDateKeys.size * students.size
        )
    }

    private fun buildPrayerSummary(
        students: List<PrincipalStudentRecord>,
        logs: List<PrincipalPrayerRecord>,
        dayStart: Long,
        dayEnd: Long
    ): PrincipalPrayerSummary {
        val latestByStudent = latestPrayerPerStudent(logs.filter { it.date in dayStart..dayEnd })
        var pray = 0
        var permit = 0
        var halangan = 0
        var notPray = 0

        students.forEach { student ->
            when (findByStudentIdentity(latestByStudent, student)?.status) {
                "PRAY" -> pray += 1
                "PERMIT" -> permit += 1
                "HALANGAN" -> halangan += 1
                else -> notPray += 1
            }
        }

        return PrincipalPrayerSummary(
            totalStudents = students.size,
            pray = pray,
            permit = permit,
            halangan = halangan,
            notPray = notPray,
            validPrayerDays = if (students.isEmpty()) 0 else 1,
            effectiveObligation = students.size
        )
    }

    private fun buildPrayerRecapSummary(
        students: List<PrincipalStudentRecord>,
        logs: List<PrincipalPrayerRecord>,
        monthRange: Pair<Long, Long>,
        selectedMonth: Int,
        selectedYear: Int,
        schedules: Map<Int, DayScheduleRule>,
        holidays: List<HolidayRule>
    ): PrincipalPrayerSummary {
        if (students.isEmpty()) return PrincipalPrayerSummary()
        val recapDateKeys = buildPrayerRecapDateKeys(monthRange, selectedMonth, selectedYear, schedules, holidays)
        if (recapDateKeys.isEmpty()) {
            return PrincipalPrayerSummary(totalStudents = students.size)
        }
        val recapLogMap = buildPrayerRecapLogMap(students, logs, monthRange, recapDateKeys.toSet())
        var pray = 0
        var permit = 0
        var halangan = 0
        var notPray = 0

        students.forEach { student ->
            val canonicalId = canonicalStudentId(student)
            if (canonicalId.isBlank()) return@forEach
            recapDateKeys.forEach { dateKey ->
                when (recapLogMap[buildStudentDateKey(canonicalId, dateKey)]?.status) {
                    "PRAY" -> pray += 1
                    "PERMIT" -> permit += 1
                    "HALANGAN" -> halangan += 1
                    else -> notPray += 1
                }
            }
        }

        return PrincipalPrayerSummary(
            totalStudents = students.size,
            pray = pray,
            permit = permit,
            halangan = halangan,
            notPray = notPray,
            validPrayerDays = recapDateKeys.size,
            effectiveObligation = recapDateKeys.size * students.size
        )
    }

    private fun buildLiteracySummary(
        students: List<PrincipalStudentRecord>,
        logs: List<PrincipalLiteracyRecord>,
        reports: List<PrincipalLiteracyReportRecord>,
        borrowRecords: List<PrincipalBorrowRecord>,
        tasks: List<PrincipalTaskRecord>,
        weekRange: Pair<Long, Long>,
        monthRange: Pair<Long, Long>
    ): PrincipalLiteracySummary {
        data class UnifiedLiteracyEntry(
            val studentId: String,
            val taskId: String,
            val taskTitle: String,
            val bookTitle: String,
            val summary: String,
            val status: String,
            val timestamp: Long
        )

        fun getDateKey(timestamp: Long): String {
            if (timestamp <= 0L) return ""
            return SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date(timestamp))
        }

        fun isSameMonthYear(timestamp: Long, month: Int, year: Int): Boolean {
            if (timestamp <= 0L) return false
            val calendar = Calendar.getInstance().apply { timeInMillis = timestamp }
            return calendar.get(Calendar.MONTH) == month && calendar.get(Calendar.YEAR) == year
        }

        val weeklyLogs = logs.filter { it.timestamp in weekRange.first..weekRange.second }
        val weeklyReports = reports.filter { it.timestamp in weekRange.first..weekRange.second }
        val monthlyLogs = logs.filter { it.timestamp in monthRange.first..monthRange.second }
        val monthlyReports = reports.filter { it.timestamp in monthRange.first..monthRange.second }
        val combinedMonthlyStatuses = monthlyLogs.map { it.status } + monthlyReports.map { it.status }
        val reviewed = combinedMonthlyStatuses.count { it == "reviewed" }
        val pending = combinedMonthlyStatuses.count { it != "reviewed" }

        val currentMonthCalendar = Calendar.getInstance()
        val currentMonth = currentMonthCalendar.get(Calendar.MONTH)
        val currentYear = currentMonthCalendar.get(Calendar.YEAR)

        val monthlyBorrows = borrowRecords.filter { isSameMonthYear(it.borrowDate, currentMonth, currentYear) }
        val unifiedEntries = mutableListOf<UnifiedLiteracyEntry>()
        logs.forEach { log ->
            if (!isSameMonthYear(log.timestamp, currentMonth, currentYear)) return@forEach
            unifiedEntries += UnifiedLiteracyEntry(
                studentId = log.studentId,
                taskId = log.taskId,
                taskTitle = log.taskTitle,
                bookTitle = log.bookTitle,
                summary = log.summary,
                status = log.status,
                timestamp = log.timestamp
            )
        }
        reports.forEach { report ->
            if (!isSameMonthYear(report.timestamp, currentMonth, currentYear)) return@forEach
            unifiedEntries += UnifiedLiteracyEntry(
                studentId = report.studentId,
                taskId = report.taskId,
                taskTitle = report.taskTitle,
                bookTitle = report.bookTitle,
                summary = report.summary,
                status = report.status,
                timestamp = report.timestamp
            )
        }

        val dedupedEntries = LinkedHashMap<String, UnifiedLiteracyEntry>()
        unifiedEntries.sortedBy { it.timestamp }.forEach { entry ->
            val dedupeKey = listOf(
                entry.studentId.trim(),
                getDateKey(entry.timestamp),
                entry.bookTitle.trim().lowercase(Locale.ROOT),
                entry.summary.trim().take(80).lowercase(Locale.ROOT)
            ).joinToString("|")
            dedupedEntries[dedupeKey] = entry
        }
        val monthlyUnifiedEntries = dedupedEntries.values.toList()

        var activeStudents = 0
        var totalVisitDays = 0
        var totalBorrows = 0
        var totalReports = 0
        var totalTasksDone = 0
        var totalScore = 0
        var veryActive = 0
        var active = 0
        var enough = 0
        var needsSupport = 0
        var inactive = 0

        students.forEach { student ->
            val identityCandidates = studentIdentityCandidates(student).toSet()
            val studentBorrows = monthlyBorrows.filter { identityCandidates.contains(normalizeIdentity(it.studentId)) }
            val studentEntries = monthlyUnifiedEntries.filter { identityCandidates.contains(normalizeIdentity(it.studentId)) }
            val taskEntries = studentEntries.filter { it.taskId.isNotBlank() || it.taskTitle.isNotBlank() }
            val activityDays = mutableSetOf<String>()

            studentBorrows.forEach { record ->
                if (record.borrowDate > 0L) {
                    activityDays += getDateKey(record.borrowDate)
                }
                if (isSameMonthYear(record.returnDate, currentMonth, currentYear)) {
                    activityDays += getDateKey(record.returnDate)
                }
            }
            studentEntries.forEach { entry ->
                if (entry.timestamp > 0L) {
                    activityDays += getDateKey(entry.timestamp)
                }
            }

            val visitDays = activityDays.filter { it.isNotBlank() }.toSet().size
            val borrowCount = studentBorrows.size
            val reportCount = studentEntries.size
            val taskCount = taskEntries.size
            val readingActivityCount = borrowCount + reportCount

            val visitScore = minOf((visitDays / 8f) * 30f, 30f)
            val readingScore = minOf((readingActivityCount / 4f) * 35f, 35f)
            val taskScore = minOf((taskCount / 2f) * 35f, 35f)
            val finalScore = (visitScore + readingScore + taskScore).roundToInt()

            if (finalScore > 0) activeStudents += 1
            totalVisitDays += visitDays
            totalBorrows += borrowCount
            totalReports += reportCount
            totalTasksDone += taskCount
            totalScore += finalScore

            when {
                finalScore >= 85 -> veryActive += 1
                finalScore >= 70 -> active += 1
                finalScore >= 50 -> enough += 1
                finalScore > 0 -> needsSupport += 1
                else -> inactive += 1
            }
        }

        val averageScore = if (students.isEmpty()) 0 else (totalScore.toFloat() / students.size.toFloat()).roundToInt()

        return PrincipalLiteracySummary(
            activeTasks = tasks.size,
            reportsThisWeek = weeklyLogs.size + weeklyReports.size,
            reportsThisMonth = monthlyUnifiedEntries.size,
            reviewedReports = reviewed,
            pendingReports = pending,
            studentsSubmittedThisMonth = activeStudents,
            totalStudents = students.size,
            totalVisitDays = totalVisitDays,
            totalBorrows = totalBorrows,
            totalTasksDone = totalTasksDone,
            averageScore = averageScore,
            veryActiveCount = veryActive,
            activeCount = active,
            enoughActiveCount = enough,
            needsSupportCount = needsSupport,
            inactiveCount = inactive
        )
    }

    private fun buildDisciplineSummary(
        logs: List<PrincipalDisciplineRecord>,
        weekRange: Pair<Long, Long>,
        monthRange: Pair<Long, Long>
    ): PrincipalDisciplineSummary {
        val weeklyLogs = logs.filter { it.date in weekRange.first..weekRange.second }
        val monthlyLogs = logs.filter { it.date in monthRange.first..monthRange.second }
        val openFollowUps = monthlyLogs.count { isDisciplineOpen(it) }
        val totalPoints = monthlyLogs.sumOf { it.points.coerceAtLeast(0) }
        return PrincipalDisciplineSummary(
            violationsThisWeek = weeklyLogs.size,
            violationsThisMonth = monthlyLogs.size,
            openFollowUps = openFollowUps,
            studentsFlagged = monthlyLogs.map { it.studentId }.filter { it.isNotBlank() }.toSet().size,
            totalPointsThisMonth = totalPoints
        )
    }

    private fun buildBullyingSummary(
        reports: List<PrincipalBullyingRecord>,
        monthRange: Pair<Long, Long>
    ): PrincipalBullyingSummary {
        val monthlyReports = reports.filter { it.createdAt in monthRange.first..monthRange.second }
        val activeReports = monthlyReports.count { isBullyingActive(it.status) }
        val resolvedReports = monthlyReports.size - activeReports
        val highPriorityReports = monthlyReports.count { it.priority == "HIGH" || it.priority == "CRITICAL" }
        return PrincipalBullyingSummary(
            reportsThisMonth = monthlyReports.size,
            activeReports = activeReports,
            resolvedReports = resolvedReports,
            highPriorityReports = highPriorityReports
        )
    }

    private fun buildClassSummaries(
        students: List<PrincipalStudentRecord>,
        attendanceLogs: List<PrincipalAttendanceRecord>,
        prayerLogs: List<PrincipalPrayerRecord>,
        literacyLogs: List<PrincipalLiteracyRecord>,
        literacyReports: List<PrincipalLiteracyReportRecord>,
        dayRange: Pair<Long, Long>,
        monthRange: Pair<Long, Long>,
        isAttendanceDayValid: Boolean,
        isPrayerDayValid: Boolean
    ): List<PrincipalClassSummary> {
        if (students.isEmpty()) return emptyList()

        val attendanceToday = latestAttendancePerStudent(attendanceLogs.filter { it.date in dayRange.first..dayRange.second })
        val prayerToday = latestPrayerPerStudent(prayerLogs.filter { it.date in dayRange.first..dayRange.second })
        val literacySubmitters = buildLiteracySubmitters(literacyLogs, literacyReports, monthRange)

        return students
            .groupBy { it.className.ifBlank { "-" } }
            .map { (className, classStudents) ->
                val total = classStudents.size
                val ids = classStudents.flatMap { studentIdentityCandidates(it) }.toSet()
                val attendancePresent = classStudents.count { student ->
                    val status = findByStudentIdentity(attendanceToday, student)?.status
                    status == "PRESENT" || status == "LATE"
                }
                val prayerPray = classStudents.count { student ->
                    findByStudentIdentity(prayerToday, student)?.status == "PRAY"
                }
                val literacySubmitted = literacySubmitters.count { ids.contains(it) }

                PrincipalClassSummary(
                    className = className,
                    totalStudents = total,
                    attendanceRate = if (!isAttendanceDayValid || total == 0) 0f else attendancePresent.toFloat() / total.toFloat(),
                    prayerRate = if (!isPrayerDayValid || total == 0) 0f else prayerPray.toFloat() / total.toFloat(),
                    literacyRate = if (total == 0) 0f else literacySubmitted.toFloat() / total.toFloat()
                )
            }
            .sortedBy { it.className }
    }

    private fun buildAttendanceRecapClassSummaries(
        students: List<PrincipalStudentRecord>,
        attendanceLogs: List<PrincipalAttendanceRecord>,
        monthRange: Pair<Long, Long>,
        selectedMonth: Int,
        selectedYear: Int
    ): List<PrincipalClassSummary> {
        if (students.isEmpty()) return emptyList()
        val recapDateKeys = buildAttendanceRecapDateKeys(monthRange, selectedMonth, selectedYear)
        if (recapDateKeys.isEmpty()) {
            return students
                .groupBy { it.className.ifBlank { "-" } }
                .map { (className, classStudents) ->
                    PrincipalClassSummary(
                        className = className,
                        totalStudents = classStudents.size,
                        attendanceRate = 0f,
                        prayerRate = 0f,
                        literacyRate = 0f
                    )
                }
                .sortedBy { it.className }
        }
        val recapLogMap = buildAttendanceRecapLogMap(students, attendanceLogs, monthRange, recapDateKeys.toSet())
        return students
            .groupBy { it.className.ifBlank { "-" } }
            .map { (className, classStudents) ->
                val totalStudents = classStudents.size
                val effectiveObligation = recapDateKeys.size * totalStudents
                var hadir = 0
                classStudents.forEach { student ->
                    val canonicalId = canonicalStudentId(student)
                    if (canonicalId.isBlank()) return@forEach
                    recapDateKeys.forEach { dateKey ->
                        val status = recapLogMap[buildStudentDateKey(canonicalId, dateKey)]?.status
                        if (status == "PRESENT" || status == "LATE") {
                            hadir += 1
                        }
                    }
                }
                PrincipalClassSummary(
                    className = className,
                    totalStudents = totalStudents,
                    attendanceRate = if (effectiveObligation == 0) 0f else hadir.toFloat() / effectiveObligation.toFloat(),
                    prayerRate = 0f,
                    literacyRate = 0f
                )
            }
            .sortedBy { it.className }
    }

    private fun buildPrayerRecapClassSummaries(
        students: List<PrincipalStudentRecord>,
        prayerLogs: List<PrincipalPrayerRecord>,
        monthRange: Pair<Long, Long>,
        selectedMonth: Int,
        selectedYear: Int,
        schedules: Map<Int, DayScheduleRule>,
        holidays: List<HolidayRule>
    ): List<PrincipalClassSummary> {
        if (students.isEmpty()) return emptyList()
        val recapDateKeys = buildPrayerRecapDateKeys(monthRange, selectedMonth, selectedYear, schedules, holidays)
        if (recapDateKeys.isEmpty()) {
            return students
                .groupBy { it.className.ifBlank { "-" } }
                .map { (className, classStudents) ->
                    PrincipalClassSummary(
                        className = className,
                        totalStudents = classStudents.size,
                        attendanceRate = 0f,
                        prayerRate = 0f,
                        literacyRate = 0f
                    )
                }
                .sortedBy { it.className }
        }
        val recapLogMap = buildPrayerRecapLogMap(students, prayerLogs, monthRange, recapDateKeys.toSet())
        return students
            .groupBy { it.className.ifBlank { "-" } }
            .map { (className, classStudents) ->
                val totalStudents = classStudents.size
                val effectiveObligation = recapDateKeys.size * totalStudents
                var pray = 0
                classStudents.forEach { student ->
                    val canonicalId = canonicalStudentId(student)
                    if (canonicalId.isBlank()) return@forEach
                    recapDateKeys.forEach { dateKey ->
                        val status = recapLogMap[buildStudentDateKey(canonicalId, dateKey)]?.status
                        if (status == "PRAY") {
                            pray += 1
                        }
                    }
                }
                PrincipalClassSummary(
                    className = className,
                    totalStudents = totalStudents,
                    attendanceRate = 0f,
                    prayerRate = if (effectiveObligation == 0) 0f else pray.toFloat() / effectiveObligation.toFloat(),
                    literacyRate = 0f
                )
            }
            .sortedBy { it.className }
    }

    private fun buildAttentionStudents(
        students: List<PrincipalStudentRecord>,
        attendanceToday: Map<String, PrincipalAttendanceRecord>,
        prayerToday: Map<String, PrincipalPrayerRecord>,
        literacySubmittersThisMonth: Set<String>,
        disciplineThisMonth: List<PrincipalDisciplineRecord>,
        activeBullying: List<PrincipalBullyingRecord>,
        isAttendanceDayValid: Boolean,
        isPrayerDayValid: Boolean
    ): List<PrincipalAttentionStudent> {
        if (students.isEmpty()) return emptyList()
        val disciplineByStudent = disciplineThisMonth.groupBy { normalizeIdentity(it.studentId) }
        val bullyingCountByStudent = LinkedHashMap<String, Int>()
        activeBullying.forEach { report ->
            listOf(report.reporterId, report.victimId, report.perpetratorId)
                .map { normalizeIdentity(it) }
                .filter { it.isNotBlank() }
                .forEach { studentId ->
                    bullyingCountByStudent[studentId] = (bullyingCountByStudent[studentId] ?: 0) + 1
                }
        }

        return students.mapNotNull { student ->
            val reasons = mutableListOf<String>()
            val categories = linkedSetOf<String>()
            var score = 0
            val identityCandidates = studentIdentityCandidates(student)

            if (isAttendanceDayValid) {
                when (findByStudentIdentity(attendanceToday, student)?.status) {
                    "LATE" -> {
                        reasons += "Terlambat hari ini"
                        categories += "attendance"
                        score += 1
                    }
                    "SICK" -> {
                        reasons += "Sakit hari ini"
                        categories += "attendance"
                        score += 1
                    }
                    "PERMIT" -> {
                        reasons += "Izin hari ini"
                        categories += "attendance"
                        score += 1
                    }
                    "PRESENT" -> Unit
                    else -> {
                        reasons += "Belum tercatat hadir hari ini"
                        categories += "attendance"
                        score += 2
                    }
                }
            }

            if (isPrayerDayValid) {
                when (findByStudentIdentity(prayerToday, student)?.status) {
                    "PRAY", "PERMIT", "HALANGAN" -> Unit
                    else -> {
                        reasons += "Belum tercatat sholat hari ini"
                        categories += "prayer"
                        score += 1
                    }
                }
            }

            if (identityCandidates.none { literacySubmittersThisMonth.contains(it) }) {
                reasons += "Belum setor literasi bulan ini"
                categories += "literacy"
                score += 1
            }

            val violations = identityCandidates
                .flatMap { disciplineByStudent[it].orEmpty() }
                .distinctBy { it.id }
            if (violations.isNotEmpty()) {
                val points = violations.sumOf { it.points.coerceAtLeast(0) }
                reasons += "${violations.size} pelanggaran â€¢ ${points} poin"
                categories += "discipline"
                score += violations.size.coerceAtMost(3)
                if (points >= 20) score += 1
            }

            val activeBullyingCount = identityCandidates.sumOf { bullyingCountByStudent[it] ?: 0 }
            if (activeBullyingCount > 0) {
                reasons += "Terlibat ${activeBullyingCount} aduan aktif"
                categories += "bullying"
                score += 2
                if (activeBullyingCount > 1) score += 1
            }

            if (score <= 0) {
                null
            } else {
                PrincipalAttentionStudent(
                    nisn = student.nisn,
                    name = student.name,
                    className = student.className,
                    reasons = reasons.take(3),
                    score = score,
                    categories = categories
                )
            }
        }.sortedWith(
            compareByDescending<PrincipalAttentionStudent> { it.score }
                .thenBy { it.className }
                .thenBy { it.name }
        ).take(8)
    }

    private fun buildRecentActivities(
        logs: List<PrincipalLiteracyRecord>,
        reports: List<PrincipalLiteracyReportRecord>,
        studentMap: Map<String, PrincipalStudentRecord>
    ): List<PrincipalRecentActivity> {
        val logActivities = logs.map { log ->
            PrincipalRecentActivity(
                title = log.studentName,
                subtitle = "${log.taskTitle} â€¢ ${if (log.status == "reviewed") "Sudah direview" else "Menunggu review"}",
                timestampLabel = formatTimestamp(log.timestamp)
            ) to log.timestamp
        }
        val reportActivities = reports.map { report ->
            val studentName = studentMap[normalizeIdentity(report.studentId)]?.name ?: "Siswa"
            PrincipalRecentActivity(
                title = studentName,
                subtitle = "${report.taskTitle} â€¢ ${if (report.status == "reviewed") "Sudah direview" else "Menunggu review"}",
                timestampLabel = formatTimestamp(report.timestamp)
            ) to report.timestamp
        }

        return (logActivities + reportActivities)
            .sortedByDescending { it.second }
            .take(5)
            .map { it.first }
    }

    private fun buildLiteracySubmitters(
        logs: List<PrincipalLiteracyRecord>,
        reports: List<PrincipalLiteracyReportRecord>,
        range: Pair<Long, Long>
    ): Set<String> {
        return (
            logs.asSequence()
                .filter { it.timestamp in range.first..range.second }
                .map { normalizeIdentity(it.studentId) } +
                reports.asSequence()
                    .filter { it.timestamp in range.first..range.second }
                    .map { normalizeIdentity(it.studentId) }
            )
            .filter { it.isNotBlank() }
            .toSet()
    }

    private fun buildRecentIssues(
        disciplineLogs: List<PrincipalDisciplineRecord>,
        bullyingReports: List<PrincipalBullyingRecord>,
        studentMap: Map<String, PrincipalStudentRecord>
    ): List<PrincipalRecentIssue> {
        val disciplineIssues = disciplineLogs
            .sortedByDescending { it.date }
            .take(6)
            .map { log ->
                val student = studentMap[normalizeIdentity(log.studentId)]
                val studentName = log.studentName.ifBlank { student?.name ?: "Siswa" }
                val className = log.className.ifBlank { student?.className ?: "-" }
                PrincipalRecentIssue(
                    title = log.ruleName,
                    subtitle = "$studentName â€¢ $className",
                    badge = if (isDisciplineOpen(log)) "Follow Up" else "Selesai",
                    kind = "discipline",
                    timestamp = log.date,
                    timestampLabel = formatTimestamp(log.date)
                )
            }

        val bullyingIssues = bullyingReports
            .sortedByDescending { it.createdAt }
            .take(6)
            .map { report ->
                PrincipalRecentIssue(
                    title = if (report.category == "INCIDENT") "Laporan Peristiwa" else "Laporan Bullying",
                    subtitle = buildBullyingSubtitle(report, studentMap),
                    badge = when {
                        report.priority == "CRITICAL" -> "Kritis"
                        report.priority == "HIGH" -> "Tinggi"
                        isBullyingActive(report.status) -> "Aktif"
                        else -> "Selesai"
                    },
                    kind = "bullying",
                    timestamp = report.createdAt,
                    timestampLabel = formatTimestamp(report.createdAt)
                )
            }

        return (disciplineIssues + bullyingIssues)
            .sortedByDescending { it.timestamp }
            .take(8)
    }

    private fun latestAttendancePerStudent(logs: List<PrincipalAttendanceRecord>): Map<String, PrincipalAttendanceRecord> {
        val result = LinkedHashMap<String, PrincipalAttendanceRecord>()
        logs.sortedBy { it.date }.forEach { record ->
            val studentId = normalizeIdentity(record.studentId)
            if (studentId.isNotBlank()) {
                result[studentId] = record
            }
        }
        return result
    }

    private fun latestPrayerPerStudent(logs: List<PrincipalPrayerRecord>): Map<String, PrincipalPrayerRecord> {
        val result = LinkedHashMap<String, PrincipalPrayerRecord>()
        logs.sortedBy { it.date }.forEach { record ->
            val studentId = normalizeIdentity(record.studentId)
            if (studentId.isNotBlank()) {
                result[studentId] = record
            }
        }
        return result
    }

    private fun buildDayRange(now: Long): Pair<Long, Long> {
        val calendar = Calendar.getInstance().apply {
            timeInMillis = now
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val start = calendar.timeInMillis
        calendar.set(Calendar.HOUR_OF_DAY, 23)
        calendar.set(Calendar.MINUTE, 59)
        calendar.set(Calendar.SECOND, 59)
        calendar.set(Calendar.MILLISECOND, 999)
        return start to calendar.timeInMillis
    }

    private fun buildMonthRange(now: Long): Pair<Long, Long> {
        val calendar = Calendar.getInstance().apply {
            timeInMillis = now
            set(Calendar.DAY_OF_MONTH, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val start = calendar.timeInMillis
        calendar.add(Calendar.MONTH, 1)
        calendar.add(Calendar.MILLISECOND, -1)
        return start to calendar.timeInMillis
    }

    private fun buildMonthRange(year: Int, month: Int): Pair<Long, Long> {
        val safeMonth = month.coerceIn(1, 12)
        val calendar = Calendar.getInstance().apply {
            set(Calendar.YEAR, year)
            set(Calendar.MONTH, safeMonth - 1)
            set(Calendar.DAY_OF_MONTH, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val start = calendar.timeInMillis
        calendar.add(Calendar.MONTH, 1)
        calendar.add(Calendar.MILLISECOND, -1)
        return start to calendar.timeInMillis
    }

    private fun buildPrayerRecapDateKeys(
        monthRange: Pair<Long, Long>,
        selectedMonth: Int,
        selectedYear: Int,
        schedules: Map<Int, DayScheduleRule>,
        holidays: List<HolidayRule>
    ): List<String> {
        val result = mutableListOf<String>()
        val calendar = Calendar.getInstance().apply {
            timeInMillis = monthRange.first
            set(Calendar.DAY_OF_MONTH, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val today = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val currentMonth = today.get(Calendar.MONTH) + 1
        val currentYear = today.get(Calendar.YEAR)
        if (selectedYear > currentYear || (selectedYear == currentYear && selectedMonth > currentMonth)) {
            return emptyList()
        }
        val month = calendar.get(Calendar.MONTH)
        while (calendar.get(Calendar.MONTH) == month) {
            if (selectedYear == currentYear && selectedMonth == currentMonth && calendar.timeInMillis > today.timeInMillis) break
            if (isValidPrayerDay(calendar, schedules, holidays)) {
                result.add(toDateKey(calendar.timeInMillis))
            }
            calendar.add(Calendar.DAY_OF_MONTH, 1)
        }
        return result
    }

    private fun buildAttendanceRecapDateKeys(
        monthRange: Pair<Long, Long>,
        selectedMonth: Int,
        selectedYear: Int
    ): List<String> {
        val result = mutableListOf<String>()
        val calendar = Calendar.getInstance().apply {
            timeInMillis = monthRange.first
            set(Calendar.DAY_OF_MONTH, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val today = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val currentMonth = today.get(Calendar.MONTH) + 1
        val currentYear = today.get(Calendar.YEAR)
        if (selectedYear > currentYear || (selectedYear == currentYear && selectedMonth > currentMonth)) {
            return emptyList()
        }
        val month = calendar.get(Calendar.MONTH)
        while (calendar.get(Calendar.MONTH) == month) {
            if (selectedYear == currentYear && selectedMonth == currentMonth && calendar.timeInMillis > today.timeInMillis) break
            if (calendar.get(Calendar.DAY_OF_WEEK) != Calendar.SUNDAY) {
                result.add(toDateKey(calendar.timeInMillis))
            }
            calendar.add(Calendar.DAY_OF_MONTH, 1)
        }
        return result
    }

    private fun toDateKey(timestamp: Long): String {
        if (timestamp <= 0L) return ""
        return SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date(timestamp))
    }

    private fun canonicalStudentId(student: PrincipalStudentRecord): String {
        return studentIdentityCandidates(student).firstOrNull().orEmpty()
    }

    private fun buildStudentDateKey(studentId: String, dateKey: String): String {
        return "${normalizeIdentity(studentId)}__$dateKey"
    }

    private fun buildAttendanceRecapLogMap(
        students: List<PrincipalStudentRecord>,
        logs: List<PrincipalAttendanceRecord>,
        monthRange: Pair<Long, Long>,
        validDateKeys: Set<String>
    ): Map<String, PrincipalAttendanceRecord> {
        val candidateToCanonical = LinkedHashMap<String, String>()
        students.forEach { student ->
            val canonicalId = canonicalStudentId(student)
            if (canonicalId.isBlank()) return@forEach
            studentIdentityCandidates(student).forEach { candidate ->
                candidateToCanonical.putIfAbsent(candidate, canonicalId)
            }
        }

        val result = LinkedHashMap<String, PrincipalAttendanceRecord>()
        logs.asSequence()
            .filter { it.date in monthRange.first..monthRange.second }
            .forEach { log ->
                val canonicalId = candidateToCanonical[normalizeIdentity(log.studentId)] ?: return@forEach
                val dateKey = toDateKey(log.date)
                if (!validDateKeys.contains(dateKey)) return@forEach
                val rowKey = buildStudentDateKey(canonicalId, dateKey)
                val existing = result[rowKey]
                if (existing == null || attendanceRecapScore(log) >= attendanceRecapScore(existing)) {
                    result[rowKey] = log
                }
            }
        return result
    }

    private fun attendanceRecapScore(record: PrincipalAttendanceRecord): Long {
        return maxOf(record.updatedAt, record.createdAt, record.date)
    }

    private fun buildPrayerRecapLogMap(
        students: List<PrincipalStudentRecord>,
        logs: List<PrincipalPrayerRecord>,
        monthRange: Pair<Long, Long>,
        validDateKeys: Set<String>
    ): Map<String, PrincipalPrayerRecord> {
        val candidateToCanonical = LinkedHashMap<String, String>()
        students.forEach { student ->
            val canonicalId = canonicalStudentId(student)
            if (canonicalId.isBlank()) return@forEach
            studentIdentityCandidates(student).forEach { candidate ->
                candidateToCanonical.putIfAbsent(candidate, canonicalId)
            }
        }

        val result = LinkedHashMap<String, PrincipalPrayerRecord>()
        logs.asSequence()
            .filter { it.date in monthRange.first..monthRange.second }
            .forEach { log ->
                val canonicalId = candidateToCanonical[normalizeIdentity(log.studentId)] ?: return@forEach
                val dateKey = toDateKey(log.date)
                if (!validDateKeys.contains(dateKey)) return@forEach
                result[buildStudentDateKey(canonicalId, dateKey)] = log
            }
        return result
    }

    private fun buildWeekRange(now: Long): Pair<Long, Long> {
        val calendar = Calendar.getInstance().apply {
            timeInMillis = now
            firstDayOfWeek = Calendar.MONDAY
            set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val start = calendar.timeInMillis
        calendar.add(Calendar.DAY_OF_MONTH, 7)
        calendar.add(Calendar.MILLISECOND, -1)
        return start to calendar.timeInMillis
    }

    private fun normalizeIdentity(value: String?): String {
        return value?.trim().orEmpty()
    }

    private fun studentIdentityCandidates(student: PrincipalStudentRecord): List<String> {
        return listOf(
            normalizeIdentity(student.id),
            normalizeIdentity(student.nisn)
        ).filter { it.isNotBlank() }.distinct()
    }

    private fun buildStudentIdentityMap(students: List<PrincipalStudentRecord>): Map<String, PrincipalStudentRecord> {
        val map = LinkedHashMap<String, PrincipalStudentRecord>()
        students.forEach { student ->
            studentIdentityCandidates(student).forEach { candidate ->
                if (!map.containsKey(candidate)) {
                    map[candidate] = student
                }
            }
        }
        return map
    }

    private fun <T> findByStudentIdentity(
        records: Map<String, T>,
        student: PrincipalStudentRecord
    ): T? {
        studentIdentityCandidates(student).forEach { candidate ->
            records[candidate]?.let { return it }
        }
        return null
    }

    private fun normalizeScope(value: String?): String {
        return value?.trim()?.lowercase(Locale.ROOT).orEmpty()
    }

    private fun matchesScope(recordScope: String, sessionScope: String): Boolean {
        return recordScope.isNotBlank() && normalizeScope(recordScope) == normalizeScope(sessionScope)
    }

    private fun readString(snapshot: DataSnapshot, vararg keys: String): String {
        for (key in keys) {
            val value = snapshot.child(key).getValue(String::class.java)?.trim()
            if (!value.isNullOrEmpty()) return value
        }
        return ""
    }

    private fun readLong(snapshot: DataSnapshot, vararg keys: String): Long {
        for (key in keys) {
            val asLong = snapshot.child(key).getValue(Long::class.java)
            if (asLong != null) return asLong
            val asDouble = snapshot.child(key).getValue(Double::class.java)
            if (asDouble != null) return asDouble.toLong()
            val asString = snapshot.child(key).getValue(String::class.java)?.trim()
            val parsed = asString?.toLongOrNull()
            if (parsed != null) return parsed
        }
        return 0L
    }

    private fun readInt(snapshot: DataSnapshot, vararg keys: String): Int {
        for (key in keys) {
            val asInt = snapshot.child(key).getValue(Int::class.java)
            if (asInt != null) return asInt
            val asLong = snapshot.child(key).getValue(Long::class.java)
            if (asLong != null) return asLong.toInt()
            val asString = snapshot.child(key).getValue(String::class.java)?.trim()
            val parsed = asString?.toIntOrNull()
            if (parsed != null) return parsed
        }
        return 0
    }

    private fun formatTimestamp(timestamp: Long): String {
        if (timestamp <= 0L) return "-"
        val formatter = SimpleDateFormat("dd MMM yyyy, HH:mm", Locale("id", "ID"))
        return formatter.format(Date(timestamp))
    }

    private fun isDisciplineOpen(record: PrincipalDisciplineRecord): Boolean {
        val followUp = record.followUpStatus.uppercase(Locale.ROOT)
        val status = record.status.uppercase(Locale.ROOT)
        if (status == "REJECTED" || status == "CANCELLED") return false
        return followUp !in setOf("DONE", "CLOSED", "RESOLVED") && status !in setOf("DONE", "CLOSED", "RESOLVED")
    }

    private fun isBullyingActive(status: String): Boolean {
        return status.uppercase(Locale.ROOT) !in setOf("RESOLVED", "CLOSED")
    }

    private fun buildBullyingSubtitle(
        report: PrincipalBullyingRecord,
        studentMap: Map<String, PrincipalStudentRecord>
    ): String {
        val people = mutableListOf<String>()
        val victimName = report.victimName.ifBlank { studentMap[normalizeIdentity(report.victimId)]?.name.orEmpty() }
        val perpetratorName = report.perpetratorName.ifBlank { studentMap[normalizeIdentity(report.perpetratorId)]?.name.orEmpty() }
        val reporterName = report.reporterName.ifBlank { studentMap[normalizeIdentity(report.reporterId)]?.name.orEmpty() }
        if (victimName.isNotBlank()) people += "Korban: $victimName"
        if (perpetratorName.isNotBlank()) people += "Pelaku: $perpetratorName"
        if (people.isEmpty() && reporterName.isNotBlank()) {
            people += "Pelapor: $reporterName"
        }
        if (people.isEmpty()) {
            people += report.incidentType.replace('_', ' ')
        }
        return people.take(2).joinToString(" â€¢ ")
    }

    private fun clearListeners() {
        studentQuery?.let { query -> studentListener?.let { query.removeEventListener(it) } }
        attendanceQuery?.let { query -> attendanceListener?.let { query.removeEventListener(it) } }
        attendanceTodayQuery?.let { query -> attendanceTodayListener?.let { query.removeEventListener(it) } }
        prayerQuery?.let { query -> prayerListener?.let { query.removeEventListener(it) } }
        literacyQuery?.let { query -> literacyListener?.let { query.removeEventListener(it) } }
        literacyReportQuery?.let { query -> literacyReportListener?.let { query.removeEventListener(it) } }
        borrowQuery?.let { query -> borrowListener?.let { query.removeEventListener(it) } }
        taskQuery?.let { query -> taskListener?.let { query.removeEventListener(it) } }
        disciplineQuery?.let { query -> disciplineListener?.let { query.removeEventListener(it) } }
        bullyingQuery?.let { query -> bullyingListener?.let { query.removeEventListener(it) } }
        studentListener = null
        attendanceListener = null
        attendanceTodayListener = null
        prayerListener = null
        literacyListener = null
        literacyReportListener = null
        borrowListener = null
        taskListener = null
        disciplineListener = null
        bullyingListener = null
        studentQuery = null
        attendanceQuery = null
        attendanceTodayQuery = null
        prayerQuery = null
        literacyQuery = null
        literacyReportQuery = null
        borrowQuery = null
        taskQuery = null
        disciplineQuery = null
        bullyingQuery = null

        legacyAttendanceScheduleListener?.let { db.child("schedules").removeEventListener(it) }
        legacyPrayerScheduleListener?.let { db.child("prayer_schedules").removeEventListener(it) }
        legacyHolidayListener?.let { db.child("holidays").removeEventListener(it) }

        val scope = normalizeScope(_session.value.schoolId)
        if (scope.isNotBlank()) {
            scopedAttendanceScheduleListener?.let {
                db.child("school_settings").child(scope).child("attendance").child("schedules").removeEventListener(it)
            }
            scopedPrayerScheduleListener?.let {
                db.child("school_settings").child(scope).child("prayer").child("schedules").removeEventListener(it)
            }
            scopedHolidayListener?.let {
                db.child("school_settings").child(scope).child("attendance").child("holidays").removeEventListener(it)
            }
        }

        legacyAttendanceScheduleListener = null
        scopedAttendanceScheduleListener = null
        legacyPrayerScheduleListener = null
        scopedPrayerScheduleListener = null
        legacyHolidayListener = null
        scopedHolidayListener = null
    }

    private fun attachRuleListeners(scope: String) {
        legacyAttendanceScheduleListener?.let { db.child("schedules").removeEventListener(it) }
        legacyPrayerScheduleListener?.let { db.child("prayer_schedules").removeEventListener(it) }
        legacyHolidayListener?.let { db.child("holidays").removeEventListener(it) }
        if (scope.isNotBlank()) {
            scopedAttendanceScheduleListener?.let {
                db.child("school_settings").child(scope).child("attendance").child("schedules").removeEventListener(it)
            }
            scopedPrayerScheduleListener?.let {
                db.child("school_settings").child(scope).child("prayer").child("schedules").removeEventListener(it)
            }
            scopedHolidayListener?.let {
                db.child("school_settings").child(scope).child("attendance").child("holidays").removeEventListener(it)
            }
        }

        var legacyAttendanceSchedules: Map<Int, DayScheduleRule> = emptyMap()
        var scopedAttendanceSchedules: Map<Int, DayScheduleRule>? = null
        var legacyPrayerSchedules: Map<Int, DayScheduleRule> = emptyMap()
        var scopedPrayerSchedules: Map<Int, DayScheduleRule>? = null
        var legacyHolidays: List<HolidayRule> = emptyList()
        var scopedHolidays: List<HolidayRule>? = null

        fun applyAttendanceSchedules() {
            _attendanceSchedules.value = scopedAttendanceSchedules ?: legacyAttendanceSchedules
        }

        fun applyPrayerSchedules() {
            _prayerSchedules.value = scopedPrayerSchedules ?: legacyPrayerSchedules
        }

        fun applyHolidays() {
            _holidays.value = scopedHolidays ?: legacyHolidays
        }

        legacyAttendanceScheduleListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                legacyAttendanceSchedules = parseScheduleSnapshot(snapshot)
                applyAttendanceSchedules()
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        db.child("schedules").addValueEventListener(legacyAttendanceScheduleListener as ValueEventListener)

        legacyPrayerScheduleListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                legacyPrayerSchedules = parseScheduleSnapshot(snapshot)
                applyPrayerSchedules()
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        db.child("prayer_schedules").addValueEventListener(legacyPrayerScheduleListener as ValueEventListener)

        legacyHolidayListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                legacyHolidays = parseHolidaySnapshot(snapshot)
                applyHolidays()
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        db.child("holidays").addValueEventListener(legacyHolidayListener as ValueEventListener)

        if (scope.isBlank()) return

        scopedAttendanceScheduleListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                scopedAttendanceSchedules = if (snapshot.exists()) parseScheduleSnapshot(snapshot) else null
                applyAttendanceSchedules()
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        db.child("school_settings").child(scope).child("attendance").child("schedules")
            .addValueEventListener(scopedAttendanceScheduleListener as ValueEventListener)

        scopedPrayerScheduleListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                scopedPrayerSchedules = if (snapshot.exists()) parseScheduleSnapshot(snapshot) else null
                applyPrayerSchedules()
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        db.child("school_settings").child(scope).child("prayer").child("schedules")
            .addValueEventListener(scopedPrayerScheduleListener as ValueEventListener)

        scopedHolidayListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                scopedHolidays = if (snapshot.exists()) parseHolidaySnapshot(snapshot) else null
                applyHolidays()
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        db.child("school_settings").child(scope).child("attendance").child("holidays")
            .addValueEventListener(scopedHolidayListener as ValueEventListener)
    }

    override fun onCleared() {
        super.onCleared()
        clearListeners()
    }

    private data class PrincipalInputs(
        val session: PrincipalDashboardUiState,
        val students: List<PrincipalStudentRecord>,
        val attendanceLogsScoped: List<PrincipalAttendanceRecord> = emptyList(),
        val attendanceLogsTodayFallback: List<PrincipalAttendanceRecord> = emptyList(),
        val prayerLogs: List<PrincipalPrayerRecord> = emptyList(),
        val literacyLogs: List<PrincipalLiteracyRecord> = emptyList(),
        val literacyReports: List<PrincipalLiteracyReportRecord> = emptyList(),
        val borrowRecords: List<PrincipalBorrowRecord> = emptyList(),
        val tasks: List<PrincipalTaskRecord> = emptyList(),
        val disciplineRecords: List<PrincipalDisciplineRecord> = emptyList(),
        val bullyingReports: List<PrincipalBullyingRecord> = emptyList(),
        val attendanceSchedules: Map<Int, DayScheduleRule> = emptyMap(),
        val prayerSchedules: Map<Int, DayScheduleRule> = emptyMap(),
        val holidays: List<HolidayRule> = emptyList(),
        val selectedAttendanceRecapMonth: Int = Calendar.getInstance().get(Calendar.MONTH) + 1,
        val selectedAttendanceRecapYear: Int = Calendar.getInstance().get(Calendar.YEAR),
        val selectedPrayerRecapMonth: Int = Calendar.getInstance().get(Calendar.MONTH) + 1,
        val selectedPrayerRecapYear: Int = Calendar.getInstance().get(Calendar.YEAR)
    )
}

