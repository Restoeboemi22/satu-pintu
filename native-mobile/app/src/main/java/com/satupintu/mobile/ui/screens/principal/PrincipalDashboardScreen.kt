package com.satupintu.mobile.ui.screens.principal

import android.content.Context
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoStories
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Mosque
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Today
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.satupintu.mobile.ui.viewmodel.TeacherSevenHabitsMonitoringRow
import com.satupintu.mobile.ui.viewmodel.TeacherSevenHabitsViewModel
import com.satupintu.mobile.ui.viewmodel.PrincipalAttentionStudent
import com.satupintu.mobile.ui.viewmodel.PrincipalClassSummary
import com.satupintu.mobile.ui.viewmodel.PrincipalDashboardUiState
import com.satupintu.mobile.ui.viewmodel.PrincipalDashboardViewModel
import com.satupintu.mobile.ui.viewmodel.PrincipalRecentIssue
import com.satupintu.mobile.utils.SecurePreferences
import java.util.Calendar
import kotlin.math.roundToInt

const val PRINCIPAL_ATTENDANCE_ROUTE = "principal_attendance"
const val PRINCIPAL_LITERACY_ROUTE = "principal_literacy"
const val PRINCIPAL_PRAYER_ROUTE = "principal_prayer"
const val PRINCIPAL_SEVEN_HABITS_ROUTE = "principal_seven_habits"
const val PRINCIPAL_DISCIPLINE_ROUTE = "principal_discipline"
const val PRINCIPAL_BULLYING_ROUTE = "principal_bullying"

private val PrincipalSevenHabitsMonths = listOf(
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
)

private val PrincipalSevenHabitsDayOptions = listOf(
    "Sen" to "Senin",
    "Sel" to "Selasa",
    "Rab" to "Rabu",
    "Kam" to "Kamis",
    "Jum" to "Jumat",
    "Sab" to "Sabtu",
    "Min" to "Minggu"
)

private data class PrincipalMenuItem(
    val title: String,
    val subtitle: String,
    val icon: ImageVector,
    val route: String
)

private data class PrincipalMenuStyle(
    val accent: Color,
    val gradient: List<Color>,
    val iconContainer: Color,
    val badgeLabel: String
)

private object PrincipalExecutivePalette {
    val BackgroundTop = Color(0xFFE6F0FF)
    val BackgroundBottom = Color(0xFFCFE0F7)
    val Surface = Color(0xFFD9E7F8)
    val SurfaceSoft = Color(0xFFEAF2FC)
    val SurfaceDeep = Color(0xFFC9D9F0)
    val HeroSurface = Color(0xFFC8DCF7)
    val HeroTop = Color(0xFFF2F7FF)
    val HeroMiddle = Color(0xFFDCEBFF)
    val HeroBottom = Color(0xFFC2DAFB)
    val Stroke = Color(0xFFF7FBFF)
    val ShadowDark = Color(0xFF93A9C7)
    val ShadowLight = Color(0xFFFFFFFF)
    val TextPrimary = Color(0xFF10243D)
    val TextSecondary = Color(0xFF516784)
    val Accent = Color(0xFF1E88E5)
    val AccentSoft = Color(0xFF5BC0EB)
    val Success = Color(0xFF2E9E77)
    val Warning = Color(0xFFE18A24)
    val Danger = Color(0xFFD65C6A)
    val HeaderTop = Color(0xFF10243D)
    val HeaderBottom = Color(0xFF1B4F8A)
    val HeaderText = Color(0xFFF8FBFF)
    val HeaderSubtext = Color(0xFFD8E6F7)
}

private fun accentColorForRoute(route: String): Color = when (route) {
    PRINCIPAL_ATTENDANCE_ROUTE -> PrincipalExecutivePalette.Accent
    PRINCIPAL_LITERACY_ROUTE -> PrincipalExecutivePalette.Warning
    PRINCIPAL_PRAYER_ROUTE -> PrincipalExecutivePalette.Success
    PRINCIPAL_SEVEN_HABITS_ROUTE -> Color(0xFF5E60CE)
    PRINCIPAL_DISCIPLINE_ROUTE -> PrincipalExecutivePalette.Danger
    PRINCIPAL_BULLYING_ROUTE -> Color(0xFF7A6FF0)
    else -> PrincipalExecutivePalette.AccentSoft
}

private fun principalMenuStyle(route: String): PrincipalMenuStyle = when (route) {
    PRINCIPAL_ATTENDANCE_ROUTE -> PrincipalMenuStyle(
        accent = Color(0xFF2D9CDB),
        gradient = listOf(Color(0xFFF3FBFF), Color(0xFFD8EEFF)),
        iconContainer = Color(0xFFD9F0FF),
        badgeLabel = "Pantau Presensi"
    )
    PRINCIPAL_LITERACY_ROUTE -> PrincipalMenuStyle(
        accent = Color(0xFFE49B1F),
        gradient = listOf(Color(0xFFFFF7EA), Color(0xFFFFE6BF)),
        iconContainer = Color(0xFFFFEBC8),
        badgeLabel = "Pantau Literasi"
    )
    PRINCIPAL_PRAYER_ROUTE -> PrincipalMenuStyle(
        accent = Color(0xFF22A97A),
        gradient = listOf(Color(0xFFEFFFF8), Color(0xFFD2F5E8)),
        iconContainer = Color(0xFFD8F7ED),
        badgeLabel = "Pantau Ibadah"
    )
    PRINCIPAL_SEVEN_HABITS_ROUTE -> PrincipalMenuStyle(
        accent = Color(0xFF6C63D9),
        gradient = listOf(Color(0xFFF4F1FF), Color(0xFFE0DAFF)),
        iconContainer = Color(0xFFE4DFFF),
        badgeLabel = "Pantau Karakter"
    )
    PRINCIPAL_DISCIPLINE_ROUTE -> PrincipalMenuStyle(
        accent = Color(0xFFE05A74),
        gradient = listOf(Color(0xFFFFF0F4), Color(0xFFFFD9E2)),
        iconContainer = Color(0xFFFFE0E7),
        badgeLabel = "Pantau Disiplin"
    )
    PRINCIPAL_BULLYING_ROUTE -> PrincipalMenuStyle(
        accent = Color(0xFF8A63E8),
        gradient = listOf(Color(0xFFF5F1FF), Color(0xFFE2D8FF)),
        iconContainer = Color(0xFFE6DEFF),
        badgeLabel = "Pantau Aduan"
    )
    else -> PrincipalMenuStyle(
        accent = PrincipalExecutivePalette.AccentSoft,
        gradient = listOf(PrincipalExecutivePalette.HeroTop, PrincipalExecutivePalette.HeroMiddle),
        iconContainer = PrincipalExecutivePalette.SurfaceSoft,
        badgeLabel = "Menu Kepala Sekolah"
    )
}

