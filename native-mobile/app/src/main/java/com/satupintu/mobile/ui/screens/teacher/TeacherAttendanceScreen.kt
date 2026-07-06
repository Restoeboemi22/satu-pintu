package com.satupintu.mobile.ui.screens.teacher

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.satupintu.mobile.ui.viewmodel.StudentAttendanceItem
import com.satupintu.mobile.data.model.Teacher
import com.satupintu.mobile.ui.viewmodel.TeacherAttendanceViewModel
import androidx.compose.ui.platform.LocalContext
import android.app.DatePickerDialog
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.text.SimpleDateFormat

private val ATTENDANCE_TABLE_NO_WIDTH = 44.dp
private val ATTENDANCE_TABLE_STATUS_WIDTH = 176.dp
private val ATTENDANCE_TABLE_BORDER_COLOR = Color(0xFFD0D7DE)
private val ATTENDANCE_TABLE_BORDER_WIDTH = 1.dp
private val ATTENDANCE_TABLE_HEADER_COLOR = Color(0xFF1565C0)
private val ATTENDANCE_TABLE_ROW_COLOR = Color.White
private val ATTENDANCE_TABLE_ROW_ALT_COLOR = Color(0xFFF6F8FA)
private val ATTENDANCE_TABLE_ROW_HEIGHT = 48.dp
private val ATTENDANCE_TABLE_DIVIDER_COLOR = Color.White.copy(alpha = 0.24f)

private val LenteraPageBrush = Brush.verticalGradient(
    colors = listOf(Color(0xFF12D6C6), Color(0xFF0F7BFF), Color(0xFF0F2A43))
)

private val LenteraHeaderBrush = Brush.horizontalGradient(
    colors = listOf(Color(0xFF0F2A43), Color(0xFF0F7BFF))
)

private val LenteraGlassCard = Color(0xFF0B1F33).copy(alpha = 0.22f)
private val LenteraGlassStrong = Color(0xFF0B1F33).copy(alpha = 0.38f)
private val LenteraGlassBorder = Color.White.copy(alpha = 0.18f)
private val LenteraTextSecondary = Color.White.copy(alpha = 0.78f)
private val LenteraAccent = Color(0xFF93C5FD)
private val LenteraAccentStrong = Color(0xFF12D6C6)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LenteraTopBar(
    title: String,
    subtitle: String,
    onBack: () -> Unit
) {
    Box(modifier = Modifier.fillMaxWidth().background(LenteraHeaderBrush)) {
        TopAppBar(
            title = {
                Column {
                    Text(title, fontWeight = FontWeight.Bold)
                    Text(subtitle, style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.8f))
                }
            },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = Color.Transparent,
                titleContentColor = Color.White,
                navigationIconContentColor = Color.White
            )
        )
    }
}

