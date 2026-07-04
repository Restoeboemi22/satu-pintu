package com.satupintu.mobile.ui.screens.teacher

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.satupintu.mobile.data.model.Teacher
import com.satupintu.mobile.data.model.TeacherHabitRubric
import com.satupintu.mobile.ui.viewmodel.TeacherSevenHabitsGradeRow
import com.satupintu.mobile.ui.viewmodel.TeacherSevenHabitsMonitoringRow
import com.satupintu.mobile.ui.viewmodel.TeacherSevenHabitsViewModel

private val SevenHabitsPageBrush = Brush.verticalGradient(
    colors = listOf(Color(0xFF12D6C6), Color(0xFF0F7BFF), Color(0xFF0F2A43))
)

private val SevenHabitsHeaderBrush = Brush.horizontalGradient(
    colors = listOf(Color(0xFF0F2A43), Color(0xFF0F7BFF))
)

private val SevenHabitsGlassCard = Color(0xFF0B1F33).copy(alpha = 0.22f)
private val SevenHabitsGlassBorder = Color.White.copy(alpha = 0.18f)
private val SevenHabitsTextSecondary = Color.White.copy(alpha = 0.78f)
private val SevenHabitsPrimary = Color(0xFF93C5FD)
private val SevenHabitsHabitNames = listOf(
    "Bangun Pagi",
    "Beribadah",
    "Berolahraga",
    "Makan Sehat",
    "Gemar Belajar",
    "Bermasyarakat",
    "Tidur Awal"
)
private val SevenHabitsMonths = listOf(
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
)
private val SevenHabitsDays = listOf("Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SevenHabitsTopBar(
    title: String,
    subtitle: String,
    onBack: () -> Unit
) {
    Box(modifier = Modifier.fillMaxWidth().background(SevenHabitsHeaderBrush)) {
        androidx.compose.material3.TopAppBar(
            title = {
                Column {
                    Text(title, fontWeight = FontWeight.Bold)
                    Text(
                        subtitle,
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White.copy(alpha = 0.8f)
                    )
                }
            },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Kembali"
                    )
                }
            },
            colors = androidx.compose.material3.TopAppBarDefaults.topAppBarColors(
                containerColor = Color.Transparent,
                titleContentColor = Color.White,
                navigationIconContentColor = Color.White
            )
        )
    }
}