private fun metricAccentForTitle(title: String): Color = when {
    title.contains("hadir", ignoreCase = true) -> PrincipalExecutivePalette.Success
    title.contains("literasi", ignoreCase = true) -> PrincipalExecutivePalette.Warning
    title.contains("sholat", ignoreCase = true) -> PrincipalExecutivePalette.Success
    title.contains("kaih", ignoreCase = true) -> Color(0xFF5E60CE)
    title.contains("pelanggaran", ignoreCase = true) -> PrincipalExecutivePalette.Danger
    title.contains("aduan", ignoreCase = true) -> Color(0xFF7A6FF0)
    title.contains("aktif", ignoreCase = true) -> PrincipalExecutivePalette.Accent
    title.contains("follow", ignoreCase = true) -> PrincipalExecutivePalette.Danger
    title.contains("prioritas", ignoreCase = true) -> PrincipalExecutivePalette.Warning
    else -> PrincipalExecutivePalette.Accent
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrincipalDashboardScreen(
    onNavigate: (String) -> Unit,
    onLogout: () -> Unit,
    viewModel: PrincipalDashboardViewModel = viewModel(),
    sevenHabitsViewModel: TeacherSevenHabitsViewModel = viewModel()
) {
    BindPrincipalSession(viewModel)
    val state by viewModel.uiState.collectAsState()
    val sevenHabitsRows by sevenHabitsViewModel.monitoringRows.collectAsState()
    val isSevenHabitsLoading by sevenHabitsViewModel.isLoading.collectAsState()
    val sevenHabitsCalendar = remember { Calendar.getInstance() }
    val sevenHabitsYear = remember(sevenHabitsCalendar) { sevenHabitsCalendar.get(Calendar.YEAR) }
    val sevenHabitsMonth = remember(sevenHabitsCalendar) { sevenHabitsCalendar.get(Calendar.MONTH) + 1 }
    val sevenHabitsWeek = remember(sevenHabitsCalendar) { extractWeekOfMonthFromCalendar(sevenHabitsCalendar) }
    val sevenHabitsDayName = remember(sevenHabitsCalendar) {
        when (sevenHabitsCalendar.get(Calendar.DAY_OF_WEEK)) {
            Calendar.MONDAY -> "Senin"
            Calendar.TUESDAY -> "Selasa"
            Calendar.WEDNESDAY -> "Rabu"
            Calendar.THURSDAY -> "Kamis"
            Calendar.FRIDAY -> "Jumat"
            Calendar.SATURDAY -> "Sabtu"
            else -> "Minggu"
        }
    }
    val sevenHabitsSummary = remember(
        sevenHabitsRows,
        sevenHabitsYear,
        sevenHabitsMonth,
        sevenHabitsWeek,
        sevenHabitsDayName
    ) {
        buildPrincipalSevenHabitsSummary(
            rows = sevenHabitsRows,
            selectedYear = sevenHabitsYear,
            selectedMonth = sevenHabitsMonth,
            selectedWeek = sevenHabitsWeek,
            selectedDayName = sevenHabitsDayName
        )
    }

    LaunchedEffect(state.schoolId) {
        if (state.schoolId.isNotBlank()) {
            sevenHabitsViewModel.setPrincipalSchoolId(state.schoolId)
        }
    }

    val menuItems = listOf(
        PrincipalMenuItem("Rekap Presensi", "Pantau H, S, I, A hari ini", Icons.Default.Today, PRINCIPAL_ATTENDANCE_ROUTE),
        PrincipalMenuItem("Progress Literasi", "Lihat tugas aktif dan laporan", Icons.Default.MenuBook, PRINCIPAL_LITERACY_ROUTE),
        PrincipalMenuItem("Presensi Sholat", "Awasi kepatuhan ibadah siswa", Icons.Default.Mosque, PRINCIPAL_PRAYER_ROUTE),
        PrincipalMenuItem("Monitoring 7 KAIH", "Pantau kebiasaan baik siswa per kelas", Icons.Default.Groups, PRINCIPAL_SEVEN_HABITS_ROUTE),
        PrincipalMenuItem("Kedisiplinan", "Pantau pelanggaran dan follow up", Icons.Default.Warning, PRINCIPAL_DISCIPLINE_ROUTE),
        PrincipalMenuItem("Layanan Aduan", "Lihat laporan bullying/peristiwa", Icons.Default.NotificationsActive, PRINCIPAL_BULLYING_ROUTE)
    )

    PrincipalScaffold(
        title = "Dashboard Kepala Sekolah",
        onLogout = onLogout
    ) { modifier ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            PrincipalHeroCard(state)

            PrincipalSectionHeader(
                title = "Menu Monitoring",
                subtitle = "Akses cepat untuk memantau kondisi sekolah secara menyeluruh"
            )

            PrincipalMenuGrid(
                items = menuItems,
                onNavigate = onNavigate
            )

            PrincipalSummarySection(
                state = state,
                sevenHabitsSummary = sevenHabitsSummary,
                isSevenHabitsLoading = isSevenHabitsLoading
            )
            PrincipalAttentionSection(
                title = "Siswa Perlu Perhatian",
                students = state.attentionStudents
            )
            PrincipalClassSection(state.classSummaries)
            PrincipalIssueSection(
                title = "Peringatan & Aduan Terbaru",
                emptyText = "Belum ada pelanggaran atau aduan terbaru.",
                items = state.recentIssues
            )
            PrincipalActivitySection(state)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrincipalAttendanceScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit,
    viewModel: PrincipalDashboardViewModel = viewModel()
) {
    BindPrincipalSession(viewModel)
    val state by viewModel.uiState.collectAsState()

    PrincipalScaffold(
        title = "Rekap Presensi Siswa",
        onBack = onBack,
        onLogout = onLogout
    ) { modifier ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            PrincipalPeriodFilterSection(
                title = "Filter Rekap",
                subtitle = "Pilih bulan dan tahun untuk melihat rekap presensi",
                selectedMonth = state.attendanceRecapMonth,
                selectedYear = state.attendanceRecapYear,
                onMonthSelected = viewModel::setAttendanceRecapMonth,
                onYearSelected = viewModel::setAttendanceRecapYear
            )
            PrincipalMetricGrid(
                items = listOf(
                    MetricItem("Hadir", state.attendanceRecap.hadir.toString(), Icons.Default.VerifiedUser),
                    MetricItem("Sakit", state.attendanceRecap.sakit.toString(), Icons.Default.Person),
                    MetricItem("Izin", state.attendanceRecap.izin.toString(), Icons.Default.School),
                    MetricItem("Alpha", state.attendanceRecap.alpha.toString(), Icons.Default.NotificationsActive)
                )
            )
            DetailStatCard(
                title = "Rekap ${PrincipalSevenHabitsMonths.getOrElse(state.attendanceRecapMonth - 1) { "Bulan ${state.attendanceRecapMonth}" }} ${state.attendanceRecapYear}",
                description = "Total siswa ${state.attendanceRecap.totalStudents} | Hari aktif ${state.attendanceRecap.validSchoolDays} | Terlambat ${state.attendanceRecap.terlambat}",
                progress = state.attendanceRecap.attendanceRate
            )
            PrincipalClassSection(state.attendanceRecapClassSummaries, focus = "attendance")
        }
    }
}

@Composable
private fun PrincipalPeriodFilterSection(
    title: String,
    subtitle: String,
    selectedMonth: Int,
    selectedYear: Int,
    onMonthSelected: (Int) -> Unit,
    onYearSelected: (Int) -> Unit
) {
    var monthExpanded by remember { mutableStateOf(false) }
    var yearExpanded by remember { mutableStateOf(false) }
    val currentYear = Calendar.getInstance().get(Calendar.YEAR)
    val yearOptions = remember(currentYear) { ((currentYear - 2)..currentYear).toList().reversed() }

    PrincipalNeuPanel(
        modifier = Modifier.fillMaxWidth(),
        accent = Color(0xFF3B82F6)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            PrincipalSectionHeader(
                title = title,
                subtitle = subtitle
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(modifier = Modifier.weight(1f)) {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .clickable { monthExpanded = true },
                        color = PrincipalExecutivePalette.SurfaceSoft,
                        shape = RoundedCornerShape(16.dp),
                        tonalElevation = 0.dp,
                        shadowElevation = 0.dp
                    ) {
                        Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp)) {
                            Text(
                                text = "Bulan",
                                color = PrincipalExecutivePalette.TextSecondary,
                                style = MaterialTheme.typography.labelSmall
                            )
                            Text(
                                text = PrincipalSevenHabitsMonths.getOrElse(selectedMonth - 1) { "Bulan $selectedMonth" },
                                color = PrincipalExecutivePalette.TextPrimary,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    DropdownMenu(
                        expanded = monthExpanded,
                        onDismissRequest = { monthExpanded = false }
                    ) {
                        PrincipalSevenHabitsMonths.forEachIndexed { index, monthName ->
                            DropdownMenuItem(
                                text = { Text(monthName) },
                                onClick = {
                                    onMonthSelected(index + 1)
                                    monthExpanded = false
                                }
                            )
                        }
                    }
                }
                Box(modifier = Modifier.weight(1f)) {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .clickable { yearExpanded = true },
                        color = PrincipalExecutivePalette.SurfaceSoft,
                        shape = RoundedCornerShape(16.dp),
                        tonalElevation = 0.dp,
                        shadowElevation = 0.dp
                    ) {
                        Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp)) {
                            Text(
                                text = "Tahun",
                                color = PrincipalExecutivePalette.TextSecondary,
                                style = MaterialTheme.typography.labelSmall
                            )
                            Text(
                                text = selectedYear.toString(),
                                color = PrincipalExecutivePalette.TextPrimary,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    DropdownMenu(
                        expanded = yearExpanded,
                        onDismissRequest = { yearExpanded = false }
                    ) {
                        yearOptions.forEach { year ->
                            DropdownMenuItem(
                                text = { Text(year.toString()) },
                                onClick = {
                                    onYearSelected(year)
                                    yearExpanded = false
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrincipalLiteracyScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit,
    viewModel: PrincipalDashboardViewModel = viewModel()
) {
    BindPrincipalSession(viewModel)
    val state by viewModel.uiState.collectAsState()

    PrincipalScaffold(
        title = "Progress Program Literasi",
        onBack = onBack,
        onLogout = onLogout
    ) { modifier ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            PrincipalMetricGrid(
                items = listOf(
                    MetricItem("Tugas Aktif", state.literacy.activeTasks.toString(), Icons.Default.AutoStories),
                    MetricItem("Laporan Minggu Ini", state.literacy.reportsThisWeek.toString(), Icons.Default.Today),
                    MetricItem("Bulan Ini", state.literacy.reportsThisMonth.toString(), Icons.Default.TrendingUp),
                    MetricItem("Pending Review", state.literacy.pendingReports.toString(), Icons.Default.NotificationsActive)
                )
            )
            DetailStatCard(
                title = "Partisipasi Literasi",
                description = "Siswa submit ${state.literacy.studentsSubmittedThisMonth}/${state.literacy.totalStudents} | Reviewed ${state.literacy.reviewedReports}",
                progress = state.literacy.participationRate
            )
            PrincipalLiteracyDistributionSection(state)
            PrincipalClassSection(state.classSummaries, focus = "literacy")
            PrincipalActivitySection(state)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrincipalPrayerScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit,
    viewModel: PrincipalDashboardViewModel = viewModel()
) {
    BindPrincipalSession(viewModel)
    val state by viewModel.uiState.collectAsState()

    PrincipalScaffold(
        title = "Monitoring Presensi Sholat",
        onBack = onBack,
        onLogout = onLogout
    ) { modifier ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            PrincipalPeriodFilterSection(
                title = "Filter Rekap",
                subtitle = "Pilih bulan dan tahun untuk melihat rekap presensi sholat",
                selectedMonth = state.prayerRecapMonth,
                selectedYear = state.prayerRecapYear,
                onMonthSelected = viewModel::setPrayerRecapMonth,
                onYearSelected = viewModel::setPrayerRecapYear
            )
            PrincipalMetricGrid(
                items = listOf(
                    MetricItem("Sudah Sholat", state.prayerRecap.pray.toString(), Icons.Default.Mosque),
                    MetricItem("Izin", state.prayerRecap.permit.toString(), Icons.Default.Person),
                    MetricItem("Halangan", state.prayerRecap.halangan.toString(), Icons.Default.School),
                    MetricItem("Belum", state.prayerRecap.notPray.toString(), Icons.Default.NotificationsActive)
                )
            )
            DetailStatCard(
                title = "Rekap ${PrincipalSevenHabitsMonths.getOrElse(state.prayerRecapMonth - 1) { "Bulan ${state.prayerRecapMonth}" }} ${state.prayerRecapYear}",
                description = "Total siswa ${state.prayerRecap.totalStudents} | Hari aktif ${state.prayerRecap.validPrayerDays}",
                progress = state.prayerRecap.prayerRate
            )
            PrincipalClassSection(state.prayerRecapClassSummaries, focus = "prayer")
        }
    }
}

private data class PrincipalSevenHabitsSummary(
    val totalStudents: Int,
    val activeStudents: Int,
    val dayLogs: Int,
    val averageWeeklyScore: Double,
    val averageMonthlyScore: Double,
    val averageCompletionRate: Double
)

private data class PrincipalSevenHabitsClassItem(
    val className: String,
    val totalStudents: Int,
    val activeStudents: Int,
    val dayLogs: Int,
    val averageWeeklyScore: Double,
    val averageMonthlyScore: Double
)

private data class PrincipalSevenHabitsAttentionItem(
    val studentName: String,
    val className: String,
    val weeklyScore: Double,
    val completionRate: Double,
    val dayStatus: String
)

private data class PrincipalSevenHabitsMetrics(
    val weeklyScore: Double,
    val monthlyScore: Double,
    val completionRate: Double,
    val loggedDays: Int,
    val dayScore: Int
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrincipalSevenHabitsScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit,
    viewModel: TeacherSevenHabitsViewModel = viewModel()
) {
    val context = LocalContext.current
    val prefs = remember(context) { SecurePreferences.getSessionPrefs(context) }
    val schoolId = remember(prefs) { prefs.getString("user_school_id", "").orEmpty() }
    val schoolName = remember(prefs) { prefs.getString("user_school_name", "").orEmpty() }
    val rows by viewModel.monitoringRows.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val selectedYear by viewModel.selectedYear.collectAsState()
    val selectedMonth by viewModel.selectedMonth.collectAsState()
    val selectedWeek by viewModel.selectedWeek.collectAsState()
    val selectedDayName by viewModel.selectedDayName.collectAsState()

    LaunchedEffect(schoolId) {
        viewModel.setPrincipalSchoolId(schoolId)
    }

    val summary = remember(rows, selectedYear, selectedMonth, selectedWeek, selectedDayName) {
        buildPrincipalSevenHabitsSummary(rows, selectedYear, selectedMonth, selectedWeek, selectedDayName)
    }
    val classItems = remember(rows, selectedYear, selectedMonth, selectedWeek, selectedDayName) {
        buildPrincipalSevenHabitsClassItems(rows, selectedYear, selectedMonth, selectedWeek, selectedDayName)
    }
    val attentionItems = remember(rows, selectedYear, selectedMonth, selectedWeek, selectedDayName) {
        buildPrincipalSevenHabitsAttentionItems(rows, selectedYear, selectedMonth, selectedWeek, selectedDayName)
    }

    PrincipalScaffold(
        title = "Monitoring 7 KAIH",
        onBack = onBack,
        onLogout = onLogout
    ) { modifier ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            PrincipalSectionHeader(
                title = "Ringkasan Kebiasaan Siswa",
                subtitle = if (schoolName.isBlank()) {
                    "Pantau keterisian dan capaian 7 KAIH seluruh siswa."
                } else {
                    "Pantau keterisian dan capaian 7 KAIH di $schoolName."
                }
            )

            PrincipalSoftChip(
                label = "${PrincipalSevenHabitsMonths.getOrElse(selectedMonth - 1) { "Bulan $selectedMonth" }} $selectedYear | Minggu $selectedWeek",
                accent = Color(0xFF5E60CE)
            )

            if (isLoading) {
                PrincipalNeuPanel(
                    modifier = Modifier.fillMaxWidth(),
                    accent = Color(0xFF5E60CE)
                ) {
                    Text(
                        text = "Memuat monitoring 7 KAIH...",
                        color = PrincipalExecutivePalette.TextPrimary
                    )
                }
            } else {
                PrincipalMetricGrid(
                    items = listOf(
                        MetricItem("Siswa Terdaftar", summary.totalStudents.toString(), Icons.Default.Groups),
                        MetricItem("Aktif Bulan Ini", summary.activeStudents.toString(), Icons.Default.VerifiedUser),
                        MetricItem("Log $selectedDayName", summary.dayLogs.toString(), Icons.Default.Today),
                        MetricItem("Rata Mingguan", formatPrincipalPercent(summary.averageWeeklyScore), Icons.Default.TrendingUp),
                        MetricItem("Rata Bulanan", formatPrincipalPercent(summary.averageMonthlyScore), Icons.Default.AutoStories),
                        MetricItem("Kelengkapan", formatPrincipalPercent(summary.averageCompletionRate), Icons.Default.School)
                    )
                )

                DetailStatCard(
                    title = "Capaian Mingguan Sekolah",
                    description = "Siswa aktif ${summary.activeStudents}/${summary.totalStudents} | Log hari dipilih ${summary.dayLogs}",
                    progress = (summary.averageWeeklyScore / 100.0).toFloat()
                )

                PrincipalSevenHabitsFilterSection(
                    selectedWeek = selectedWeek,
                    selectedDayName = selectedDayName,
                    onSelectWeek = viewModel::setWeek,
                    onSelectDay = viewModel::setDayName
                )
                PrincipalSevenHabitsClassSection(classItems)
                PrincipalSevenHabitsAttentionSection(attentionItems)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrincipalDisciplineScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit,
    viewModel: PrincipalDashboardViewModel = viewModel()
) {
    BindPrincipalSession(viewModel)
    val state by viewModel.uiState.collectAsState()

    PrincipalScaffold(
        title = "Monitoring Kedisiplinan",
        onBack = onBack,
        onLogout = onLogout
    ) { modifier ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            PrincipalMetricGrid(
                items = listOf(
                    MetricItem("Minggu Ini", state.discipline.violationsThisWeek.toString(), Icons.Default.Warning),
                    MetricItem("Bulan Ini", state.discipline.violationsThisMonth.toString(), Icons.Default.Today),
                    MetricItem("Follow Up", state.discipline.openFollowUps.toString(), Icons.Default.NotificationsActive),
                    MetricItem("Siswa Terpantau", state.discipline.studentsFlagged.toString(), Icons.Default.Groups)
                )
            )
            DetailStatCard(
                title = "Status Tindak Lanjut Pelanggaran",
                description = "Total poin bulan ini ${state.discipline.totalPointsThisMonth} | Pelanggaran terbuka ${state.discipline.openFollowUps}",
                progress = state.discipline.resolutionRate
            )
            PrincipalAttentionSection(
                title = "Siswa Butuh Pembinaan",
                students = state.attentionStudents.filter { it.categories.contains("discipline") || it.categories.contains("attendance") }
            )
            PrincipalIssueSection(
                title = "Pelanggaran Terbaru",
                emptyText = "Belum ada pelanggaran terbaru.",
                items = state.recentIssues.filter { it.kind == "discipline" }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrincipalBullyingScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit,
    viewModel: PrincipalDashboardViewModel = viewModel()
) {
    BindPrincipalSession(viewModel)
    val state by viewModel.uiState.collectAsState()

    PrincipalScaffold(
        title = "Layanan Aduan Siswa",
        onBack = onBack,
        onLogout = onLogout
    ) { modifier ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            PrincipalMetricGrid(
                items = listOf(
                    MetricItem("Laporan Bulan Ini", state.bullying.reportsThisMonth.toString(), Icons.Default.NotificationsActive),
                    MetricItem("Masih Aktif", state.bullying.activeReports.toString(), Icons.Default.Warning),
                    MetricItem("Selesai", state.bullying.resolvedReports.toString(), Icons.Default.VerifiedUser),
                    MetricItem("Prioritas Tinggi", state.bullying.highPriorityReports.toString(), Icons.Default.TrendingUp)
                )
            )
            DetailStatCard(
                title = "Status Penanganan Aduan",
                description = "Aduan aktif ${state.bullying.activeReports} | Prioritas tinggi ${state.bullying.highPriorityReports}",
                progress = state.bullying.resolutionRate
            )
            PrincipalAttentionSection(
                title = "Siswa Terkait Aduan Aktif",
                students = state.attentionStudents.filter { it.categories.contains("bullying") }
            )
            PrincipalIssueSection(
                title = "Aduan & Peristiwa Terbaru",
                emptyText = "Belum ada aduan atau peristiwa terbaru.",
                items = state.recentIssues.filter { it.kind == "bullying" }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PrincipalScaffold(
    title: String,
    onBack: (() -> Unit)? = null,
    onLogout: () -> Unit,
    content: @Composable (Modifier) -> Unit
) {
    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            Box(
                modifier = Modifier.background(
                    Brush.horizontalGradient(
                        colors = listOf(
                            PrincipalExecutivePalette.HeaderTop,
                            PrincipalExecutivePalette.HeaderBottom
                        )
                    )
                )
            ) {
                TopAppBar(
                    title = {
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(
                                text = title,
                                color = PrincipalExecutivePalette.HeaderText,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Executive Monitoring Panel",
                                color = PrincipalExecutivePalette.HeaderSubtext,
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    },
                    navigationIcon = {
                        if (onBack != null) {
                            PrincipalTopBarButton(
                                onClick = onBack,
                                icon = Icons.Default.ArrowBack,
                                contentDescription = "Kembali"
                            )
                        }
                    },
                    actions = {
                        PrincipalTopBarButton(
                            onClick = onLogout,
                            icon = Icons.Default.ExitToApp,
                            contentDescription = "Logout"
                        )
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color.Transparent,
                        navigationIconContentColor = PrincipalExecutivePalette.HeaderText,
                        actionIconContentColor = PrincipalExecutivePalette.HeaderText,
                        titleContentColor = PrincipalExecutivePalette.HeaderText
                    )
                )
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            PrincipalExecutivePalette.BackgroundTop,
                            PrincipalExecutivePalette.SurfaceSoft,
                            PrincipalExecutivePalette.BackgroundBottom
                        )
                    )
                )
                .padding(padding)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.radialGradient(
                            colors = listOf(
                                PrincipalExecutivePalette.ShadowLight.copy(alpha = 0.95f),
                                Color.Transparent
                            )
                        )
                    )
            )
            content(Modifier)
        }
    }
}

@Composable
private fun PrincipalTopBarButton(
    onClick: () -> Unit,
    icon: ImageVector,
    contentDescription: String
) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = Color.White.copy(alpha = 0.12f),
        shadowElevation = 10.dp,
        tonalElevation = 0.dp,
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
        modifier = Modifier.padding(horizontal = 4.dp)
    ) {
        IconButton(onClick = onClick) {
            Icon(
                icon,
                contentDescription = contentDescription,
                tint = PrincipalExecutivePalette.HeaderText
            )
        }
    }
}

@Composable
private fun BindPrincipalSession(viewModel: PrincipalDashboardViewModel) {
    val context = LocalContext.current
    LaunchedEffect(Unit) {
    val prefs = SecurePreferences.getSessionPrefs(context)
        viewModel.setSession(
            schoolId = prefs.getString("user_school_id", "").orEmpty(),
            schoolName = prefs.getString("user_school_name", "").orEmpty(),
            principalName = prefs.getString("user_display_name", "Kepala Sekolah").orEmpty()
        )
    }
}

@Composable
private fun PrincipalNeuPanel(
    modifier: Modifier = Modifier,
    accent: Color = PrincipalExecutivePalette.Accent,
    surfaceColor: Color = PrincipalExecutivePalette.Surface,
    gradientColors: List<Color> = listOf(
        PrincipalExecutivePalette.ShadowLight.copy(alpha = 0.88f),
        PrincipalExecutivePalette.SurfaceSoft,
        PrincipalExecutivePalette.SurfaceDeep.copy(alpha = 0.94f)
    ),
    contentPadding: PaddingValues = PaddingValues(18.dp),
    content: @Composable () -> Unit
) {
    val shape = RoundedCornerShape(26.dp)
    Surface(
        modifier = modifier
            .shadow(
                elevation = 16.dp,
                shape = shape,
                ambientColor = PrincipalExecutivePalette.ShadowDark.copy(alpha = 0.28f),
                spotColor = PrincipalExecutivePalette.ShadowDark.copy(alpha = 0.30f)
            ),
        shape = shape,
        color = surfaceColor,
        tonalElevation = 3.dp,
        shadowElevation = 0.dp
    ) {
        Box(
            modifier = Modifier
                .clip(shape)
                .background(
                    Brush.linearGradient(
                        colors = gradientColors
                    )
                )
                .border(
                    width = 1.dp,
                    brush = Brush.linearGradient(
                        colors = listOf(
                            PrincipalExecutivePalette.Stroke.copy(alpha = 0.95f),
                            accent.copy(alpha = 0.25f)
                        )
                    ),
                    shape = shape
                )
                .padding(contentPadding)
        ) {
            content()
        }
    }
}

@Composable
private fun PrincipalSectionHeader(
    title: String,
    subtitle: String? = null
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = PrincipalExecutivePalette.TextPrimary
        )
        if (!subtitle.isNullOrBlank()) {
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = PrincipalExecutivePalette.TextSecondary
            )
        }
    }
}

@Composable
private fun PrincipalSoftChip(
    label: String,
    accent: Color = PrincipalExecutivePalette.Accent
) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = accent.copy(alpha = 0.12f),
        border = androidx.compose.foundation.BorderStroke(1.dp, accent.copy(alpha = 0.18f))
    ) {
        Text(
            text = label,
            color = accent,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
        )
    }
}

@Composable
private fun PrincipalHeroCard(state: PrincipalDashboardUiState) {
    val schoolTitle = remember(state.schoolName) {
        buildPrincipalRoleTitle(state.schoolName)
    }
    PrincipalNeuPanel(
        modifier = Modifier.fillMaxWidth(),
        accent = PrincipalExecutivePalette.Accent,
        surfaceColor = PrincipalExecutivePalette.HeroSurface,
        gradientColors = listOf(
            PrincipalExecutivePalette.HeroTop,
            PrincipalExecutivePalette.HeroMiddle,
            PrincipalExecutivePalette.HeroBottom
        )
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            PrincipalSoftChip(
                label = "Executive Monitoring",
                accent = PrincipalExecutivePalette.Accent
            )
            Text(
                text = state.principalName.ifBlank { "Kepala Sekolah" },
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = PrincipalExecutivePalette.TextPrimary
            )
            Text(
                text = schoolTitle,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = PrincipalExecutivePalette.Accent,
                letterSpacing = 0.6.sp
            )
            Text(
                text = "Pusat pantau cepat untuk membaca kesehatan sekolah, risiko siswa, dan tindak lanjut penting.",
                style = MaterialTheme.typography.bodyMedium,
                color = PrincipalExecutivePalette.TextSecondary
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PrincipalSoftChip(
                    label = "schoolId: ${state.schoolId.ifBlank { "-" }}",
                    accent = PrincipalExecutivePalette.Warning
                )
                PrincipalSoftChip(
                    label = "Update ${state.lastUpdatedLabel}",
                    accent = PrincipalExecutivePalette.Success
                )
            }
            PrincipalHeroPulseRow(state)
        }
    }
}

private fun buildPrincipalRoleTitle(schoolName: String): String {
    val normalizedSchoolName = schoolName.trim()
    if (normalizedSchoolName.isBlank()) return "KEPALA SEKOLAH"
    return "KEPALA ${normalizedSchoolName.uppercase()}"
}

@Composable
private fun PrincipalHeroPulseRow(state: PrincipalDashboardUiState) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        PrincipalPulseItem(
            modifier = Modifier.weight(1f),
            label = "Kehadiran",
            value = "${state.attendance.hadir}/${state.attendance.totalStudents}",
            accent = PrincipalExecutivePalette.Success
        )
        PrincipalPulseItem(
            modifier = Modifier.weight(1f),
            label = "Aduan Aktif",
            value = state.bullying.activeReports.toString(),
            accent = Color(0xFF7A6FF0)
        )
        PrincipalPulseItem(
            modifier = Modifier.weight(1f),
            label = "Follow Up",
            value = state.discipline.openFollowUps.toString(),
            accent = PrincipalExecutivePalette.Danger
        )
    }
}