@Composable
private fun LenteraGlassCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = LenteraGlassCard),
        border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder)
    ) {
        Column(content = content)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TeacherAttendanceScreen(
    teacherNuptk: String,
    onBack: () -> Unit,
    viewModel: TeacherAttendanceViewModel = viewModel()
) {
    val attendanceList by viewModel.attendanceList.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val selectedDate by viewModel.selectedDate.collectAsState()
    val teacher by viewModel.teacher.collectAsState()
    val selectedMonth by viewModel.selectedMonth.collectAsState()
    val selectedYear by viewModel.selectedYear.collectAsState()
    val monthlyRecap by viewModel.monthlyRecap.collectAsState()

    var selectedTabIndex by remember { mutableIntStateOf(0) }
    val tabs = listOf("Monitoring Harian", "Rekap Bulanan")

    LaunchedEffect(teacherNuptk) {
        if (teacherNuptk.isNotEmpty()) viewModel.setTeacherNuptk(teacherNuptk)
    }
    val context = LocalContext.current
    val calendar = Calendar.getInstance().apply { timeInMillis = selectedDate }
    val datePickerDialog = DatePickerDialog(
        context,
        { _, year, month, dayOfMonth ->
            val newCalendar = Calendar.getInstance()
            newCalendar.set(year, month, dayOfMonth)
            viewModel.setDate(newCalendar.timeInMillis)
        },
        calendar.get(Calendar.YEAR),
        calendar.get(Calendar.MONTH),
        calendar.get(Calendar.DAY_OF_MONTH)
    )
    val dateFormatter = SimpleDateFormat("EEEE, dd MMMM yyyy", Locale("id", "ID"))
    var showNoteDialog by remember { mutableStateOf(false) }
    var selectedStudentId by remember { mutableStateOf<String?>(null) }
    var noteText by remember { mutableStateOf("") }
    val manualSelections = remember { mutableStateMapOf<String, String>() }
    var isSubmittingManual by remember { mutableStateOf(false) }

    LaunchedEffect(attendanceList, selectedDate) {
        val validIds = attendanceList.map { attendanceIdentityKey(it.student.id, it.student.nisn) }.toSet()
        val invalidIds = manualSelections.keys.filter { it !in validIds }
        invalidIds.forEach { manualSelections.remove(it) }
    }

    val effectiveStats = remember(attendanceList, manualSelections.toMap()) {
        mapOf(
            "PRESENT" to countEffectiveAttendanceStatuses(attendanceList, manualSelections.toMap(), "PRESENT"),
            "SICK" to countEffectiveAttendanceStatuses(attendanceList, manualSelections.toMap(), "SICK"),
            "PERMIT" to countEffectiveAttendanceStatuses(attendanceList, manualSelections.toMap(), "PERMIT"),
            "ABSENT" to countEffectiveAttendanceStatuses(attendanceList, manualSelections.toMap(), "ABSENT")
        )
    }

    if (showNoteDialog) {
        AlertDialog(
            onDismissRequest = { showNoteDialog = false },
            title = { Text("Catatan Absensi", color = Color.White) },
            text = {
                OutlinedTextField(
                    value = noteText,
                    onValueChange = { noteText = it },
                    label = { Text("Keterangan", color = LenteraTextSecondary) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color.White.copy(alpha = 0.42f),
                        unfocusedBorderColor = LenteraGlassBorder,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedContainerColor = LenteraGlassCard,
                        unfocusedContainerColor = LenteraGlassCard,
                        cursorColor = Color.White
                    ),
                    shape = RoundedCornerShape(16.dp)
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        selectedStudentId?.let { id -> viewModel.updateNote(id, noteText) }
                        showNoteDialog = false
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = Color.White)
                ) { Text("Simpan") }
            },
            dismissButton = {
                TextButton(onClick = { showNoteDialog = false }, colors = ButtonDefaults.textButtonColors(contentColor = Color.White)) { Text("Batal") }
            },
            containerColor = Color(0xFF0F2A43),
            shape = RoundedCornerShape(20.dp)
        )
    }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            LenteraTopBar(
                title = "Rekapitulasi Kehadiran",
                subtitle = "Wali Kelas ${teacher?.homeroomClass ?: "..."}",
                onBack = onBack
            )
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().background(LenteraPageBrush).padding(padding)) {
            Column(modifier = Modifier.fillMaxSize()) {
                TabRow(
                    selectedTabIndex = selectedTabIndex,
                    containerColor = Color.Transparent,
                    contentColor = Color.White
                ) {
                    tabs.forEachIndexed { index, title ->
                        Tab(
                            selected = selectedTabIndex == index,
                            onClick = { selectedTabIndex = index },
                            selectedContentColor = Color.White,
                            unselectedContentColor = Color.White.copy(alpha = 0.7f),
                            text = { Text(title) }
                        )
                    }
                }

                if (selectedTabIndex == 0) {
                    DailyMonitoringContent(
                        teacher = teacher,
                        dateFormatter = dateFormatter,
                        selectedDate = selectedDate,
                        onDateClick = { datePickerDialog.show() },
                        attendanceStats = effectiveStats,
                        attendanceList = attendanceList,
                        isLoading = isLoading,
                        manualSelections = manualSelections.toMap(),
                        isSubmitting = isSubmittingManual,
                        onMarkAllPresent = {
                            attendanceList.forEach { item ->
                                manualSelections[attendanceIdentityKey(item.student.id, item.student.nisn)] = "PRESENT"
                            }
                        },
                        onStatusChange = { item, status ->
                            val baseStatus = item.status
                            val studentKey = attendanceIdentityKey(item.student.id, item.student.nisn)
                            val currentEffectiveStatus = manualSelections[studentKey] ?: baseStatus
                            when {
                                currentEffectiveStatus == status && baseStatus == status -> manualSelections[studentKey] = "UNMARKED"
                                currentEffectiveStatus == status -> manualSelections.remove(studentKey)
                                else -> manualSelections[studentKey] = status
                            }
                        },
                        onSubmitManual = {
                            val pendingSelections = manualSelections.toMap()
                            if (pendingSelections.isEmpty()) return@DailyMonitoringContent
                            isSubmittingManual = true
                            viewModel.saveAttendanceSelections(pendingSelections) { success ->
                                isSubmittingManual = false
                                if (success) manualSelections.clear()
                            }
                        },
                        onEditNote = { id, note ->
                            selectedStudentId = id
                            noteText = note
                            showNoteDialog = true
                        }
                    )
                } else {
                    MonthlyRecapContent(
                        teacher = teacher,
                        selectedMonth = selectedMonth,
                        selectedYear = selectedYear,
                        monthlyRecap = monthlyRecap,
                        attendanceList = attendanceList,
                        onMonthChange = { viewModel.setMonth(it) },
                        onYearChange = { viewModel.setYear(it) }
                    )
                }
            }
        }
    }
}

