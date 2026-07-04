package com.satupintu.mobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.satupintu.mobile.data.model.Attendance
import com.satupintu.mobile.data.model.DisciplineRecord
import com.satupintu.mobile.data.model.DisciplineRule
import com.satupintu.mobile.util.DayScheduleRule
import com.satupintu.mobile.util.HolidayRule
import com.satupintu.mobile.util.SecurityUtils
import com.satupintu.mobile.util.findHoliday
import com.satupintu.mobile.util.isValidSchoolDay
import com.satupintu.mobile.util.normalizeScope
import com.satupintu.mobile.util.parseHolidaySnapshot
import com.satupintu.mobile.util.parseScheduleSnapshot
import com.satupintu.mobile.util.resolveScheduleRule
import com.satupintu.mobile.util.toDateKey
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.*

data class DailyAttendanceSummary(
    val day: Int,
    val dayName: String,
    val status: String, // "H", "S", "I", "A", "-"
    val dateStr: String
)

data class MonthlyAttendanceSummary(
    val summaries: List<DailyAttendanceSummary>,
    val totalH: Int,
    val totalS: Int,
    val totalI: Int,
    val totalA: Int
)

sealed class AttendanceUiState {
    object Loading : AttendanceUiState()
    data class Success(
        val history: List<Attendance>,
        val todayAttendance: Attendance?,
        val todaySchedule: String,
        val isHoliday: Boolean,
        val studentName: String,
        val schoolLat: Double,
        val schoolLng: Double,
        val schoolRadius: Double = 100.0,
        val monthlySummary: MonthlyAttendanceSummary? = null, // Tambah rekap bulanan
        val errorMessage: String? = null // Add transient error message
    ) : AttendanceUiState()
    data class Error(val message: String) : AttendanceUiState()
}

class AttendanceViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<AttendanceUiState>(AttendanceUiState.Loading)
    val uiState: StateFlow<AttendanceUiState> = _uiState.asStateFlow()

    private val db = FirebaseDatabase.getInstance()
    private var currentStudentId: String? = null
    private var currentStudentName: String = ""
    private var currentSchoolId: String = ""
    private var currentEntryTime: String = "07:00" // Default entry time
    private var currentExitTime: String = "13:30" // Default exit time

    // Dynamic School Location (defaults match web dashboard)
    private var schoolLat = -7.6698
    private var schoolLng = 112.5432
    private var schoolRadius = 50.0 // meters

    // Local cache for reactive updates
    private var currentHistory: List<Attendance> = emptyList()
    private var currentTodayAttendance: Attendance? = null
    private var currentHolidayDescription: String? = null
    private var currentIsSpecificHoliday: Boolean = false
    private var currentMonthlySummary: MonthlyAttendanceSummary? = null
    private var currentSchedules: Map<Int, DayScheduleRule> = emptyMap()
    private var currentHolidays: List<HolidayRule> = emptyList()
    private var deviceTimeTrusted: Boolean = true

    private var historyListener: ValueEventListener? = null
    private var legacyLocationListener: ValueEventListener? = null
    private var scopedLocationListener: ValueEventListener? = null
    private var legacyHolidayListener: ValueEventListener? = null
    private var scopedHolidayListener: ValueEventListener? = null
    private var legacyScheduleListener: ValueEventListener? = null
    private var scopedScheduleListener: ValueEventListener? = null

    fun clearError() {
        val currentState = _uiState.value
        if (currentState is AttendanceUiState.Success) {
            _uiState.value = currentState.copy(errorMessage = null)
        }
    }

    fun loadData(nisn: String, username: String) {
        viewModelScope.launch {
            _uiState.value = AttendanceUiState.Loading
            detachAllListeners()
            
            val studentsRef = db.getReference("students")
            val query = if(nisn.isNotEmpty()) studentsRef.orderByChild("nisn").equalTo(nisn) else studentsRef.orderByChild("username").equalTo(username)
            
            query.addListenerForSingleValueEvent(object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    if (snapshot.exists()) {
                        val studentSnapshot = snapshot.children.first()
                        val studentKey = studentSnapshot.key ?: ""
                        currentStudentId = studentKey
                        currentStudentName = studentSnapshot.child("name").getValue(String::class.java) ?: "Siswa"
                        currentSchoolId = normalizeScope(studentSnapshot.child("schoolId").getValue(String::class.java))
                        
                        // Start listeners
                        attachRuleListeners()
                        loadAttendanceHistory(studentKey)
                    } else {
                        _uiState.value = AttendanceUiState.Error("Data siswa tidak ditemukan.")
                    }
                }
                override fun onCancelled(error: DatabaseError) {
                    _uiState.value = AttendanceUiState.Error(error.message)
                }
            })
        }
    }

    private fun attachRuleListeners() {
        var legacyLocationLoaded = false
        var scopedLocationLoaded = false
        var legacySchedules: Map<Int, DayScheduleRule> = emptyMap()
        var scopedSchedules: Map<Int, DayScheduleRule>? = null
        var legacyHolidays: List<HolidayRule> = emptyList()
        var scopedHolidays: List<HolidayRule>? = null

        fun applyLocation(snapshot: DataSnapshot, scoped: Boolean) {
            if (scoped) scopedLocationLoaded = snapshot.exists() else legacyLocationLoaded = snapshot.exists()
            val source = when {
                scopedLocationLoaded && scoped -> snapshot
                scopedLocationLoaded -> null
                !scoped && legacyLocationLoaded -> snapshot
                else -> null
            } ?: return

            if (source.exists()) {
                schoolLat = source.child("latitude").getValue(Double::class.java) ?: -7.6698
                schoolLng = source.child("longitude").getValue(Double::class.java) ?: 112.5432
                schoolRadius = source.child("radius").getValue(Double::class.java) ?: 50.0
            } else {
                schoolLat = -7.6698
                schoolLng = 112.5432
                schoolRadius = 50.0
            }
            updateUiState()
        }

        fun applySchedules() {
            currentSchedules = scopedSchedules ?: legacySchedules
            refreshRuleDerivedState()
        }

        fun applyHolidays() {
            currentHolidays = scopedHolidays ?: legacyHolidays
            refreshRuleDerivedState()
        }

        legacyLocationListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) = applyLocation(snapshot, scoped = false)
            override fun onCancelled(error: DatabaseError) {}
        }
        db.getReference("school_location").addValueEventListener(legacyLocationListener as ValueEventListener)

        legacyScheduleListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                legacySchedules = parseScheduleSnapshot(snapshot)
                applySchedules()
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        db.getReference("schedules").addValueEventListener(legacyScheduleListener as ValueEventListener)

        legacyHolidayListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                legacyHolidays = parseHolidaySnapshot(snapshot)
                applyHolidays()
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        db.getReference("holidays").addValueEventListener(legacyHolidayListener as ValueEventListener)

        if (currentSchoolId.isBlank()) return

        scopedLocationListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) = applyLocation(snapshot, scoped = true)
            override fun onCancelled(error: DatabaseError) {}
        }
        db.getReference("school_settings").child(currentSchoolId).child("attendance").child("school_location")
            .addValueEventListener(scopedLocationListener as ValueEventListener)

        scopedScheduleListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                scopedSchedules = if (snapshot.exists()) parseScheduleSnapshot(snapshot) else null
                applySchedules()
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        db.getReference("school_settings").child(currentSchoolId).child("attendance").child("schedules")
            .addValueEventListener(scopedScheduleListener as ValueEventListener)

        scopedHolidayListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                scopedHolidays = if (snapshot.exists()) parseHolidaySnapshot(snapshot) else null
                applyHolidays()
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        db.getReference("school_settings").child(currentSchoolId).child("attendance").child("holidays")
            .addValueEventListener(scopedHolidayListener as ValueEventListener)
    }

    private fun refreshRuleDerivedState() {
        val todayKey = toDateKey(System.currentTimeMillis())
        val holiday = findHoliday(currentHolidays, todayKey)
        currentHolidayDescription = holiday?.description?.ifBlank { "Libur Nasional" }
        currentIsSpecificHoliday = holiday != null
        currentMonthlySummary = calculateMonthlySummary(currentHistory)
        updateUiState(currentMonthlySummary)
    }

    private fun calculateMonthlySummary(history: List<Attendance>): MonthlyAttendanceSummary {
        val calendar = Calendar.getInstance()
        val currentMonth = calendar.get(Calendar.MONTH)
        val currentYear = calendar.get(Calendar.YEAR)
        val today = Calendar.getInstance()
        
        calendar.set(Calendar.YEAR, currentYear)
        calendar.set(Calendar.MONTH, currentMonth)
        calendar.set(Calendar.DAY_OF_MONTH, 1)
        
        val daysInMonth = calendar.getActualMaximum(Calendar.DAY_OF_MONTH)
        val summaries = mutableListOf<DailyAttendanceSummary>()
        var totalH = 0
        var totalS = 0
        var totalI = 0
        var totalA = 0
        
        val latestByDate = history
            .filter {
                val attCal = Calendar.getInstance().apply { timeInMillis = it.date }
                attCal.get(Calendar.YEAR) == currentYear && attCal.get(Calendar.MONTH) == currentMonth
            }
            .groupBy { toDateKey(it.date) }
            .mapValues { (_, records) -> records.maxByOrNull { it.date } }
        
        for (day in 1..daysInMonth) {
            calendar.set(Calendar.DAY_OF_MONTH, day)
            calendar.set(Calendar.HOUR_OF_DAY, 0)
            calendar.set(Calendar.MINUTE, 0)
            calendar.set(Calendar.SECOND, 0)
            calendar.set(Calendar.MILLISECOND, 0)
            
            val dayName = com.satupintu.mobile.util.formatIndonesianShortDay(calendar.time)
            val dateStr = toDateKey(calendar)
            
            if (!isValidSchoolDay(calendar, currentSchedules, currentHolidays)) {
                summaries.add(DailyAttendanceSummary(day, dayName, "-", dateStr))
                continue
            }
            
            val attendance = latestByDate[dateStr]
            
            val status = when (attendance?.status) {
                "PRESENT", "LATE" -> {
                    totalH++
                    "H"
                }
                "SICK" -> {
                    totalS++
                    "S"
                }
                "PERMIT" -> {
                    totalI++
                    "I"
                }
                "ABSENT" -> {
                    totalA++
                    "A"
                }
                else -> {
                    totalA++
                    "A"
                }
            }
            
            summaries.add(DailyAttendanceSummary(day, dayName, status, dateStr))
        }
        
        return MonthlyAttendanceSummary(summaries, totalH, totalS, totalI, totalA)
    }
    
    private fun loadAttendanceHistory(studentKey: String) {
        val attendanceRef = db.getReference("attendance")
        
        historyListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val history = mutableListOf<Attendance>()
                var todayAttendance: Attendance? = null
                
                val calendar = Calendar.getInstance()
                val todayStr = toDateKey(calendar)

                for (child in snapshot.children) {
                    val att = child.getValue(Attendance::class.java)
                    if (att != null) {
                        val attWithId = att.copy(id = child.key ?: "")
                        history.add(attWithId)
                        
                        val attDateStr = toDateKey(att.date)
                        if (attDateStr == todayStr) {
                            if (todayAttendance == null || attWithId.date >= (todayAttendance?.date ?: 0L)) {
                                todayAttendance = attWithId
                            }
                        }
                    }
                }
                
                history.sortByDescending { it.date }
                
                // Hitung rekap bulanan
                val monthlySummary = calculateMonthlySummary(history)
                currentMonthlySummary = monthlySummary
                
                currentHistory = history
                currentTodayAttendance = todayAttendance
                
                updateUiState(monthlySummary)
            }

            override fun onCancelled(error: DatabaseError) {
                _uiState.value = AttendanceUiState.Error("Gagal memuat riwayat absensi: ${error.message}")
            }
        }
        attendanceRef.orderByChild("studentId").equalTo(studentKey).addValueEventListener(historyListener as ValueEventListener)
    }
    
    private fun updateUiState(monthlySummary: MonthlyAttendanceSummary? = null) {
        val calendar = Calendar.getInstance()
        val dayOfWeek = calendar.get(Calendar.DAY_OF_WEEK)
        val summaryToUse = monthlySummary ?: currentMonthlySummary

        val todayRule = resolveScheduleRule(dayOfWeek, currentSchedules, "07:00", "13:30")
        currentEntryTime = todayRule.startTime.ifBlank { "07:00" }
        currentExitTime = todayRule.endTime.ifBlank { "13:30" }

        val isHoliday = !isValidSchoolDay(calendar, currentSchedules, currentHolidays)
        val todaySchedule = when {
            currentIsSpecificHoliday -> "Libur: ${currentHolidayDescription ?: "Libur Nasional"}"
            isHoliday -> "Libur"
            else -> "${currentEntryTime} - ${currentExitTime}"
        }

        _uiState.value = AttendanceUiState.Success(
            history = currentHistory,
            todayAttendance = currentTodayAttendance,
            todaySchedule = todaySchedule,
            isHoliday = isHoliday,
            studentName = currentStudentName,
            schoolLat = schoolLat,
            schoolLng = schoolLng,
            schoolRadius = schoolRadius,
            monthlySummary = summaryToUse
        )
    }

    fun checkIn(
        lat: Double,
        lng: Double,
        accuracyMeters: Float? = null,
        isMockLocation: Boolean = false,
        locationProvider: String? = null,
        deviceTimeTrusted: Boolean = true
    ) {
        val studentId = currentStudentId
        if (studentId == null) {
            val currentState = _uiState.value
            if (currentState is AttendanceUiState.Success) {
                _uiState.value = currentState.copy(errorMessage = "Gagal: ID Siswa tidak ditemukan. Silakan muat ulang.")
            }
            return
        }

        this.deviceTimeTrusted = deviceTimeTrusted

        if (!deviceTimeTrusted) {
            val currentState = _uiState.value
            val errorMsg = "Tanggal/jam perangkat tidak dipercaya. Aktifkan tanggal otomatis dan zona waktu otomatis."
            if (currentState is AttendanceUiState.Success) {
                _uiState.value = currentState.copy(errorMessage = errorMsg)
            } else {
                _uiState.value = AttendanceUiState.Error(errorMsg)
            }
            return
        }

        if (!SecurityUtils.isValidCoordinate(lat, lng)) {
            val currentState = _uiState.value
            val errorMsg = "Koordinat lokasi tidak valid. Aktifkan GPS lalu coba lagi."
            if (currentState is AttendanceUiState.Success) {
                _uiState.value = currentState.copy(errorMessage = errorMsg)
            } else {
                _uiState.value = AttendanceUiState.Error(errorMsg)
            }
            return
        }

        if (!SecurityUtils.isValidCoordinate(schoolLat, schoolLng)) {
            val currentState = _uiState.value
            val errorMsg = "Lokasi sekolah belum valid. Hubungi admin untuk memeriksa pengaturan geofence."
            if (currentState is AttendanceUiState.Success) {
                _uiState.value = currentState.copy(errorMessage = errorMsg)
            } else {
                _uiState.value = AttendanceUiState.Error(errorMsg)
            }
            return
        }

        if (isMockLocation) {
            val currentState = _uiState.value
            val errorMsg = "Lokasi palsu terdeteksi. Absensi diblokir."
            if (currentState is AttendanceUiState.Success) {
                _uiState.value = currentState.copy(errorMessage = errorMsg)
            } else {
                _uiState.value = AttendanceUiState.Error(errorMsg)
            }
            return
        }

        if (!isValidSchoolDay(Calendar.getInstance(), currentSchedules, currentHolidays)) {
            val currentState = _uiState.value
            val errorMsg = currentHolidayDescription?.let { "Hari ini libur: $it" } ?: "Hari ini bukan hari efektif absensi."
            if (currentState is AttendanceUiState.Success) {
                _uiState.value = currentState.copy(errorMessage = errorMsg)
            } else {
                _uiState.value = AttendanceUiState.Error(errorMsg)
            }
            return
        }
        
        val distance = calculateDistance(lat, lng, schoolLat, schoolLng)

        if (distance > schoolRadius) {
            val currentState = _uiState.value
            val errorMsg = "Jarak terlalu jauh (${distance.toInt()}m). Maksimal ${schoolRadius.toInt()}m dari sekolah.\n" +
                           "Pastikan Anda sudah berada di lingkungan sekolah."
            
            if (currentState is AttendanceUiState.Success) {
                 _uiState.value = currentState.copy(errorMessage = errorMsg)
            } else {
                 _uiState.value = AttendanceUiState.Error(errorMsg)
            }
            return
        }

        // Check if already checked in today
        val currentState = _uiState.value
        if (currentState is AttendanceUiState.Success) {
             val todayAtt = currentState.todayAttendance
             
             if (todayAtt != null) {
                 val status = todayAtt.status
                 
                 // If status is PRESENT or LATE, assume check-in is done, check for check-out
                 if (status == "PRESENT" || status == "LATE") {
                     if (todayAtt.checkOutTime == null) {
                         // Perform Check Out
                         performCheckOut(todayAtt)
                         return
                     } else {
                         _uiState.value = currentState.copy(errorMessage = "Anda sudah melakukan absen masuk dan pulang hari ini.")
                         return
                     }
                 } else {
                     // If status is ALPHA, SICK, PERMIT, or UNMARKED, allow override (Student arrived late/was wrongly marked)
                     // We update the EXISTING record instead of creating a new one.
                     performCheckIn(
                         studentId = studentId,
                         lat = lat,
                         lng = lng,
                         accuracyMeters = accuracyMeters,
                         isMockLocation = isMockLocation,
                         locationProvider = locationProvider,
                         existingId = todayAtt.id
                     )
                     return
                 }
             }
        }
        
        // Perform Check In (New Record)
        performCheckIn(
            studentId = studentId,
            lat = lat,
            lng = lng,
            accuracyMeters = accuracyMeters,
            isMockLocation = isMockLocation,
            locationProvider = locationProvider
        )
    }

    private fun performCheckIn(
        studentId: String,
        lat: Double,
        lng: Double,
        accuracyMeters: Float? = null,
        isMockLocation: Boolean = false,
        locationProvider: String? = null,
        existingId: String? = null
    ) {
        val ref = if (existingId != null) {
            db.getReference("attendance").child(existingId)
        } else {
            db.getReference("attendance").push()
        }
        
        val now = System.currentTimeMillis()
        
        // Calculate status based on currentEntryTime
        val calendar = Calendar.getInstance()
        val currentHour = calendar.get(Calendar.HOUR_OF_DAY)
        val currentMinute = calendar.get(Calendar.MINUTE)
        
        // Parse entry time (format "HH:mm")
        val entryParts = currentEntryTime.split(":")
        val entryHour = entryParts.getOrNull(0)?.toIntOrNull() ?: 7
        val entryMinute = entryParts.getOrNull(1)?.toIntOrNull() ?: 0
        
        val isLate = currentHour > entryHour || (currentHour == entryHour && currentMinute > entryMinute)
        val status = if (isLate) "LATE" else "PRESENT"
        val notes = if (isLate) "Mobile Check-in (Terlambat)" else "Mobile Check-in"

        // INTEGRATION: Auto-record Discipline Violation if Late
        if (isLate) {
            recordLatePenalty(studentId, now)
        }

        val attendance = Attendance(
            id = existingId ?: (ref.key ?: ""),
            studentId = studentId,
            schoolId = currentSchoolId,
            date = now,
            status = status,
            checkInTime = now.toString(), // Save as timestamp string for consistency
            checkInMethod = "MANUAL",
            notes = notes,
            recordedBy = "Student",
            latitude = lat,
            longitude = lng,
            locationAccuracyMeters = accuracyMeters,
            locationProvider = locationProvider,
            isMockLocation = isMockLocation,
            deviceTimeTrusted = deviceTimeTrusted
        )
        
        ref.setValue(attendance).addOnFailureListener {
            val currentState = _uiState.value
            if (currentState is AttendanceUiState.Success) {
                _uiState.value = currentState.copy(errorMessage = "Gagal check-in: ${it.message}")
            } else {
                _uiState.value = AttendanceUiState.Error("Gagal check-in: ${it.message}")
            }
        }
    }

    fun deleteAttendance(attendanceId: String) {
        viewModelScope.launch {
            db.getReference("attendance").child(attendanceId).removeValue()
                .addOnFailureListener {
                    val currentState = _uiState.value
                    if (currentState is AttendanceUiState.Success) {
                        _uiState.value = currentState.copy(errorMessage = "Gagal menghapus riwayat: ${it.message}")
                    }
                }
        }
    }

    private fun performCheckOut(attendance: Attendance) {
        val ref = db.getReference("attendance").child(attendance.id)
        val now = System.currentTimeMillis()
        
        val updatedAttendance = attendance.copy(
            checkOutTime = now.toString()
        )
        
        ref.setValue(updatedAttendance).addOnFailureListener {
            val currentState = _uiState.value
            if (currentState is AttendanceUiState.Success) {
                _uiState.value = currentState.copy(errorMessage = "Gagal check-out: ${it.message}")
            } else {
                _uiState.value = AttendanceUiState.Error("Gagal check-out: ${it.message}")
            }
        }
    }

    // Manual Haversine formula calculation (Adopting from reference project)
    private fun calculateDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val R = 6371000.0 // Earth radius in meters
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2)
        val c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return R * c
    }

    private fun recordLatePenalty(studentId: String, date: Long) {
        // Search for "Terlambat" rule
        db.getReference("discipline_rules").addListenerForSingleValueEvent(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                if (snapshot.exists()) {
                    // Manual filter since we can't easily query partial strings on all fields efficiently without indexing
                    // But assuming small ruleset, client-side filter is fine.
                    val rules = snapshot.children.mapNotNull { it.getValue(DisciplineRule::class.java) }
                    val lateRule = rules.find { it.ruleName.contains("Terlambat", ignoreCase = true) }
                    
                    if (lateRule != null) {
                        savePenalty(studentId, lateRule, date)
                    }
                }
            }
            override fun onCancelled(error: DatabaseError) {}
        })
    }

    private fun savePenalty(studentId: String, rule: DisciplineRule, date: Long) {
        val ref = db.getReference("discipline_records")
        // Generate unique key
        val recordId = ref.push().key ?: return
        
        val record = DisciplineRecord(
            id = recordId,
            studentId = studentId,
            ruleId = rule.id,
            date = date,
            points = rule.points,
            description = "Otomatis: ${rule.ruleName}",
            recordedBy = "System (Attendance)",
            status = "APPROVED"
        )
        
        ref.child(recordId).setValue(record)
    }

    private fun detachAllListeners() {
        historyListener?.let {
            currentStudentId?.let { studentId ->
                db.getReference("attendance").orderByChild("studentId").equalTo(studentId).removeEventListener(it)
            }
        }
        legacyLocationListener?.let { db.getReference("school_location").removeEventListener(it) }
        legacyHolidayListener?.let { db.getReference("holidays").removeEventListener(it) }
        legacyScheduleListener?.let { db.getReference("schedules").removeEventListener(it) }

        if (currentSchoolId.isNotBlank()) {
            scopedLocationListener?.let {
                db.getReference("school_settings").child(currentSchoolId).child("attendance").child("school_location")
                    .removeEventListener(it)
            }
            scopedHolidayListener?.let {
                db.getReference("school_settings").child(currentSchoolId).child("attendance").child("holidays")
                    .removeEventListener(it)
            }
            scopedScheduleListener?.let {
                db.getReference("school_settings").child(currentSchoolId).child("attendance").child("schedules")
                    .removeEventListener(it)
            }
        }

        historyListener = null
        legacyLocationListener = null
        scopedLocationListener = null
        legacyHolidayListener = null
        scopedHolidayListener = null
        legacyScheduleListener = null
        scopedScheduleListener = null
    }

    override fun onCleared() {
        super.onCleared()
        detachAllListeners()
    }
}