@Composable
private fun PrincipalPulseItem(
    modifier: Modifier = Modifier,
    label: String,
    value: String,
    accent: Color
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(18.dp),
        color = accent.copy(alpha = 0.10f),
        border = androidx.compose.foundation.BorderStroke(1.dp, accent.copy(alpha = 0.20f))
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(
                text = label,
                color = PrincipalExecutivePalette.TextSecondary,
                style = MaterialTheme.typography.labelSmall
            )
            Text(
                text = value,
                color = accent,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun PrincipalMenuGrid(
    items: List<PrincipalMenuItem>,
    onNavigate: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items.chunked(2).forEach { rowItems ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                rowItems.forEach { item ->
                    PrincipalMenuCard(
                        item = item,
                        onClick = { onNavigate(item.route) },
                        modifier = Modifier.weight(1f)
                    )
                }
                if (rowItems.size == 1) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun PrincipalMenuCard(
    item: PrincipalMenuItem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val style = principalMenuStyle(item.route)
    PrincipalNeuPanel(
        modifier = modifier
            .aspectRatio(0.88f)
            .clickable(onClick = onClick),
        accent = style.accent,
        gradientColors = style.gradient,
        contentPadding = PaddingValues(16.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Surface(
                color = style.iconContainer,
                shape = RoundedCornerShape(16.dp)
            ) {
                Icon(
                    imageVector = item.icon,
                    contentDescription = item.title,
                    tint = style.accent,
                    modifier = Modifier.padding(14.dp).size(22.dp)
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = item.title,
                    color = PrincipalExecutivePalette.TextPrimary,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = item.subtitle,
                    color = PrincipalExecutivePalette.TextSecondary,
                    style = MaterialTheme.typography.bodySmall,
                    lineHeight = 16.sp
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom
            ) {
                PrincipalSoftChip(
                    label = style.badgeLabel,
                    accent = style.accent
                )
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = style.accent.copy(alpha = 0.12f),
                    border = androidx.compose.foundation.BorderStroke(1.dp, style.accent.copy(alpha = 0.18f))
                ) {
                    Icon(
                        imageVector = Icons.Default.TrendingUp,
                        contentDescription = "Buka ${item.title}",
                        tint = style.accent,
                        modifier = Modifier.padding(12.dp).size(20.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun PrincipalSummarySection(
    state: PrincipalDashboardUiState,
    sevenHabitsSummary: PrincipalSevenHabitsSummary,
    isSevenHabitsLoading: Boolean
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        PrincipalSectionHeader(
            title = "Ringkasan Eksekutif",
            subtitle = "Gambaran cepat performa siswa dan situasi sekolah"
        )
        PrincipalMetricGrid(
            items = listOf(
                MetricItem("Hadir", "${state.attendance.hadir}/${state.attendance.totalStudents}", Icons.Default.Groups),
                MetricItem("Literasi", "${state.literacy.studentsSubmittedThisMonth}/${state.literacy.totalStudents}", Icons.Default.MenuBook),
                MetricItem("Sholat", "${state.prayer.pray}/${state.prayer.totalStudents}", Icons.Default.Mosque),
                MetricItem(
                    "7 KAIH",
                    if (isSevenHabitsLoading) "..." else formatPrincipalPercent(sevenHabitsSummary.averageWeeklyScore),
                    Icons.Default.AutoStories
                ),
                MetricItem("Pelanggaran", state.discipline.violationsThisMonth.toString(), Icons.Default.Warning),
                MetricItem("Aduan Aktif", state.bullying.activeReports.toString(), Icons.Default.NotificationsActive)
            )
        )
    }
}

private data class MetricItem(
    val title: String,
    val value: String,
    val icon: ImageVector
)

@Composable
private fun PrincipalMetricGrid(items: List<MetricItem>) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items.chunked(2).forEach { rowItems ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                rowItems.forEach { item ->
                    val accent = metricAccentForTitle(item.title)
                    PrincipalNeuPanel(
                        modifier = Modifier.weight(1f),
                        accent = accent,
                        contentPadding = PaddingValues(16.dp)
                    ) {
                        Column(
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Surface(
                                color = accent.copy(alpha = 0.12f),
                                shape = RoundedCornerShape(14.dp)
                            ) {
                                Icon(
                                    imageVector = item.icon,
                                    contentDescription = item.title,
                                    tint = accent,
                                    modifier = Modifier.padding(10.dp).size(20.dp)
                                )
                            }
                            Text(
                                item.title,
                                color = PrincipalExecutivePalette.TextSecondary,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Text(
                                item.value,
                                color = PrincipalExecutivePalette.TextPrimary,
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.Bold
                            )
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(4.dp)
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(accent.copy(alpha = 0.18f))
                            )
                        }
                    }
                }
                if (rowItems.size == 1) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

private data class LiteracyDistributionSlice(
    val label: String,
    val value: Int,
    val color: Color
)

@Composable
private fun PrincipalLiteracyDistributionSection(state: PrincipalDashboardUiState) {
    val slices = listOf(
        LiteracyDistributionSlice("Sangat Aktif", state.literacy.veryActiveCount, Color(0xFF4ADE80)),
        LiteracyDistributionSlice("Aktif", state.literacy.activeCount, Color(0xFF22D3EE)),
        LiteracyDistributionSlice("Cukup Aktif", state.literacy.enoughActiveCount, Color(0xFFFACC15)),
        LiteracyDistributionSlice("Perlu Dorongan", state.literacy.needsSupportCount, Color(0xFFFB923C)),
        LiteracyDistributionSlice("Belum Aktif", state.literacy.inactiveCount, Color(0xFFF87171))
    )
    val total = slices.sumOf { it.value }

    PrincipalNeuPanel(
        modifier = Modifier.fillMaxWidth(),
        accent = PrincipalExecutivePalette.Warning
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            PrincipalSectionHeader(
                title = "Distribusi Aktivitas Literasi",
                subtitle = "Diagram kategori siswa berdasarkan skor aktivitas literasi bulan berjalan"
            )

            if (total == 0) {
                Text(
                    text = "Belum ada aktivitas literasi untuk ditampilkan dalam diagram.",
                    color = PrincipalExecutivePalette.TextSecondary,
                    style = MaterialTheme.typography.bodyMedium
                )
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Canvas(modifier = Modifier.size(220.dp)) {
                        val strokeWidth = 34.dp.toPx()
                        val diameter = size.minDimension - strokeWidth
                        var startAngle = -90f

                        slices.filter { it.value > 0 }.forEach { slice ->
                            val sweep = (slice.value.toFloat() / total.toFloat()) * 360f
                            drawArc(
                                color = slice.color,
                                startAngle = startAngle,
                                sweepAngle = sweep,
                                useCenter = false,
                                topLeft = Offset(
                                    (size.width - diameter) / 2f,
                                    (size.height - diameter) / 2f
                                ),
                                size = Size(diameter, diameter),
                                style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                            )
                            startAngle += sweep
                        }
                    }

                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = total.toString(),
                            color = PrincipalExecutivePalette.TextPrimary,
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Siswa Terpetakan",
                            color = PrincipalExecutivePalette.TextSecondary,
                            style = MaterialTheme.typography.bodySmall
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Skor rata-rata ${state.literacy.averageScore}",
                            color = PrincipalExecutivePalette.Warning,
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    slices.forEach { item ->
                        val percentage = if (total == 0) 0 else ((item.value.toFloat() / total.toFloat()) * 100f).roundToInt()
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(12.dp)
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(item.color)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = item.label,
                                color = PrincipalExecutivePalette.TextPrimary,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.weight(1f)
                            )
                            Text(
                                text = "${item.value} siswa",
                                color = PrincipalExecutivePalette.TextPrimary,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "$percentage%",
                                color = PrincipalExecutivePalette.TextSecondary,
                                style = MaterialTheme.typography.labelMedium
                            )
                        }
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    PrincipalMiniStat(
                        label = "Hari Aktif",
                        value = state.literacy.totalVisitDays.toString(),
                        accent = PrincipalExecutivePalette.Warning,
                        modifier = Modifier.weight(1f)
                    )
                    PrincipalMiniStat(
                        label = "Peminjaman",
                        value = state.literacy.totalBorrows.toString(),
                        accent = PrincipalExecutivePalette.Success,
                        modifier = Modifier.weight(1f)
                    )
                    PrincipalMiniStat(
                        label = "Tugas",
                        value = state.literacy.totalTasksDone.toString(),
                        accent = PrincipalExecutivePalette.Accent,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}

@Composable
private fun PrincipalMiniStat(
    label: String,
    value: String,
    accent: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(18.dp),
        color = accent.copy(alpha = 0.10f),
        border = androidx.compose.foundation.BorderStroke(1.dp, accent.copy(alpha = 0.18f))
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(
                text = label,
                color = PrincipalExecutivePalette.TextSecondary,
                style = MaterialTheme.typography.labelSmall
            )
            Text(
                text = value,
                color = accent,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun DetailStatCard(title: String, description: String, progress: Float) {
    PrincipalNeuPanel(
        modifier = Modifier.fillMaxWidth(),
        accent = PrincipalExecutivePalette.Success,
        contentPadding = PaddingValues(18.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, color = PrincipalExecutivePalette.TextPrimary, fontWeight = FontWeight.Bold)
            Text(
                description,
                color = PrincipalExecutivePalette.TextSecondary,
                style = MaterialTheme.typography.bodyMedium
            )
            LinearProgressIndicator(
                progress = { progress.coerceIn(0f, 1f) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp),
                color = PrincipalExecutivePalette.Success,
                trackColor = PrincipalExecutivePalette.Accent.copy(alpha = 0.12f)
            )
            Text(
                text = "${(progress.coerceIn(0f, 1f) * 100).roundToInt()}%",
                color = PrincipalExecutivePalette.TextPrimary,
                style = MaterialTheme.typography.labelLarge,
                textAlign = TextAlign.End,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun PrincipalClassSection(
    classSummaries: List<PrincipalClassSummary>,
    focus: String = "all"
) {
    PrincipalNeuPanel(
        modifier = Modifier.fillMaxWidth(),
        accent = PrincipalExecutivePalette.Warning
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            PrincipalSectionHeader(
                title = "Ringkasan per Kelas",
                subtitle = "Bandingkan performa kehadiran, literasi, dan sholat per kelas"
            )
            if (classSummaries.isEmpty()) {
                Text(
                    "Belum ada data kelas untuk sekolah ini.",
                    color = PrincipalExecutivePalette.TextSecondary
                )
            } else {
                classSummaries.forEachIndexed { index, item ->
                    ClassRow(item = item, focus = focus)
                    if (index != classSummaries.lastIndex) {
                        HorizontalDivider(color = PrincipalExecutivePalette.TextSecondary.copy(alpha = 0.12f))
                    }
                }
            }
        }
    }
}

@Composable
private fun ClassRow(item: PrincipalClassSummary, focus: String) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = item.className,
                color = PrincipalExecutivePalette.TextPrimary,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = "${item.totalStudents} siswa",
                color = PrincipalExecutivePalette.TextSecondary,
                style = MaterialTheme.typography.bodySmall
            )
        }
        when (focus) {
            "attendance" -> ProgressLine("Kehadiran", item.attendanceRate)
            "literacy" -> ProgressLine("Literasi", item.literacyRate)
            "prayer" -> ProgressLine("Sholat", item.prayerRate)
            else -> {
                ProgressLine("Kehadiran", item.attendanceRate)
                ProgressLine("Literasi", item.literacyRate)
                ProgressLine("Sholat", item.prayerRate)
            }
        }
    }
}

@Composable
private fun ProgressLine(label: String, progress: Float) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row {
            Text(
                label,
                color = PrincipalExecutivePalette.TextSecondary,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.weight(1f)
            )
            Text(
                "${(progress.coerceIn(0f, 1f) * 100).roundToInt()}%",
                color = PrincipalExecutivePalette.TextPrimary,
                style = MaterialTheme.typography.bodySmall
            )
        }
        LinearProgressIndicator(
            progress = { progress.coerceIn(0f, 1f) },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .border(0.dp, Color.Transparent, RoundedCornerShape(999.dp)),
            color = PrincipalExecutivePalette.Accent,
            trackColor = PrincipalExecutivePalette.Accent.copy(alpha = 0.12f)
        )
    }
}

@Composable
private fun PrincipalActivitySection(state: PrincipalDashboardUiState) {
    PrincipalNeuPanel(
        modifier = Modifier.fillMaxWidth(),
        accent = PrincipalExecutivePalette.Warning
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            PrincipalSectionHeader(
                title = "Aktivitas Literasi Terbaru",
                subtitle = "Laporan dan submit terbaru yang masuk dari siswa"
            )
            if (state.recentActivities.isEmpty()) {
                Text("Belum ada laporan literasi terbaru.", color = PrincipalExecutivePalette.TextSecondary)
            } else {
                state.recentActivities.forEachIndexed { index, item ->
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(item.title, color = PrincipalExecutivePalette.TextPrimary, fontWeight = FontWeight.Bold)
                        Text(
                            item.subtitle,
                            color = PrincipalExecutivePalette.TextSecondary,
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            item.timestampLabel,
                            color = PrincipalExecutivePalette.TextSecondary.copy(alpha = 0.84f),
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                    if (index != state.recentActivities.lastIndex) {
                        HorizontalDivider(color = PrincipalExecutivePalette.TextSecondary.copy(alpha = 0.12f))
                    }
                }
            }
        }
    }
}

@Composable
private fun PrincipalAttentionSection(
    title: String,
    students: List<PrincipalAttentionStudent>
) {
    PrincipalNeuPanel(
        modifier = Modifier.fillMaxWidth(),
        accent = PrincipalExecutivePalette.Danger
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            PrincipalSectionHeader(
                title = title,
                subtitle = "Prioritaskan siswa yang butuh pembinaan atau tindak lanjut cepat"
            )
            if (students.isEmpty()) {
                Text(
                    "Belum ada siswa yang perlu perhatian khusus.",
                    color = PrincipalExecutivePalette.TextSecondary
                )
            } else {
                students.forEachIndexed { index, item ->
                    AttentionStudentRow(item)
                    if (index != students.lastIndex) {
                        HorizontalDivider(color = PrincipalExecutivePalette.TextSecondary.copy(alpha = 0.12f))
                    }
                }
            }
        }
    }
}

@Composable
private fun AttentionStudentRow(item: PrincipalAttentionStudent) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(PrincipalExecutivePalette.Danger.copy(alpha = 0.85f))
            )
            Spacer(modifier = Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.name,
                    color = PrincipalExecutivePalette.TextPrimary,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${item.className} | Risiko ${item.score}",
                    color = PrincipalExecutivePalette.TextSecondary,
                    style = MaterialTheme.typography.bodySmall
                )
            }
            PrincipalSoftChip(
                label = "${item.categories.size} isu",
                accent = PrincipalExecutivePalette.Danger
            )
        }
        Text(
            text = item.reasons.joinToString(" | "),
            color = PrincipalExecutivePalette.TextSecondary,
            style = MaterialTheme.typography.bodySmall
        )
    }
}

@Composable
private fun PrincipalIssueSection(
    title: String,
    emptyText: String,
    items: List<PrincipalRecentIssue>
) {
    PrincipalNeuPanel(
        modifier = Modifier.fillMaxWidth(),
        accent = PrincipalExecutivePalette.Warning
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            PrincipalSectionHeader(
                title = title,
                subtitle = "Sorotan kejadian yang perlu diketahui pimpinan sekolah"
            )
            if (items.isEmpty()) {
                Text(emptyText, color = PrincipalExecutivePalette.TextSecondary)
            } else {
                items.forEachIndexed { index, item ->
                    PrincipalIssueRow(item)
                    if (index != items.lastIndex) {
                        HorizontalDivider(color = PrincipalExecutivePalette.TextSecondary.copy(alpha = 0.12f))
                    }
                }
            }
        }
    }
}

@Composable
private fun PrincipalIssueRow(item: PrincipalRecentIssue) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        val accent = if (item.kind == "discipline") PrincipalExecutivePalette.Danger else PrincipalExecutivePalette.Warning
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(accent.copy(alpha = 0.88f))
            )
            Spacer(modifier = Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(item.title, color = PrincipalExecutivePalette.TextPrimary, fontWeight = FontWeight.Bold)
                Text(
                    text = item.subtitle,
                    color = PrincipalExecutivePalette.TextSecondary,
                    style = MaterialTheme.typography.bodySmall
                )
            }
            PrincipalSoftChip(
                label = item.badge,
                accent = accent
            )
        }
        Text(
            text = item.timestampLabel,
            color = PrincipalExecutivePalette.TextSecondary.copy(alpha = 0.88f),
            style = MaterialTheme.typography.labelSmall
        )
    }
}