@Composable
fun MonthlyRecapContent(
    teacher: Teacher?,
    selectedMonth: Int,
    selectedYear: Int,
    monthlyRecap: Map<String, Map<String, Int>>,
    attendanceList: List<StudentAttendanceItem>,
    onMonthChange: (Int) -> Unit,
    onYearChange: (Int) -> Unit
) {
    val months = listOf("Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember")
    var yearExpanded by remember { mutableStateOf(false) }
    var monthExpanded by remember { mutableStateOf(false) }

    Column(modifier = Modifier.padding(16.dp)) {
        LenteraGlassCard(modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp)) {
            Row(modifier = Modifier.padding(16.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Box(modifier = Modifier.weight(1f)) {
                    OutlinedButton(
                        onClick = { monthExpanded = true },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                        border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder),
                        shape = RoundedCornerShape(16.dp)
                    ) { Text(months.getOrElse(selectedMonth) { "Pilih Bulan" }) }
                    DropdownMenu(expanded = monthExpanded, onDismissRequest = { monthExpanded = false }) {
                        months.forEachIndexed { index, name ->
                            DropdownMenuItem(text = { Text(name) }, onClick = { onMonthChange(index); monthExpanded = false })
                        }
                    }
                }
                Box(modifier = Modifier.weight(1f)) {
                    OutlinedButton(
                        onClick = { yearExpanded = true },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                        border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder),
                        shape = RoundedCornerShape(16.dp)
                    ) { Text(selectedYear.toString()) }
                    DropdownMenu(expanded = yearExpanded, onDismissRequest = { yearExpanded = false }) {
                        val currentYear = Calendar.getInstance().get(Calendar.YEAR)
                        ((currentYear - 2)..(currentYear + 2)).forEach { year ->
                            DropdownMenuItem(text = { Text(year.toString()) }, onClick = { onYearChange(year); yearExpanded = false })
                        }
                    }
                }
            }
        }

        LenteraGlassCard(modifier = Modifier.fillMaxWidth()) {
            Column {
                AttendanceMonthlyHeader()
                HorizontalDivider(color = ATTENDANCE_TABLE_DIVIDER_COLOR, thickness = 1.dp)
                LazyColumn {
                    itemsIndexed(attendanceList) { index, item ->
                        val student = item.student
                        val stats = monthlyRecap[attendanceIdentityKey(student.id, student.nisn)]
                            ?: mapOf("PRESENT" to 0, "SICK" to 0, "PERMIT" to 0, "ABSENT" to 0)
                        AttendanceMonthlyRow(index = index + 1, item = item, stats = stats)
                        if (index != attendanceList.lastIndex) HorizontalDivider(thickness = 1.dp, color = ATTENDANCE_TABLE_DIVIDER_COLOR)
                    }
                }
            }
        }
    }
}