@Composable
private fun SevenHabitsGlassCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = SevenHabitsGlassCard),
        border = androidx.compose.foundation.BorderStroke(1.dp, SevenHabitsGlassBorder),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(content = content)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TeacherSevenHabitsScreen(
    teacherNuptk: String,
    onBack: () -> Unit,
    viewModel: TeacherSevenHabitsViewModel = viewModel()
) {
    val teacher by viewModel.teacher.collectAsState()
    val selectedYear by viewModel.selectedYear.collectAsState()
    val selectedMonth by viewModel.selectedMonth.collectAsState()
    val selectedWeek by viewModel.selectedWeek.collectAsState()
    val selectedDayName by viewModel.selectedDayName.collectAsState()
    val monitoringRows by viewModel.monitoringRows.collectAsState()
    val gradingRows by viewModel.gradingRows.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val isSavingRubric by viewModel.isSavingRubric.collectAsState()
    val message by viewModel.message.collectAsState()
    val context = LocalContext.current

    var selectedTabIndex by remember { mutableIntStateOf(0) }
    val tabs = listOf("Monitoring", "Penilaian")
    val years = remember { (2024..2040).toList() }

    var rubricDialogStudent by remember { mutableStateOf<TeacherSevenHabitsGradeRow?>(null) }
    var rubricValues by remember { mutableStateOf(TeacherHabitRubric()) }

    LaunchedEffect(teacherNuptk) {
        if (teacherNuptk.isNotBlank()) {
            viewModel.setTeacherNuptk(teacherNuptk)
        }
    }

    LaunchedEffect(message) {
        if (!message.isNullOrBlank()) {
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
            viewModel.clearMessage()
        }
    }

    if (rubricDialogStudent != null) {
        TeacherRubricDialog(
            studentName = rubricDialogStudent!!.student.name,
            rubric = rubricValues,
            isSaving = isSavingRubric,
            onDismiss = { rubricDialogStudent = null },
            onRubricChange = { rubricValues = it },
            onSave = {
                viewModel.saveTeacherRubric(
                    studentId = rubricDialogStudent!!.student.id,
                    rubric = rubricValues
                ) { success ->
                    if (success) rubricDialogStudent = null
                }
            }
        )
    }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            SevenHabitsTopBar(
                title = "7 KAIH",
                subtitle = "Wali Kelas ${teacher?.homeroomClass ?: "..."}",
                onBack = onBack
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(SevenHabitsPageBrush)
                .padding(padding)
        ) {
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

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp)
                        .verticalScroll(rememberScrollState())
                ) {
                    TeacherSevenHabitsFilterCard(
                        selectedYear = selectedYear,
                        selectedMonth = selectedMonth,
                        selectedWeek = selectedWeek,
                        selectedDayName = selectedDayName,
                        years = years,
                        onYearSelected = viewModel::setYear,
                        onMonthSelected = { label ->
                            viewModel.setMonth(SevenHabitsMonths.indexOf(label) + 1)
                        },
                        onWeekSelected = viewModel::setWeek,
                        onDaySelected = viewModel::setDayName,
                        showWeekAndDay = selectedTabIndex == 0
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    if (selectedTabIndex == 0) {
                        TeacherSevenHabitsMonitoringContent(
                            teacher = teacher,
                            rows = monitoringRows,
                            isLoading = isLoading,
                            selectedYear = selectedYear,
                            selectedMonth = selectedMonth,
                            selectedWeek = selectedWeek,
                            selectedDayName = selectedDayName
                        )
                    } else {
                        TeacherSevenHabitsGradingContent(
                            rows = gradingRows,
                            isLoading = isLoading,
                            onEditRubric = { row ->
                                rubricDialogStudent = row
                                rubricValues = row.rubric
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TeacherSevenHabitsFilterCard(
    selectedYear: Int,
    selectedMonth: Int,
    selectedWeek: Int,
    selectedDayName: String,
    years: List<Int>,
    onYearSelected: (Int) -> Unit,
    onMonthSelected: (String) -> Unit,
    onWeekSelected: (Int) -> Unit,
    onDaySelected: (String) -> Unit,
    showWeekAndDay: Boolean
) {
    SevenHabitsGlassCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Filter Periode", color = Color.White, fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                TeacherDropdownSelector(
                    label = "Tahun",
                    value = selectedYear.toString(),
                    options = years.map { it.toString() },
                    onOptionSelected = { onYearSelected(it.toInt()) },
                    modifier = Modifier.weight(1f)
                )
                TeacherDropdownSelector(
                    label = "Bulan",
                    value = SevenHabitsMonths.getOrElse(selectedMonth - 1) { SevenHabitsMonths.first() },
                    options = SevenHabitsMonths,
                    onOptionSelected = onMonthSelected,
                    modifier = Modifier.weight(1f)
                )
            }

            if (showWeekAndDay) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    TeacherDropdownSelector(
                        label = "Minggu",
                        value = "Minggu ke-$selectedWeek",
                        options = (1..5).map { "Minggu ke-$it" },
                        onOptionSelected = { onWeekSelected(it.substringAfterLast("-").toInt()) },
                        modifier = Modifier.weight(1f)
                    )
                    TeacherDropdownSelector(
                        label = "Hari",
                        value = selectedDayName,
                        options = SevenHabitsDays,
                        onOptionSelected = onDaySelected,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}

@Composable
private fun TeacherSevenHabitsMonitoringContent(
    teacher: Teacher?,
    rows: List<TeacherSevenHabitsMonitoringRow>,
    isLoading: Boolean,
    selectedYear: Int,
    selectedMonth: Int,
    selectedWeek: Int,
    selectedDayName: String
) {
    SevenHabitsGlassCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Monitoring 7 KAIH", color = Color.White, fontWeight = FontWeight.Bold)
            Text(
                "Ringkasan kebiasaan harian siswa untuk ${teacher?.homeroomClass ?: "kelas wali"}",
                color = SevenHabitsTextSecondary,
                style = MaterialTheme.typography.bodySmall
            )

            if (isLoading) {
                Text("Memuat data monitoring...", color = Color.White)
            } else if (rows.isEmpty()) {
                Text("Belum ada siswa atau log 7 KAIH untuk periode ini.", color = Color.White)
            } else {
                val classSummary = remember(rows, selectedYear, selectedMonth, selectedWeek) {
                    buildClassMonitoringSummary(rows, selectedYear, selectedMonth, selectedWeek)
                }

                MonitoringSummaryCard(summary = classSummary)
                MonthlyRecapCard(summary = classSummary)

                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    rows.forEachIndexed { index, row ->
                        MonitoringRowCard(
                            index = index,
                            row = row,
                            selectedYear = selectedYear,
                            selectedMonth = selectedMonth,
                            selectedWeek = selectedWeek,
                            selectedDayName = selectedDayName
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MonitoringSummaryCard(summary: ClassMonitoringSummary) {
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.08f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Ringkasan Kelas", color = Color.White, fontWeight = FontWeight.Bold)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MonitoringMetricChip("Rata Mingguan", formatPercent(summary.averageWeeklyScore))
                MonitoringMetricChip("Rata Bulanan", formatPercent(summary.averageMonthlyScore))
                MonitoringMetricChip("Siswa Aktif", "${summary.activeStudents}/${summary.totalStudents}")
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MonitoringMetricChip("Kelengkapan Log", formatPercent(summary.averageCompletionRate))
                MonitoringMetricChip("Predikat", summary.predicate)
                MonitoringMetricChip("Minggu Terpilih", "Mg ${summary.selectedWeek}")
            }
        }
    }
}

@Composable
private fun MonthlyRecapCard(summary: ClassMonitoringSummary) {
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.08f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text("Rekap Bulanan", color = Color.White, fontWeight = FontWeight.Bold)
            Text(
                "Rata-rata capaian kelas per minggu pada bulan terpilih.",
                color = SevenHabitsTextSecondary,
                style = MaterialTheme.typography.bodySmall
            )
            summary.weekRecaps.forEach { recap ->
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(recap.label, color = Color.White)
                        Text(formatPercent(recap.score), color = Color.White, fontWeight = FontWeight.Bold)
                    }
                    LinearProgressIndicator(
                        progress = { (recap.score / 100.0).coerceIn(0.0, 1.0).toFloat() },
                        modifier = Modifier.fillMaxWidth().height(8.dp),
                        color = scoreColor(recap.score),
                        trackColor = Color.White.copy(alpha = 0.14f)
                    )
                }
            }
        }
    }
}

@Composable
private fun MonitoringRowCard(
    index: Int,
    row: TeacherSevenHabitsMonitoringRow,
    selectedYear: Int,
    selectedMonth: Int,
    selectedWeek: Int,
    selectedDayName: String
) {
    val metrics = remember(row, selectedYear, selectedMonth, selectedWeek) {
        buildStudentMonitoringMetrics(row, selectedYear, selectedMonth, selectedWeek)
    }
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.08f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = SevenHabitsPrimary.copy(alpha = 0.2f)
                ) {
                    Text(
                        text = (index + 1).toString(),
                        color = Color.White,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        fontWeight = FontWeight.Bold
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(row.student.name, color = Color.White, fontWeight = FontWeight.Bold)
                    Text(
                        "${row.student.className} â€¢ ${row.student.nisn}",
                        color = SevenHabitsTextSecondary,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                Text(
                    metrics.predicate,
                    color = scoreColor(metrics.weeklyScore),
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleSmall
                )
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MonitoringMetricChip("Mingguan", formatPercent(metrics.weeklyScore))
                MonitoringMetricChip("Bulanan", formatPercent(metrics.monthlyScore))
                MonitoringMetricChip("Log Masuk", "${metrics.loggedDays}/${metrics.validWeekDays} hari")
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MonitoringMetricChip("Tercapai", "${metrics.checkedHabits}/${metrics.totalHabitSlots}")
                MonitoringMetricChip("Kelengkapan", formatPercent(metrics.completionRate))
                MonitoringMetricChip("Hari Dipilih", metrics.dayStatus)
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Skor Per Habit", color = Color.White, fontWeight = FontWeight.SemiBold)
                metrics.habitScores.forEach { habitScore ->
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(habitScore.label, color = Color.White, style = MaterialTheme.typography.bodySmall)
                            Text(
                                "${habitScore.checkedDays}/${metrics.validWeekDays} hari â€¢ ${formatPercent(habitScore.score)}",
                                color = SevenHabitsTextSecondary,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                        LinearProgressIndicator(
                            progress = { (habitScore.score / 100.0).coerceIn(0.0, 1.0).toFloat() },
                            modifier = Modifier.fillMaxWidth().height(7.dp),
                            color = scoreColor(habitScore.score),
                            trackColor = Color.White.copy(alpha = 0.12f)
                        )
                    }
                }
            }

            HorizontalDivider(color = Color.White.copy(alpha = 0.12f))

            Text(
                "Snapshot $selectedDayName",
                color = Color.White,
                fontWeight = FontWeight.SemiBold
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                SevenHabitsHabitNames.forEachIndexed { habitIndex, label ->
                    val checked = row.dayLog?.habits?.get("habit${habitIndex + 1}") == true
                    Surface(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(14.dp),
                        color = if (checked) Color(0xFF10B981).copy(alpha = 0.22f) else Color.White.copy(alpha = 0.08f),
                        border = androidx.compose.foundation.BorderStroke(
                            1.dp,
                            if (checked) Color(0xFF10B981).copy(alpha = 0.55f) else Color.White.copy(alpha = 0.12f)
                        )
                    ) {
                        Column(
                            modifier = Modifier.padding(vertical = 10.dp, horizontal = 6.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            if (checked) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = Color.White
                                )
                            } else {
                                Text("-", color = SevenHabitsTextSecondary, fontWeight = FontWeight.SemiBold)
                            }
                            Text(
                                text = label,
                                color = Color.White,
                                fontSize = 10.sp,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            }

            if (row.dayLog == null) {
                Text(
                    "Belum ada log untuk hari $selectedDayName pada minggu ini.",
                    color = SevenHabitsTextSecondary,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
private fun RowScope.MonitoringMetricChip(label: String, value: String) {
    Surface(
        modifier = Modifier.weight(1f),
        shape = RoundedCornerShape(14.dp),
        color = Color.White.copy(alpha = 0.08f),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Column(
            modifier = Modifier.padding(vertical = 10.dp, horizontal = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(label, color = SevenHabitsTextSecondary, style = MaterialTheme.typography.bodySmall)
            Text(
                value,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleSmall,
                textAlign = TextAlign.Center
            )
        }
    }
}

private data class HabitMonitoringScore(
    val label: String,
    val checkedDays: Int,
    val score: Double
)

private data class WeekRecapItem(
    val label: String,
    val score: Double
)

private data class StudentMonitoringMetrics(
    val weeklyScore: Double,
    val monthlyScore: Double,
    val completionRate: Double,
    val loggedDays: Int,
    val validWeekDays: Int,
    val checkedHabits: Int,
    val totalHabitSlots: Int,
    val predicate: String,
    val dayStatus: String,
    val habitScores: List<HabitMonitoringScore>
)

private data class ClassMonitoringSummary(
    val averageWeeklyScore: Double,
    val averageMonthlyScore: Double,
    val averageCompletionRate: Double,
    val activeStudents: Int,
    val totalStudents: Int,
    val predicate: String,
    val selectedWeek: Int,
    val weekRecaps: List<WeekRecapItem>
)

private fun buildClassMonitoringSummary(
    rows: List<TeacherSevenHabitsMonitoringRow>,
    selectedYear: Int,
    selectedMonth: Int,
    selectedWeek: Int
): ClassMonitoringSummary {
    if (rows.isEmpty()) {
        return ClassMonitoringSummary(0.0, 0.0, 0.0, 0, 0, "Belum Ada Data", selectedWeek, emptyList())
    }

    val metrics = rows.map { row ->
        buildStudentMonitoringMetrics(row, selectedYear, selectedMonth, selectedWeek)
    }

    val weeklyAverage = metrics.map { it.weeklyScore }.averageOrZero()
    val monthlyAverage = metrics.map { it.monthlyScore }.averageOrZero()
    val completionAverage = metrics.map { it.completionRate }.averageOrZero()
    val activeStudents = metrics.count { it.loggedDays > 0 }
    val weekRecaps = (1..5).map { week ->
        WeekRecapItem(
            label = "Minggu $week",
            score = rows.map { row ->
                buildStudentMonitoringMetrics(row, selectedYear, selectedMonth, week).weeklyScore
            }.averageOrZero()
        )
    }

    return ClassMonitoringSummary(
        averageWeeklyScore = weeklyAverage,
        averageMonthlyScore = monthlyAverage,
        averageCompletionRate = completionAverage,
        activeStudents = activeStudents,
        totalStudents = rows.size,
        predicate = predicateForScore(weeklyAverage),
        selectedWeek = selectedWeek,
        weekRecaps = weekRecaps
    )
}

private fun buildStudentMonitoringMetrics(
    row: TeacherSevenHabitsMonitoringRow,
    selectedYear: Int,
    selectedMonth: Int,
    selectedWeek: Int
): StudentMonitoringMetrics {
    val validWeekDays = countDaysInWeek(selectedYear, selectedMonth, selectedWeek)
    val totalHabitSlots = (validWeekDays * SevenHabitsHabitNames.size).coerceAtLeast(1)
    val weekLogsByDate = row.weekLogs.associateBy { it.date }
    val weekDates = datesForWeek(selectedYear, selectedMonth, selectedWeek)
    val checkedHabits = weekDates.sumOf { date ->
        weekLogsByDate[date]?.habits?.values?.count { it } ?: 0
    }
    val loggedDays = weekDates.count { weekLogsByDate.containsKey(it) }
    val weeklyScore = ((checkedHabits.toDouble() / totalHabitSlots.toDouble()) * 100.0).coerceIn(0.0, 100.0)

    val validMonthDays = countDaysInMonth(selectedYear, selectedMonth).coerceAtLeast(1)
    val monthlyChecked = row.monthLogs.sumOf { log -> log.habits.values.count { it } }
    val monthlyScore = ((monthlyChecked.toDouble() / (validMonthDays * SevenHabitsHabitNames.size).toDouble()) * 100.0)
        .coerceIn(0.0, 100.0)
    val completionRate = ((loggedDays.toDouble() / validWeekDays.coerceAtLeast(1).toDouble()) * 100.0)
        .coerceIn(0.0, 100.0)

    val habitScores = SevenHabitsHabitNames.mapIndexed { index, label ->
        val key = "habit${index + 1}"
        val checkedDays = weekDates.count { date -> weekLogsByDate[date]?.habits?.get(key) == true }
        HabitMonitoringScore(
            label = label,
            checkedDays = checkedDays,
            score = ((checkedDays.toDouble() / validWeekDays.coerceAtLeast(1).toDouble()) * 100.0).coerceIn(0.0, 100.0)
        )
    }

    return StudentMonitoringMetrics(
        weeklyScore = weeklyScore,
        monthlyScore = monthlyScore,
        completionRate = completionRate,
        loggedDays = loggedDays,
        validWeekDays = validWeekDays,
        checkedHabits = checkedHabits,
        totalHabitSlots = totalHabitSlots,
        predicate = predicateForScore(weeklyScore),
        dayStatus = if (row.dayLog == null) "Belum Isi" else "${row.dayLog.habits.values.count { it }}/7",
        habitScores = habitScores
    )
}

private fun countDaysInWeek(year: Int, month: Int, week: Int): Int {
    val calendar = java.util.Calendar.getInstance().apply {
        set(java.util.Calendar.YEAR, year)
        set(java.util.Calendar.MONTH, month - 1)
    }
    val maxDays = calendar.getActualMaximum(java.util.Calendar.DAY_OF_MONTH)
    val startDay = (week - 1) * 7 + 1
    val endDay = minOf(startDay + 6, maxDays)
    return if (startDay > maxDays) 0 else (endDay - startDay + 1)
}

private fun countDaysInMonth(year: Int, month: Int): Int {
    val calendar = java.util.Calendar.getInstance().apply {
        set(java.util.Calendar.YEAR, year)
        set(java.util.Calendar.MONTH, month - 1)
    }
    return calendar.getActualMaximum(java.util.Calendar.DAY_OF_MONTH)
}

private fun datesForWeek(year: Int, month: Int, week: Int): List<String> {
    val calendar = java.util.Calendar.getInstance().apply {
        set(java.util.Calendar.YEAR, year)
        set(java.util.Calendar.MONTH, month - 1)
    }
    val maxDays = calendar.getActualMaximum(java.util.Calendar.DAY_OF_MONTH)
    val startDay = (week - 1) * 7 + 1
    if (startDay > maxDays) return emptyList()
    val endDay = minOf(startDay + 6, maxDays)
    return (startDay..endDay).map { day ->
        "%04d-%02d-%02d".format(year, month, day)
    }
}

private fun predicateForScore(score: Double): String {
    return when {
        score >= 90.0 -> "Sangat Baik"
        score >= 80.0 -> "Baik"
        score >= 70.0 -> "Cukup"
        else -> "Perlu Binaan"
    }
}

private fun formatPercent(score: Double): String = String.format("%.1f%%", score)

private fun scoreColor(score: Double): Color {
    return when {
        score >= 90.0 -> Color(0xFF10B981)
        score >= 80.0 -> Color(0xFF22C55E)
        score >= 70.0 -> Color(0xFFF59E0B)
        else -> Color(0xFFEF4444)
    }
}

private fun List<Double>.averageOrZero(): Double = if (isEmpty()) 0.0 else average()

@Composable
private fun TeacherSevenHabitsGradingContent(
    rows: List<TeacherSevenHabitsGradeRow>,
    isLoading: Boolean,
    onEditRubric: (TeacherSevenHabitsGradeRow) -> Unit
) {
    SevenHabitsGlassCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Penilaian 7 KAIH", color = Color.White, fontWeight = FontWeight.Bold)
            Text(
                "Nilai bulanan 7 KAIH dengan kontribusi penilaian guru.",
                color = SevenHabitsTextSecondary,
                style = MaterialTheme.typography.bodySmall
            )

            if (isLoading) {
                Text("Memuat data penilaian...", color = Color.White)
            } else if (rows.isEmpty()) {
                Text("Belum ada data siswa untuk dinilai pada periode ini.", color = Color.White)
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    rows.forEachIndexed { index, row ->
                        GradeRowCard(index = index, row = row, onEditRubric = { onEditRubric(row) })
                    }
                }
            }
        }
    }
}

@Composable
private fun GradeRowCard(
    index: Int,
    row: TeacherSevenHabitsGradeRow,
    onEditRubric: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.08f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = RoundedCornerShape(12.dp), color = SevenHabitsPrimary.copy(alpha = 0.2f)) {
                    Text(
                        text = (index + 1).toString(),
                        color = Color.White,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        fontWeight = FontWeight.Bold
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(row.student.name, color = Color.White, fontWeight = FontWeight.Bold)
                    Text(
                        "${row.student.className} â€¢ ${row.student.nisn}",
                        color = SevenHabitsTextSecondary,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                OutlinedButton(
                    onClick = onEditRubric,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.25f))
                ) {
                    Icon(Icons.Default.Edit, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(if (row.isTeacherRated) "Nilai Guru ${row.rubric.total}" else "Nilai Guru (Belum)")
                }
            }

            HorizontalDivider(color = Color.White.copy(alpha = 0.12f))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GradeMetricChip("Harian", row.grading.dailyConsistency)
                GradeMetricChip("Mingguan", row.grading.weeklyProgress)
                GradeMetricChip("Bulanan", row.grading.monthlyAchievement)
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Nilai Akhir", color = SevenHabitsTextSecondary, style = MaterialTheme.typography.bodySmall)
                    Text(
                        String.format("%.1f", row.grading.finalScore),
                        color = Color.White,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(row.grading.predicate, color = Color.White, fontWeight = FontWeight.Bold)
                    Text(row.grading.category, color = SevenHabitsTextSecondary, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.GradeMetricChip(label: String, value: Double) {
    Surface(
        modifier = Modifier.weight(1f),
        shape = RoundedCornerShape(14.dp),
        color = Color.White.copy(alpha = 0.08f),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Column(
            modifier = Modifier.padding(vertical = 10.dp, horizontal = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(label, color = SevenHabitsTextSecondary, style = MaterialTheme.typography.bodySmall)
            Text(
                String.format("%.1f", value),
                color = Color.White,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium
            )
        }
    }
}

@Composable
private fun TeacherRubricDialog(
    studentName: String,
    rubric: TeacherHabitRubric,
    isSaving: Boolean,
    onDismiss: () -> Unit,
    onRubricChange: (TeacherHabitRubric) -> Unit,
    onSave: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Penilaian Guru", color = Color.White) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(studentName, color = SevenHabitsTextSecondary)
                RubricField("Kejujuran", rubric.honesty) {
                    onRubricChange(rubric.copy(honesty = it, total = it + rubric.behavior + rubric.initiative + rubric.commitment))
                }
                RubricField("Perilaku", rubric.behavior) {
                    onRubricChange(rubric.copy(behavior = it, total = rubric.honesty + it + rubric.initiative + rubric.commitment))
                }
                RubricField("Inisiatif", rubric.initiative) {
                    onRubricChange(rubric.copy(initiative = it, total = rubric.honesty + rubric.behavior + it + rubric.commitment))
                }
                RubricField("Komitmen", rubric.commitment) {
                    onRubricChange(rubric.copy(commitment = it, total = rubric.honesty + rubric.behavior + rubric.initiative + it))
                }
                Text(
                    "Total Nilai Guru: ${rubric.total}",
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = onSave,
                enabled = !isSaving,
                colors = ButtonDefaults.textButtonColors(contentColor = Color.White)
            ) {
                Text(if (isSaving) "Menyimpan..." else "Simpan")
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !isSaving,
                colors = ButtonDefaults.textButtonColors(contentColor = Color.White)
            ) {
                Text("Batal")
            }
        },
        containerColor = Color(0xFF0F2A43),
        shape = RoundedCornerShape(20.dp)
    )
}

@Composable
private fun RubricField(
    label: String,
    value: Int,
    onValueChange: (Int) -> Unit
) {
    OutlinedTextField(
        value = value.toString(),
        onValueChange = { input ->
            val parsed = input.toIntOrNull() ?: 0
            onValueChange(parsed.coerceIn(0, 25))
        },
        label = { Text(label) },
        modifier = Modifier.fillMaxWidth(),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Color.White.copy(alpha = 0.42f),
            unfocusedBorderColor = SevenHabitsGlassBorder,
            focusedTextColor = Color.White,
            unfocusedTextColor = Color.White,
            focusedContainerColor = SevenHabitsGlassCard,
            unfocusedContainerColor = SevenHabitsGlassCard,
            cursorColor = Color.White,
            focusedLabelColor = Color.White.copy(alpha = 0.85f),
            unfocusedLabelColor = Color.White.copy(alpha = 0.85f)
        ),
        shape = RoundedCornerShape(16.dp)
    )
}

@Composable
private fun TeacherDropdownSelector(
    label: String,
    value: String,
    options: List<String>,
    onOptionSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier = modifier) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            label = { Text(label) },
            readOnly = true,
            trailingIcon = {
                Icon(
                    imageVector = Icons.Default.ArrowDropDown,
                    contentDescription = null
                )
            },
            modifier = Modifier.fillMaxWidth(),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = SevenHabitsGlassCard,
                unfocusedContainerColor = SevenHabitsGlassCard,
                focusedBorderColor = SevenHabitsGlassBorder,
                unfocusedBorderColor = SevenHabitsGlassBorder,
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White,
                focusedLabelColor = Color.White.copy(alpha = 0.85f),
                unfocusedLabelColor = Color.White.copy(alpha = 0.85f),
                focusedTrailingIconColor = Color.White,
                unfocusedTrailingIconColor = Color.White
            ),
            shape = RoundedCornerShape(16.dp)
        )
        Box(
            modifier = Modifier
                .matchParentSize()
                .background(Color.Transparent)
                .padding(1.dp)
                .clickable { expanded = true }
        )
        androidx.compose.material3.DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            options.forEach { option ->
                androidx.compose.material3.DropdownMenuItem(
                    text = { Text(option) },
                    onClick = {
                        onOptionSelected(option)
                        expanded = false
                    }
                )
            }
        }
    }
}