@Composable
private fun PrincipalSevenHabitsFilterSection(
    selectedWeek: Int,
    selectedDayName: String,
    onSelectWeek: (Int) -> Unit,
    onSelectDay: (String) -> Unit
) {
    PrincipalNeuPanel(
        modifier = Modifier.fillMaxWidth(),
        accent = Color(0xFF5E60CE)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            PrincipalSectionHeader(
                title = "Filter Monitoring",
                subtitle = "Pilih minggu dan hari untuk membaca log 7 KAIH"
            )

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Minggu", color = PrincipalExecutivePalette.TextPrimary, fontWeight = FontWeight.Bold)
                listOf(1, 2, 3, 4, 5).chunked(3).forEach { weekRow ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        weekRow.forEach { week ->
                            FilterChip(
                                selected = selectedWeek == week,
                                onClick = { onSelectWeek(week) },
                                label = { Text("Minggu $week") },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = Color(0xFF5E60CE).copy(alpha = 0.16f),
                                    selectedLabelColor = Color(0xFF5E60CE)
                                )
                            )
                        }
                    }
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Hari", color = PrincipalExecutivePalette.TextPrimary, fontWeight = FontWeight.Bold)
                PrincipalSevenHabitsDayOptions.chunked(4).forEach { dayRow ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        dayRow.forEach { (shortLabel, fullLabel) ->
                            FilterChip(
                                selected = selectedDayName == fullLabel,
                                onClick = { onSelectDay(fullLabel) },
                                label = { Text(shortLabel) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = Color(0xFF5E60CE).copy(alpha = 0.16f),
                                    selectedLabelColor = Color(0xFF5E60CE)
                                )
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PrincipalSevenHabitsClassSection(items: List<PrincipalSevenHabitsClassItem>) {
    PrincipalNeuPanel(
        modifier = Modifier.fillMaxWidth(),
        accent = Color(0xFF5E60CE)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            PrincipalSectionHeader(
                title = "Monitoring per Kelas",
                subtitle = "Lihat kelas yang paling aktif dan yang perlu didorong"
            )
            if (items.isEmpty()) {
                Text(
                    text = "Belum ada data siswa atau log 7 KAIH untuk sekolah ini.",
                    color = PrincipalExecutivePalette.TextSecondary
                )
            } else {
                items.forEachIndexed { index, item ->
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = item.className,
                                    color = PrincipalExecutivePalette.TextPrimary,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                    text = "${item.activeStudents}/${item.totalStudents} siswa aktif | Log hari ini ${item.dayLogs}",
                                    color = PrincipalExecutivePalette.TextSecondary,
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                            PrincipalSoftChip(
                                label = formatPrincipalPercent(item.averageWeeklyScore),
                                accent = Color(0xFF5E60CE)
                            )
                        }
                        ProgressLine("Rata Mingguan", (item.averageWeeklyScore / 100.0).toFloat())
                        ProgressLine("Rata Bulanan", (item.averageMonthlyScore / 100.0).toFloat())
                    }
                    if (index != items.lastIndex) {
                        HorizontalDivider(color = PrincipalExecutivePalette.TextSecondary.copy(alpha = 0.12f))
                    }
                }
            }
        }
    }
}

@Composable
private fun PrincipalSevenHabitsAttentionSection(items: List<PrincipalSevenHabitsAttentionItem>) {
    PrincipalNeuPanel(
        modifier = Modifier.fillMaxWidth(),
        accent = PrincipalExecutivePalette.Warning
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            PrincipalSectionHeader(
                title = "Perlu Perhatian",
                subtitle = "Siswa dengan capaian mingguan paling rendah pada filter saat ini"
            )
            if (items.isEmpty()) {
                Text(
                    text = "Belum ada siswa yang perlu disorot pada periode ini.",
                    color = PrincipalExecutivePalette.TextSecondary
                )
            } else {
                items.forEachIndexed { index, item ->
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = item.studentName,
                                    color = PrincipalExecutivePalette.TextPrimary,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                    text = "${item.className} | Hari dipilih ${item.dayStatus}",
                                    color = PrincipalExecutivePalette.TextSecondary,
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                            PrincipalSoftChip(
                                label = formatPrincipalPercent(item.weeklyScore),
                                accent = PrincipalExecutivePalette.Warning
                            )
                        }
                        Text(
                            text = "Kelengkapan bulan ini ${formatPrincipalPercent(item.completionRate)}",
                            color = PrincipalExecutivePalette.TextSecondary,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    if (index != items.lastIndex) {
                        HorizontalDivider(color = PrincipalExecutivePalette.TextSecondary.copy(alpha = 0.12f))
                    }
                }
            }
        }
    }
}