@Composable
fun DailyMonitoringContent(
    teacher: Teacher?,
    dateFormatter: SimpleDateFormat,
    selectedDate: Long,
    onDateClick: () -> Unit,
    attendanceStats: Map<String, Int>,
    attendanceList: List<StudentAttendanceItem>,
    manualSelections: Map<String, String>,
    isLoading: Boolean,
    isSubmitting: Boolean,
    onMarkAllPresent: () -> Unit,
    onStatusChange: (StudentAttendanceItem, String) -> Unit,
    onSubmitManual: () -> Unit,
    onEditNote: (String, String) -> Unit
) {
    Column(modifier = Modifier.padding(16.dp)) {
        LenteraGlassCard(modifier = Modifier.fillMaxWidth().clickable { onDateClick() }) {
            Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.DateRange, contentDescription = null, tint = Color.White)
                Spacer(modifier = Modifier.width(16.dp))
                Column {
                    Text("Tanggal Absensi", style = MaterialTheme.typography.labelSmall, color = LenteraTextSecondary)
                    Text(text = dateFormatter.format(Date(selectedDate)), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            StatCard("Hadir", attendanceStats["PRESENT"] ?: 0)
            StatCard("Sakit", attendanceStats["SICK"] ?: 0)
            StatCard("Izin", attendanceStats["PERMIT"] ?: 0)
            StatCard("Alpa", attendanceStats["ABSENT"] ?: 0)
        }

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = onMarkAllPresent,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.16f)),
            shape = RoundedCornerShape(16.dp)
        ) { Text("Tandai Semua Hadir", color = Color.White, fontWeight = FontWeight.Bold) }

        Spacer(modifier = Modifier.height(12.dp))

        Button(
            onClick = onSubmitManual,
            modifier = Modifier.fillMaxWidth(),
            enabled = manualSelections.isNotEmpty() && !isSubmitting,
            colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.16f)),
            shape = RoundedCornerShape(16.dp)
        ) { Text(if (isSubmitting) "Menyimpan..." else "Simpan Presensi Manual", color = Color.White, fontWeight = FontWeight.Bold) }

        Spacer(modifier = Modifier.height(8.dp))
        Text("Centang ulang status yang sama untuk membatalkan pilihan manual.", style = MaterialTheme.typography.labelSmall, color = LenteraTextSecondary)

        Spacer(modifier = Modifier.height(16.dp))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxWidth().height(200.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Color.White) }
        } else {
            if (attendanceList.isEmpty()) {
                Box(modifier = Modifier.fillMaxWidth().height(100.dp), contentAlignment = Alignment.Center) { Text("Tidak ada data siswa", style = MaterialTheme.typography.bodyLarge, color = Color.White) }
            } else {
                LenteraGlassCard(modifier = Modifier.fillMaxWidth()) {
                    Column {
                        AttendanceDailyHeader()
                        HorizontalDivider(color = ATTENDANCE_TABLE_DIVIDER_COLOR, thickness = 1.dp)
                        LazyColumn(contentPadding = PaddingValues(bottom = 16.dp)) {
                            itemsIndexed(attendanceList) { index, item ->
                                AttendanceTableRow(
                                    index = index + 1,
                                    item = item,
                                    effectiveStatus = manualSelections[attendanceIdentityKey(item.student.id, item.student.nisn)] ?: item.status,
                                    onStatusChange = { status -> onStatusChange(item, status) }
                                )
                                if (index != attendanceList.lastIndex) HorizontalDivider(color = ATTENDANCE_TABLE_DIVIDER_COLOR, thickness = 1.dp)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AttendanceDailyHeader() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.1f)),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AttendanceHeaderCell(text = "NO", modifier = Modifier.width(ATTENDANCE_TABLE_NO_WIDTH).height(ATTENDANCE_TABLE_ROW_HEIGHT), withRightBorder = true)
        AttendanceHeaderCell(text = "NAMA SISWA", modifier = Modifier.weight(1f).height(ATTENDANCE_TABLE_ROW_HEIGHT), textAlign = TextAlign.Start, horizontalPadding = 12.dp, withRightBorder = true)
        Row(modifier = Modifier.width(ATTENDANCE_TABLE_STATUS_WIDTH).height(ATTENDANCE_TABLE_ROW_HEIGHT), verticalAlignment = Alignment.CenterVertically) {
            AttendanceHeaderCell(text = "H", modifier = Modifier.weight(1f).fillMaxHeight(), withRightBorder = true)
            AttendanceHeaderCell(text = "S", modifier = Modifier.weight(1f).fillMaxHeight(), withRightBorder = true)
            AttendanceHeaderCell(text = "I", modifier = Modifier.weight(1f).fillMaxHeight(), withRightBorder = true)
            AttendanceHeaderCell(text = "A", modifier = Modifier.weight(1f).fillMaxHeight())
        }
    }
}

@Composable
fun AttendanceTableRow(index: Int, item: StudentAttendanceItem, effectiveStatus: String, onStatusChange: (String) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().height(ATTENDANCE_TABLE_ROW_HEIGHT), verticalAlignment = Alignment.CenterVertically) {
        AttendanceTextCell(text = index.toString(), modifier = Modifier.width(ATTENDANCE_TABLE_NO_WIDTH).fillMaxHeight(), textAlign = TextAlign.Center, withRightBorder = true)
        Column(modifier = Modifier.weight(1f).fillMaxHeight().padding(horizontal = 12.dp, vertical = 3.dp), verticalArrangement = Arrangement.Center) {
            Text(text = item.student.name, style = MaterialTheme.typography.bodySmall.copy(lineHeight = 14.sp), fontWeight = FontWeight.SemiBold, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(text = item.student.nisn, style = MaterialTheme.typography.labelSmall.copy(lineHeight = 12.sp), color = LenteraTextSecondary, maxLines = 1)
        }
        AttendanceColumnDivider(modifier = Modifier.fillMaxHeight())
        Row(modifier = Modifier.width(ATTENDANCE_TABLE_STATUS_WIDTH).fillMaxHeight(), verticalAlignment = Alignment.CenterVertically) {
            CompactAttendanceOption(isSelected = effectiveStatus == "PRESENT", color = Color(0xFF4CAF50), onClick = { onStatusChange("PRESENT") }, withRightBorder = true)
            CompactAttendanceOption(isSelected = effectiveStatus == "SICK", color = Color(0xFF2196F3), onClick = { onStatusChange("SICK") }, withRightBorder = true)
            CompactAttendanceOption(isSelected = effectiveStatus == "PERMIT", color = Color(0xFFFF9800), onClick = { onStatusChange("PERMIT") }, withRightBorder = true)
            CompactAttendanceOption(isSelected = effectiveStatus == "ABSENT", color = Color(0xFFF44336), onClick = { onStatusChange("ABSENT") }, withRightBorder = false)
        }
    }
}

@Composable
fun RowScope.CompactAttendanceOption(isSelected: Boolean, color: Color, onClick: () -> Unit, withRightBorder: Boolean = true) {
    Box(modifier = Modifier.weight(1f).fillMaxHeight().clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        if (isSelected) Icon(imageVector = Icons.Default.Check, contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
        if (withRightBorder) AttendanceColumnDivider(modifier = Modifier.align(Alignment.CenterEnd))
    }
}

private fun countEffectiveAttendanceStatuses(items: List<StudentAttendanceItem>, manualSelections: Map<String, String>, status: String): Int {
    return items.count { item ->
        val effectiveStatus = manualSelections[attendanceIdentityKey(item.student.id, item.student.nisn)] ?: item.status
        effectiveStatus == status
    }
}

private fun attendanceIdentityKey(studentId: String?, studentNisn: String?): String {
    return listOf(studentId, studentNisn)
        .map { it?.trim().orEmpty() }
        .firstOrNull { it.isNotBlank() }
        .orEmpty()
}

@Composable
fun AttendanceMonthlyHeader() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.1f)),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AttendanceHeaderCell(text = "NO", modifier = Modifier.width(ATTENDANCE_TABLE_NO_WIDTH).height(ATTENDANCE_TABLE_ROW_HEIGHT), withRightBorder = true)
        AttendanceHeaderCell(text = "NAMA SISWA", modifier = Modifier.weight(1f).height(ATTENDANCE_TABLE_ROW_HEIGHT), textAlign = TextAlign.Start, horizontalPadding = 12.dp, withRightBorder = true)
        Row(modifier = Modifier.width(ATTENDANCE_TABLE_STATUS_WIDTH).height(ATTENDANCE_TABLE_ROW_HEIGHT), verticalAlignment = Alignment.CenterVertically) {
            AttendanceHeaderCell(text = "H", modifier = Modifier.weight(1f).fillMaxHeight(), withRightBorder = true)
            AttendanceHeaderCell(text = "S", modifier = Modifier.weight(1f).fillMaxHeight(), withRightBorder = true)
            AttendanceHeaderCell(text = "I", modifier = Modifier.weight(1f).fillMaxHeight(), withRightBorder = true)
            AttendanceHeaderCell(text = "A", modifier = Modifier.weight(1f).fillMaxHeight())
        }
    }
}

