package com.satupintu.mobile.ui.screens.teacher

import android.app.DatePickerDialog
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
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
import com.satupintu.mobile.ui.viewmodel.ManualPrayerSubmission
import com.satupintu.mobile.ui.viewmodel.TeacherPrayerItem
import com.satupintu.mobile.ui.viewmodel.TeacherPrayerMonthlyStats
import com.satupintu.mobile.ui.viewmodel.TeacherPrayerViewModel
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

private val LenteraPageBrush = Brush.verticalGradient(
    colors = listOf(Color(0xFF12D6C6), Color(0xFF0F7BFF), Color(0xFF0F2A43))
)

private val LenteraHeaderBrush = Brush.horizontalGradient(
    colors = listOf(Color(0xFF0F2A43), Color(0xFF0F7BFF))
)

private val LenteraGlassCard = Color(0xFF0B1F33).copy(alpha = 0.22f)
private val LenteraGlassBorder = Color.White.copy(alpha = 0.18f)
private val LenteraTextSecondary = Color.White.copy(alpha = 0.78f)
private val PrayerTableDividerColor = Color.White.copy(alpha = 0.24f)

private const val STATUS_PRAY = "Sudah Presensi"
private const val STATUS_NOT_YET = "Belum Presensi"
private const val STATUS_NOT_PRAY = "Tidak Sholat"
private const val STATUS_PERMIT = "Izin"
private const val STATUS_HALANGAN = "Halangan"
private val TABLE_NO_WIDTH = 44.dp
private val TABLE_STATUS_SECTION_WIDTH = 176.dp
private val TABLE_ROW_HEIGHT = 48.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TeacherPrayerScreen(
    teacherNuptk: String,
    onBack: () -> Unit,
    viewModel: TeacherPrayerViewModel = viewModel()
) {
    val context = LocalContext.current
    val todayFormatter = remember { SimpleDateFormat("EEEE, dd MMMM yyyy", Locale("id", "ID")) }
    val teacher by viewModel.teacher.collectAsState()
    val prayerItems by viewModel.prayerItems.collectAsState()
    val stats by viewModel.stats.collectAsState()
    val selectedDate by viewModel.selectedDate.collectAsState()
    val monthlyRecap by viewModel.monthlyRecap.collectAsState()
    val selectedMonth by viewModel.selectedMonth.collectAsState()
    val selectedYear by viewModel.selectedYear.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val isSubmitting by viewModel.isSubmitting.collectAsState()
    val manualSelections = remember { mutableStateMapOf<String, String>() }
    var selectedTabIndex by remember { mutableIntStateOf(0) }
    val tabs = listOf("Monitoring Harian", "Rekap Bulanan")
    val dateCalendar = Calendar.getInstance().apply { timeInMillis = selectedDate }
    val datePickerDialog = remember(selectedDate) {
        DatePickerDialog(
            context,
            { _, year, month, dayOfMonth ->
                val newCalendar = Calendar.getInstance().apply {
                    set(Calendar.YEAR, year)
                    set(Calendar.MONTH, month)
                    set(Calendar.DAY_OF_MONTH, dayOfMonth)
                }
                viewModel.setSelectedDate(newCalendar.timeInMillis)
            },
            dateCalendar.get(Calendar.YEAR),
            dateCalendar.get(Calendar.MONTH),
            dateCalendar.get(Calendar.DAY_OF_MONTH)
        )
    }

    LaunchedEffect(teacherNuptk) {
        if (teacherNuptk.isNotBlank()) {
            viewModel.setTeacherNuptk(teacherNuptk)
        }
    }

    LaunchedEffect(prayerItems) {
        val validIds = prayerItems
            .filter { it.status == STATUS_NOT_YET }
            .map { teacherPrayerIdentityKey(it.student.id, it.student.nisn) }
            .toSet()
        val invalidIds = manualSelections.keys.filter { it !in validIds }
        invalidIds.forEach { manualSelections.remove(it) }
    }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            Box(modifier = Modifier.fillMaxWidth().background(LenteraHeaderBrush)) {
                TopAppBar(
                    title = {
                        Column {
                            Text("Presensi Sholat", fontWeight = FontWeight.Bold)
                            Text(
                                "Wali Kelas ${teacher?.homeroomClass ?: "..."}",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White.copy(alpha = 0.8f)
                            )
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
    ) { padding ->
        Box(
            modifier = Modifier.fillMaxSize().background(LenteraPageBrush).padding(padding)
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

                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { viewModel.onSearchQueryChanged(it) },
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    placeholder = { Text("Cari nama atau NISN...", color = LenteraTextSecondary) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Color.White) },
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color.White.copy(alpha = 0.42f),
                        unfocusedBorderColor = LenteraGlassBorder,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        cursorColor = Color.White
                    )
                )

                if (isLoading) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Color.White)
                    }
                } else {
                    if (selectedTabIndex == 0) {
                        DailyPrayerContent(
                            prayerItems = prayerItems,
                            selectedDateLabel = todayFormatter.format(Date(selectedDate)),
                            statsPrayCount = countEffectiveStatuses(prayerItems, manualSelections.toMap(), STATUS_PRAY),
                            statsNotPrayCount = countEffectiveStatuses(prayerItems, manualSelections.toMap(), STATUS_NOT_PRAY),
                            statsPermitCount = countEffectiveStatuses(prayerItems, manualSelections.toMap(), STATUS_PERMIT),
                            statsHalanganCount = countEffectiveStatuses(prayerItems, manualSelections.toMap(), STATUS_HALANGAN),
                            manualSelections = manualSelections.toMap(),
                            isSubmitting = isSubmitting,
                            onDateClick = { datePickerDialog.show() },
                            onSubmitManual = {
                                val selectedItems = prayerItems.mapNotNull { item ->
                                    val status = manualSelections[teacherPrayerIdentityKey(item.student.id, item.student.nisn)]
                                        ?: return@mapNotNull null
                                    ManualPrayerSubmission(
                                        item = item,
                                        status = when (status) {
                                            STATUS_PRAY -> "PRAY"
                                            STATUS_NOT_PRAY -> "NOT_PRAY"
                                            STATUS_PERMIT -> "PERMIT"
                                            STATUS_HALANGAN -> "HALANGAN"
                                            else -> return@mapNotNull null
                                        }
                                    )
                                }
                                viewModel.submitManualPrayer(selectedItems, selectedDate) { result ->
                                    Toast.makeText(context, result.message, Toast.LENGTH_LONG).show()
                                    if (result.success) manualSelections.clear()
                                }
                            },
                            onStatusSelected = { item, status ->
                                if (item.status != STATUS_NOT_YET) return@DailyPrayerContent
                                val studentKey = teacherPrayerIdentityKey(item.student.id, item.student.nisn)
                                val currentStatus = manualSelections[studentKey]
                                if (currentStatus == status) {
                                    manualSelections.remove(studentKey)
                                } else {
                                    manualSelections[studentKey] = status
                                }
                            }
                        )
                    } else {
                        MonthlyPrayerRecapContent(
                            selectedMonth = selectedMonth,
                            selectedYear = selectedYear,
                            prayerItems = prayerItems,
                            monthlyRecap = monthlyRecap,
                            onMonthChange = viewModel::setMonth,
                            onYearChange = viewModel::setYear
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DailyPrayerContent(
    prayerItems: List<TeacherPrayerItem>,
    selectedDateLabel: String,
    statsPrayCount: Int,
    statsNotPrayCount: Int,
    statsPermitCount: Int,
    statsHalanganCount: Int,
    manualSelections: Map<String, String>,
    isSubmitting: Boolean,
    onDateClick: () -> Unit,
    onSubmitManual: () -> Unit,
    onStatusSelected: (TeacherPrayerItem, String) -> Unit
) {
    Column(modifier = Modifier.padding(16.dp)) {
        Card(
            modifier = Modifier.fillMaxWidth().clickable { onDateClick() },
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = LenteraGlassCard),
            border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder)
        ) {
            Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.DateRange, contentDescription = null, tint = Color.White)
                Spacer(modifier = Modifier.width(16.dp))
                Column {
                    Text("Tanggal Presensi Sholat", style = MaterialTheme.typography.labelSmall, color = LenteraTextSecondary)
                    Text(text = selectedDateLabel, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            PrayerStatCard("Sholat", statsPrayCount, Color(0xFF4CAF50))
            PrayerStatCard("Tidak", statsNotPrayCount, Color(0xFFF44336))
            PrayerStatCard("Izin", statsPermitCount, Color(0xFFFF9800))
            PrayerStatCard("Halangan", statsHalanganCount, Color(0xFF8E24AA))
        }

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = onSubmitManual,
            modifier = Modifier.fillMaxWidth(),
            enabled = manualSelections.isNotEmpty() && !isSubmitting,
            colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.15f)),
            shape = RoundedCornerShape(16.dp)
        ) {
            Text(if (isSubmitting) "Menyimpan..." else "Simpan Presensi Manual", color = Color.White, fontWeight = FontWeight.Bold)
        }

        Spacer(modifier = Modifier.height(8.dp))
        Text("Gunakan kolom S, TS, I, atau H untuk memilih status manual siswa.", style = MaterialTheme.typography.labelSmall, color = LenteraTextSecondary)

        Spacer(modifier = Modifier.height(16.dp))

        if (prayerItems.isEmpty()) {
            PrayerTableHeader()
            Box(modifier = Modifier.fillMaxWidth().height(100.dp), contentAlignment = Alignment.Center) {
                Text("Belum ada data siswa di kelas ini", color = Color.White)
            }
        } else {
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = LenteraGlassCard),
                border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder)
            ) {
                Column {
                    PrayerTableHeader()
                    HorizontalDivider(color = PrayerTableDividerColor, thickness = 1.dp)
                    LazyColumn(modifier = Modifier.heightIn(max = 400.dp)) {
                        itemsIndexed(prayerItems) { index, item ->
                            val studentKey = teacherPrayerIdentityKey(item.student.id, item.student.nisn)
                            PrayerTableRow(
                                index = index + 1,
                                item = item,
                                selectedStatus = manualSelections[studentKey],
                                onStatusSelected = { status -> onStatusSelected(item, status) }
                            )
                            if (index != prayerItems.lastIndex) {
                                HorizontalDivider(color = PrayerTableDividerColor, thickness = 1.dp)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MonthlyPrayerRecapContent(
    selectedMonth: Int,
    selectedYear: Int,
    prayerItems: List<TeacherPrayerItem>,
    monthlyRecap: Map<String, TeacherPrayerMonthlyStats>,
    onMonthChange: (Int) -> Unit,
    onYearChange: (Int) -> Unit
) {
    val months = listOf("Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember")
    var monthExpanded by remember { mutableStateOf(false) }
    var yearExpanded by remember { mutableStateOf(false) }

    Column(modifier = Modifier.padding(16.dp)) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = LenteraGlassCard),
            border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder)
        ) {
            Row(modifier = Modifier.padding(16.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Box(modifier = Modifier.weight(1f)) {
                    OutlinedButton(
                        onClick = { monthExpanded = true },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                        border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Text(months.getOrElse(selectedMonth) { "Pilih Bulan" })
                    }
                    DropdownMenu(expanded = monthExpanded, onDismissRequest = { monthExpanded = false }) {
                        months.forEachIndexed { index, monthName ->
                            DropdownMenuItem(text = { Text(monthName) }, onClick = { onMonthChange(index); monthExpanded = false })
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
                    ) {
                        Text(selectedYear.toString())
                    }
                    DropdownMenu(expanded = yearExpanded, onDismissRequest = { yearExpanded = false }) {
                        val currentYear = Calendar.getInstance().get(Calendar.YEAR)
                        ((currentYear - 2)..(currentYear + 2)).forEach { year ->
                            DropdownMenuItem(text = { Text(year.toString()) }, onClick = { onYearChange(year); yearExpanded = false })
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        Text("Keterangan: S = Sholat, TS = Tidak Sholat, I = Izin, H = Halangan", style = MaterialTheme.typography.labelSmall, color = LenteraTextSecondary)

        Spacer(modifier = Modifier.height(12.dp))

        if (prayerItems.isEmpty()) {
            Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                Text("Belum ada data siswa di kelas ini", color = Color.White)
            }
        } else {
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = LenteraGlassCard),
                border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder)
            ) {
                Column {
                    PrayerMonthlyHeader()
                    HorizontalDivider(color = PrayerTableDividerColor, thickness = 1.dp)
                    LazyColumn {
                        itemsIndexed(prayerItems) { index, item ->
                            val recap = monthlyRecap[teacherPrayerIdentityKey(item.student.id, item.student.nisn)]
                                ?: TeacherPrayerMonthlyStats()
                            PrayerMonthlyRow(index = index + 1, item = item, recap = recap)
                            if (index != prayerItems.lastIndex) {
                                HorizontalDivider(color = PrayerTableDividerColor, thickness = 1.dp)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PrayerTableHeader() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.1f)),
        verticalAlignment = Alignment.CenterVertically
    ) {
        TableHeaderCell(text = "NO", modifier = Modifier.width(TABLE_NO_WIDTH).height(TABLE_ROW_HEIGHT), withRightBorder = true)
        TableHeaderCell(text = "NAMA SISWA", modifier = Modifier.weight(1f).height(TABLE_ROW_HEIGHT), textAlign = TextAlign.Start, horizontalPadding = 12.dp, withRightBorder = true)
        Row(modifier = Modifier.width(TABLE_STATUS_SECTION_WIDTH).height(TABLE_ROW_HEIGHT), verticalAlignment = Alignment.CenterVertically) {
            TableHeaderCell(text = "S", modifier = Modifier.weight(1f).fillMaxHeight(), withRightBorder = true)
            TableHeaderCell(text = "TS", modifier = Modifier.weight(1f).fillMaxHeight(), withRightBorder = true)
            TableHeaderCell(text = "I", modifier = Modifier.weight(1f).fillMaxHeight(), withRightBorder = true)
            TableHeaderCell(text = "H", modifier = Modifier.weight(1f).fillMaxHeight())
        }
    }
}

@Composable
private fun PrayerMonthlyHeader() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.1f)),
        verticalAlignment = Alignment.CenterVertically
    ) {
        TableHeaderCell(text = "NO", modifier = Modifier.width(TABLE_NO_WIDTH).height(TABLE_ROW_HEIGHT), withRightBorder = true)
        TableHeaderCell(text = "NAMA SISWA", modifier = Modifier.weight(1f).height(TABLE_ROW_HEIGHT), textAlign = TextAlign.Start, horizontalPadding = 12.dp, withRightBorder = true)
        Row(modifier = Modifier.width(TABLE_STATUS_SECTION_WIDTH).height(TABLE_ROW_HEIGHT), verticalAlignment = Alignment.CenterVertically) {
            TableHeaderCell(text = "S", modifier = Modifier.weight(1f).fillMaxHeight(), withRightBorder = true)
            TableHeaderCell(text = "TS", modifier = Modifier.weight(1f).fillMaxHeight(), withRightBorder = true)
            TableHeaderCell(text = "I", modifier = Modifier.weight(1f).fillMaxHeight(), withRightBorder = true)
            TableHeaderCell(text = "H", modifier = Modifier.weight(1f).fillMaxHeight())
        }
    }
}

@Composable
private fun PrayerMonthlyRow(index: Int, item: TeacherPrayerItem, recap: TeacherPrayerMonthlyStats) {
    Row(modifier = Modifier.fillMaxWidth().height(TABLE_ROW_HEIGHT), verticalAlignment = Alignment.CenterVertically) {
        TableTextCell(text = index.toString(), modifier = Modifier.width(TABLE_NO_WIDTH).fillMaxHeight(), textAlign = TextAlign.Center, withRightBorder = true)
        Column(modifier = Modifier.weight(1f).fillMaxHeight().padding(horizontal = 12.dp, vertical = 3.dp), verticalArrangement = Arrangement.Center) {
            Text(text = item.student.name, style = MaterialTheme.typography.bodySmall.copy(lineHeight = 14.sp), fontWeight = FontWeight.SemiBold, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(text = item.student.nisn, style = MaterialTheme.typography.labelSmall.copy(lineHeight = 12.sp), color = LenteraTextSecondary, maxLines = 1)
        }
        TableColumnDivider(modifier = Modifier.fillMaxHeight())
        Row(modifier = Modifier.width(TABLE_STATUS_SECTION_WIDTH).fillMaxHeight(), verticalAlignment = Alignment.CenterVertically) {
            TableTextCell(text = recap.prayCount.toString(), modifier = Modifier.weight(1f).fillMaxHeight(), textAlign = TextAlign.Center, withRightBorder = true)
            TableTextCell(text = recap.notPrayCount.toString(), modifier = Modifier.weight(1f).fillMaxHeight(), textAlign = TextAlign.Center, withRightBorder = true)
            TableTextCell(text = recap.permitCount.toString(), modifier = Modifier.weight(1f).fillMaxHeight(), textAlign = TextAlign.Center, withRightBorder = true)
            TableTextCell(text = recap.halanganCount.toString(), modifier = Modifier.weight(1f).fillMaxHeight(), textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun PrayerTableRow(index: Int, item: TeacherPrayerItem, selectedStatus: String?, onStatusSelected: (String) -> Unit) {
    val canSelectManual = item.status == STATUS_NOT_YET
    Row(modifier = Modifier.fillMaxWidth().height(TABLE_ROW_HEIGHT), verticalAlignment = Alignment.CenterVertically) {
        TableTextCell(text = index.toString(), modifier = Modifier.width(TABLE_NO_WIDTH).fillMaxHeight(), textAlign = TextAlign.Center, withRightBorder = true)
        Column(modifier = Modifier.weight(1f).fillMaxHeight().padding(horizontal = 12.dp, vertical = 3.dp), verticalArrangement = Arrangement.Center) {
            Text(text = item.student.name, style = MaterialTheme.typography.bodySmall.copy(lineHeight = 14.sp), fontWeight = FontWeight.SemiBold, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(text = item.student.nisn, style = MaterialTheme.typography.labelSmall.copy(lineHeight = 12.sp), color = LenteraTextSecondary, maxLines = 1)
        }
        TableColumnDivider(modifier = Modifier.fillMaxHeight())
        Row(modifier = Modifier.width(TABLE_STATUS_SECTION_WIDTH).fillMaxHeight(), verticalAlignment = Alignment.CenterVertically) {
            PrayerStatusOption(label = "S", isSelected = item.status == STATUS_PRAY || selectedStatus == STATUS_PRAY, color = Color(0xFF4CAF50), isClickable = canSelectManual, onClick = { onStatusSelected(STATUS_PRAY) })
            PrayerStatusOption(label = "TS", isSelected = item.status == STATUS_NOT_PRAY || selectedStatus == STATUS_NOT_PRAY, color = Color(0xFFF44336), isClickable = canSelectManual, onClick = { onStatusSelected(STATUS_NOT_PRAY) })
            PrayerStatusOption(label = "I", isSelected = item.status == STATUS_PERMIT || selectedStatus == STATUS_PERMIT, color = Color(0xFFFF9800), isClickable = canSelectManual, onClick = { onStatusSelected(STATUS_PERMIT) })
            PrayerStatusOption(label = "H", isSelected = item.status == STATUS_HALANGAN || selectedStatus == STATUS_HALANGAN, color = Color(0xFF8E24AA), isClickable = canSelectManual, onClick = { onStatusSelected(STATUS_HALANGAN) }, withRightBorder = false)
        }
    }
}

@Composable
private fun RowScope.PrayerStatusOption(label: String, isSelected: Boolean, color: Color, isClickable: Boolean, onClick: () -> Unit, withRightBorder: Boolean = true) {
    Box(modifier = Modifier.weight(1f).fillMaxHeight().clickable(enabled = isClickable, onClick = onClick), contentAlignment = Alignment.Center) {
        if (isSelected) {
            Icon(imageVector = Icons.Default.Check, contentDescription = label, tint = color, modifier = Modifier.size(18.dp))
        }
        if (withRightBorder) {
            TableColumnDivider(modifier = Modifier.align(Alignment.CenterEnd))
        }
    }
}

@Composable
private fun TableHeaderCell(text: String, modifier: Modifier, textAlign: TextAlign = TextAlign.Center, horizontalPadding: androidx.compose.ui.unit.Dp = 0.dp, withRightBorder: Boolean = false) {
    Box(modifier = modifier, contentAlignment = when (textAlign) { TextAlign.Start -> Alignment.CenterStart; TextAlign.End -> Alignment.CenterEnd; else -> Alignment.Center }) {
        Text(text = text, modifier = Modifier.padding(horizontal = horizontalPadding), textAlign = textAlign, fontWeight = FontWeight.Bold, color = Color.White, style = MaterialTheme.typography.bodySmall)
        if (withRightBorder) {
            TableColumnDivider(modifier = Modifier.align(Alignment.CenterEnd), color = PrayerTableDividerColor)
        }
    }
}

@Composable
private fun TableTextCell(text: String, modifier: Modifier, textAlign: TextAlign = TextAlign.Center, withRightBorder: Boolean = false) {
    Box(modifier = modifier, contentAlignment = when (textAlign) { TextAlign.Start -> Alignment.CenterStart; TextAlign.End -> Alignment.CenterEnd; else -> Alignment.Center }) {
        Text(text = text, modifier = Modifier.padding(horizontal = 6.dp), textAlign = textAlign, color = Color.White, style = MaterialTheme.typography.bodySmall)
        if (withRightBorder) {
            TableColumnDivider(modifier = Modifier.align(Alignment.CenterEnd))
        }
    }
}

@Composable
private fun TableColumnDivider(modifier: Modifier = Modifier, color: Color = PrayerTableDividerColor) {
    Box(modifier = modifier.fillMaxHeight().width(1.dp).background(color))
}

private fun countEffectiveStatuses(items: List<TeacherPrayerItem>, manualSelections: Map<String, String>, vararg statuses: String): Int {
    return items.count { item ->
        val effectiveStatus = manualSelections[teacherPrayerIdentityKey(item.student.id, item.student.nisn)]
            ?.takeIf { item.status == STATUS_NOT_YET }
            ?: item.status
        effectiveStatus in statuses
    }
}

private fun teacherPrayerIdentityKey(studentId: String?, studentNisn: String?): String {
    return listOf(studentId, studentNisn)
        .map { it?.trim().orEmpty() }
        .firstOrNull { it.isNotBlank() }
        .orEmpty()
}

@Composable
private fun PrayerStatCard(label: String, count: Int, color: Color) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = LenteraGlassCard),
        border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder),
        modifier = Modifier.size(width = 80.dp, height = 70.dp)
    ) {
        Column(modifier = Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Text(text = count.toString(), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Color.White)
            Text(text = label, style = MaterialTheme.typography.labelSmall, color = LenteraTextSecondary)
        }
    }
}