private fun buildPrincipalSevenHabitsSummary(
    rows: List<TeacherSevenHabitsMonitoringRow>,
    selectedYear: Int,
    selectedMonth: Int,
    selectedWeek: Int,
    selectedDayName: String
): PrincipalSevenHabitsSummary {
    if (rows.isEmpty()) {
        return PrincipalSevenHabitsSummary(0, 0, 0, 0.0, 0.0, 0.0)
    }

    val metrics = rows.map {
        buildPrincipalSevenHabitsMetrics(it, selectedYear, selectedMonth, selectedWeek, selectedDayName)
    }

    return PrincipalSevenHabitsSummary(
        totalStudents = rows.size,
        activeStudents = metrics.count { it.loggedDays > 0 },
        dayLogs = metrics.count { it.dayScore > 0 },
        averageWeeklyScore = metrics.map { it.weeklyScore }.averageOrZero(),
        averageMonthlyScore = metrics.map { it.monthlyScore }.averageOrZero(),
        averageCompletionRate = metrics.map { it.completionRate }.averageOrZero()
    )
}

private fun buildPrincipalSevenHabitsClassItems(
    rows: List<TeacherSevenHabitsMonitoringRow>,
    selectedYear: Int,
    selectedMonth: Int,
    selectedWeek: Int,
    selectedDayName: String
): List<PrincipalSevenHabitsClassItem> {
    return rows
        .groupBy { it.student.className.ifBlank { "Tanpa Kelas" } }
        .map { (className, classRows) ->
            val metrics = classRows.map {
                buildPrincipalSevenHabitsMetrics(it, selectedYear, selectedMonth, selectedWeek, selectedDayName)
            }
            PrincipalSevenHabitsClassItem(
                className = className,
                totalStudents = classRows.size,
                activeStudents = metrics.count { it.loggedDays > 0 },
                dayLogs = metrics.count { it.dayScore > 0 },
                averageWeeklyScore = metrics.map { it.weeklyScore }.averageOrZero(),
                averageMonthlyScore = metrics.map { it.monthlyScore }.averageOrZero()
            )
        }
        .sortedByDescending { it.averageWeeklyScore }
}