@Composable
fun AttendanceMonthlyRow(index: Int, item: StudentAttendanceItem, stats: Map<String, Int>) {
    Row(modifier = Modifier.fillMaxWidth().height(ATTENDANCE_TABLE_ROW_HEIGHT), verticalAlignment = Alignment.CenterVertically) {
        AttendanceTextCell(text = index.toString(), modifier = Modifier.width(ATTENDANCE_TABLE_NO_WIDTH).fillMaxHeight(), textAlign = TextAlign.Center, withRightBorder = true)
        Column(modifier = Modifier.weight(1f).fillMaxHeight().padding(horizontal = 12.dp, vertical = 3.dp), verticalArrangement = Arrangement.Center) {
            Text(text = item.student.name, style = MaterialTheme.typography.bodySmall.copy(lineHeight = 14.sp), fontWeight = FontWeight.SemiBold, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(text = item.student.nisn, style = MaterialTheme.typography.labelSmall.copy(lineHeight = 12.sp), color = LenteraTextSecondary, maxLines = 1)
        }
        AttendanceColumnDivider(modifier = Modifier.fillMaxHeight())
        Row(modifier = Modifier.width(ATTENDANCE_TABLE_STATUS_WIDTH).fillMaxHeight(), verticalAlignment = Alignment.CenterVertically) {
            AttendanceTextCell(text = (stats["PRESENT"] ?: 0).toString(), modifier = Modifier.weight(1f).fillMaxHeight(), textAlign = TextAlign.Center, withRightBorder = true)
            AttendanceTextCell(text = (stats["SICK"] ?: 0).toString(), modifier = Modifier.weight(1f).fillMaxHeight(), textAlign = TextAlign.Center, withRightBorder = true)
            AttendanceTextCell(text = (stats["PERMIT"] ?: 0).toString(), modifier = Modifier.weight(1f).fillMaxHeight(), textAlign = TextAlign.Center, withRightBorder = true)
            AttendanceTextCell(text = (stats["ABSENT"] ?: 0).toString(), modifier = Modifier.weight(1f).fillMaxHeight(), textAlign = TextAlign.Center)
        }
    }
}

@Composable
fun AttendanceHeaderCell(text: String, modifier: Modifier, textAlign: TextAlign = TextAlign.Center, horizontalPadding: androidx.compose.ui.unit.Dp = 0.dp, withRightBorder: Boolean = false) {
    Box(modifier = modifier, contentAlignment = when (textAlign) { TextAlign.Start -> Alignment.CenterStart; TextAlign.End -> Alignment.CenterEnd; else -> Alignment.Center }) {
        Text(text = text, modifier = Modifier.padding(horizontal = horizontalPadding), textAlign = textAlign, fontWeight = FontWeight.Bold, color = Color.White, style = MaterialTheme.typography.bodySmall)
        if (withRightBorder) AttendanceColumnDivider(modifier = Modifier.align(Alignment.CenterEnd), color = ATTENDANCE_TABLE_DIVIDER_COLOR)
    }
}

@Composable
fun AttendanceTextCell(text: String, modifier: Modifier, textAlign: TextAlign = TextAlign.Center, withRightBorder: Boolean = false) {
    Box(modifier = modifier, contentAlignment = when (textAlign) { TextAlign.Start -> Alignment.CenterStart; TextAlign.End -> Alignment.CenterEnd; else -> Alignment.Center }) {
        Text(text = text, modifier = Modifier.padding(horizontal = 6.dp), textAlign = textAlign, color = Color.White, style = MaterialTheme.typography.bodySmall)
        if (withRightBorder) AttendanceColumnDivider(modifier = Modifier.align(Alignment.CenterEnd))
    }
}

@Composable
fun AttendanceColumnDivider(modifier: Modifier = Modifier, color: Color = ATTENDANCE_TABLE_DIVIDER_COLOR) {
    Box(modifier = modifier.fillMaxHeight().width(ATTENDANCE_TABLE_BORDER_WIDTH).background(color))
}

@Composable
fun StatCard(label: String, count: Int, bgColor: Color = Color.Transparent, textColor: Color = Color.White) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.15f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.size(width = 80.dp, height = 70.dp)
    ) {
        Column(modifier = Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Text(text = count.toString(), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Color.White)
            Text(text = label, style = MaterialTheme.typography.labelSmall, color = LenteraTextSecondary)
        }
    }
}