private fun buildPrincipalSevenHabitsAttentionItems(
    rows: List<TeacherSevenHabitsMonitoringRow>,
    selectedYear: Int,
    selectedMonth: Int,
    selectedWeek: Int,
    selectedDayName: String
): List<PrincipalSevenHabitsAttentionItem> {
    return rows
        .map { row ->
            val metrics = buildPrincipalSevenHabitsMetrics(row, selectedYear, selectedMonth, selectedWeek, selectedDayName)
            PrincipalSevenHabitsAttentionItem(
                studentName = row.student.name,
                className = row.student.className.ifBlank { "Tanpa Kelas" },
                weeklyScore = metrics.weeklyScore,
                completionRate = metrics.completionRate,
                dayStatus = if (metrics.dayScore <= 0) "Belum Isi" else "${metrics.dayScore}/7"
            )
        }
        .sortedWith(
            compareBy<PrincipalSevenHabitsAttentionItem> { it.weeklyScore }
                .thenBy { it.completionRate }
                .thenBy { it.studentName }
        )
        .take(8)
}

private fun buildPrincipalSevenHabitsMetrics(
    row: TeacherSevenHabitsMonitoringRow,
    selectedYear: Int,
    selectedMonth: Int,
    selectedWeek: Int,
    selectedDayName: String
): PrincipalSevenHabitsMetrics {
    val validWeekDays = countWeekdaysInSelectedWeek(selectedYear, selectedMonth, selectedWeek)
    val validMonthDays = countWeekdaysInMonth(selectedYear, selectedMonth)
    val weekChecked = row.weekLogs.sumOf { log -> log.habits.values.count { it } }
    val monthChecked = row.monthLogs.sumOf { log -> log.habits.values.count { it } }
    val weeklyScore = if (validWeekDays == 0) 0.0 else {
        ((weekChecked.toDouble() / (validWeekDays * 7).toDouble()) * 100.0).coerceIn(0.0, 100.0)
    }
    val monthlyScore = if (validMonthDays == 0) 0.0 else {
        ((monthChecked.toDouble() / (validMonthDays * 7).toDouble()) * 100.0).coerceIn(0.0, 100.0)
    }
    val completionRate = if (validMonthDays == 0) 0.0 else {
        ((row.monthLogs.size.toDouble() / validMonthDays.toDouble()) * 100.0).coerceIn(0.0, 100.0)
    }
    val dayLog = row.weekLogs.find { extractPrincipalDayName(it.date) == selectedDayName } ?: row.dayLog
    val dayScore = dayLog?.habits?.values?.count { it } ?: 0

    return PrincipalSevenHabitsMetrics(
        weeklyScore = weeklyScore,
        monthlyScore = monthlyScore,
        completionRate = completionRate,
        loggedDays = row.monthLogs.size,
        dayScore = dayScore
    )
}

private fun countWeekdaysInSelectedWeek(year: Int, month: Int, week: Int): Int {
    val calendar = Calendar.getInstance().apply {
        set(Calendar.YEAR, year)
        set(Calendar.MONTH, month - 1)
        set(Calendar.DAY_OF_MONTH, 1)
    }
    val maxDay = calendar.getActualMaximum(Calendar.DAY_OF_MONTH)
    var count = 0
    for (day in 1..maxDay) {
        calendar.set(Calendar.DAY_OF_MONTH, day)
        val dayWeek = extractWeekOfMonthFromCalendar(calendar)
        val dayOfWeek = calendar.get(Calendar.DAY_OF_WEEK)
        val isWeekday = dayOfWeek != Calendar.SATURDAY && dayOfWeek != Calendar.SUNDAY
        if (dayWeek == week && isWeekday) count++
    }
    return count
}

private fun countWeekdaysInMonth(year: Int, month: Int): Int {
    val calendar = Calendar.getInstance().apply {
        set(Calendar.YEAR, year)
        set(Calendar.MONTH, month - 1)
        set(Calendar.DAY_OF_MONTH, 1)
    }
    val maxDay = calendar.getActualMaximum(Calendar.DAY_OF_MONTH)
    var count = 0
    for (day in 1..maxDay) {
        calendar.set(Calendar.DAY_OF_MONTH, day)
        val dayOfWeek = calendar.get(Calendar.DAY_OF_WEEK)
        val isWeekday = dayOfWeek != Calendar.SATURDAY && dayOfWeek != Calendar.SUNDAY
        if (isWeekday) count++
    }
    return count
}

private fun extractWeekOfMonthFromCalendar(calendar: Calendar): Int {
    val firstDayCalendar = calendar.clone() as Calendar
    firstDayCalendar.set(Calendar.DAY_OF_MONTH, 1)
    val offset = when (firstDayCalendar.get(Calendar.DAY_OF_WEEK)) {
        Calendar.MONDAY -> 0
        Calendar.TUESDAY -> 1
        Calendar.WEDNESDAY -> 2
        Calendar.THURSDAY -> 3
        Calendar.FRIDAY -> 4
        Calendar.SATURDAY -> 5
        else -> 6
    }
    return ((calendar.get(Calendar.DAY_OF_MONTH) + offset - 1) / 7) + 1
}

private fun extractPrincipalDayName(date: String): String {
    val parts = date.split("-")
    val year = parts.getOrNull(0)?.toIntOrNull() ?: return ""
    val month = parts.getOrNull(1)?.toIntOrNull()?.minus(1) ?: return ""
    val day = parts.getOrNull(2)?.toIntOrNull() ?: return ""
    val calendar = Calendar.getInstance().apply {
        set(Calendar.YEAR, year)
        set(Calendar.MONTH, month)
        set(Calendar.DAY_OF_MONTH, day)
    }
    return when (calendar.get(Calendar.DAY_OF_WEEK)) {
        Calendar.MONDAY -> "Senin"
        Calendar.TUESDAY -> "Selasa"
        Calendar.WEDNESDAY -> "Rabu"
        Calendar.THURSDAY -> "Kamis"
        Calendar.FRIDAY -> "Jumat"
        Calendar.SATURDAY -> "Sabtu"
        else -> "Minggu"
    }
}

private fun formatPrincipalPercent(value: Double): String {
    return "${value.roundToInt()}%"
}

private fun List<Double>.averageOrZero(): Double {
    return if (isEmpty()) 0.0 else average()
}
