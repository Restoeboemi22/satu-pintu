package com.satupintu.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import android.widget.Toast
import androidx.compose.ui.platform.LocalContext
import com.satupintu.mobile.ui.viewmodel.SevenHabitsViewModel
import java.text.SimpleDateFormat
import java.util.*

data class HabitInfo(
    val number: String,
    val title: String,
    val description: String,
    val key: String
)

private val SevenHabitsTableBorderColor = Color.White.copy(alpha = 0.14f)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SevenHabitsScreen(
    studentId: String,
    onBack: () -> Unit,
    viewModel: SevenHabitsViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    var isSending by remember { mutableStateOf(false) }

    LaunchedEffect(studentId) {
        viewModel.loadData(studentId)
    }

    val habits = listOf(
        HabitInfo("1", "Bangun Pagi", "Bangun sebelum pukul 05.00 WIB", "habit1"),
        HabitInfo("2", "Beribadah", "Melaksanakan ibadah sesuai agama dan kepercayaan", "habit2"),
        HabitInfo("3", "Berolahraga", "Melakukan aktivitas fisik minimal 30 menit", "habit3"),
        HabitInfo("4", "Makan Sehat dan Bergizi", "Mengonsumsi makanan bergizi seimbang (4 sehat 5 sempurna)", "habit4"),
        HabitInfo("5", "Gemar Belajar", "Membaca buku, mengerjakan tugas, dan belajar mandiri", "habit5"),
        HabitInfo("6", "Bermasyarakat", "Bersosialisasi, membantu orang lain, dan aktif di lingkungan", "habit6"),
        HabitInfo("7", "Tidur Lebih Awal", "Tidur maksimal pukul 21.00 WIB", "habit7")
    )

    // Helper to calculate dates for the selected week
    val weekDates = remember(uiState.selectedYear, uiState.selectedMonth, uiState.selectedWeek) {
        val dates = arrayOfNulls<String>(7) // 0=Mon, 1=Tue, ..., 6=Sun
        val calendar = Calendar.getInstance()
        calendar.set(Calendar.YEAR, uiState.selectedYear)
        calendar.set(Calendar.MONTH, uiState.selectedMonth - 1)
        
        val maxDays = calendar.getActualMaximum(Calendar.DAY_OF_MONTH)
        val startDay = (uiState.selectedWeek - 1) * 7 + 1
        val endDay = minOf(startDay + 6, maxDays)

        if (startDay <= maxDays) {
            for (day in startDay..endDay) {
                calendar.set(Calendar.DAY_OF_MONTH, day)
                // Calendar.DAY_OF_WEEK: Sun=1, Mon=2, ..., Sat=7
                val dayOfWeek = calendar.get(Calendar.DAY_OF_WEEK)
                // Map to 0=Mon, ..., 6=Sun
                val index = if (dayOfWeek == Calendar.SUNDAY) 6 else dayOfWeek - 2
                
                val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                dates[index] = sdf.format(calendar.time)
            }
        }
        dates
    }

    Scaffold(
        topBar = {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.horizontalGradient(
                            listOf(
                                Color(0xFF0F2A43),
                                Color(0xFF0F7BFF)
                            )
                        )
                    )
            ) {
                TopAppBar(
                    title = { Text("7 KAIH") },
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
    ) { paddingValues ->
        val pageBackground = remember {
            Brush.verticalGradient(
                colors = listOf(
                    Color(0xFF12D6C6),
                    Color(0xFF0F7BFF),
                    Color(0xFF0F2A43)
                )
            )
        }
        val glassBg = Color(0xFF0B1F33).copy(alpha = 0.22f)
        val glassBorder = Color.White.copy(alpha = 0.18f)

        Box(
            modifier = Modifier
                .padding(paddingValues)
                .fillMaxSize()
                .background(pageBackground)
        ) {
            CompositionLocalProvider(LocalContentColor provides Color.White) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp)
                ) {
                    Text(
                        text = "Checklist Mingguan",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 16.dp)
                    )

                    // Filters: Year & Month
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        DropdownSelector(
                            label = "Tahun",
                            value = uiState.selectedYear.toString(),
                            options = (2024..2030).map { it.toString() },
                            onOptionSelected = { viewModel.setYear(it.toInt()) },
                            modifier = Modifier.weight(1f),
                            containerColor = glassBg,
                            borderColor = glassBorder
                        )

                        val months = listOf("Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember")
                        DropdownSelector(
                            label = "Bulan",
                            value = months[uiState.selectedMonth - 1],
                            options = months,
                            onOptionSelected = { viewModel.setMonth(months.indexOf(it) + 1) },
                            modifier = Modifier.weight(1f),
                            containerColor = glassBg,
                            borderColor = glassBorder
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text("Pilih Minggu:", style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = 0.9f))
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        for (i in 1..5) {
                            WeekSelectorButton(
                                week = i,
                                isSelected = uiState.selectedWeek == i,
                                onClick = { viewModel.setWeek(i) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = glassBg),
                        border = androidx.compose.foundation.BorderStroke(1.dp, glassBorder)
                    ) {
                        Column(modifier = Modifier.fillMaxWidth()) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color.White.copy(alpha = 0.12f))
                                    .border(0.5.dp, SevenHabitsTableBorderColor)
                                    .height(IntrinsicSize.Min),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                TableHeaderCell("No", 0.1f)
                                TableHeaderCell("Kebiasaan", 0.4f)
                                val days = listOf("Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min")
                                days.forEach { day ->
                                    TableHeaderCell(day, 0.5f / 7)
                                }
                            }

                            if (uiState.isLoading) {
                                Box(modifier = Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                                    CircularProgressIndicator(color = Color.White)
                                }
                            } else {
                                LazyColumn(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .heightIn(min = 220.dp)
                                        .border(0.5.dp, SevenHabitsTableBorderColor)
                                ) {
                                    items(habits) { habit ->
                                        HabitRow(
                                            habit = habit,
                                            weekDates = weekDates,
                                            logs = uiState.logs,
                                            onToggle = { date, isChecked ->
                                                viewModel.toggleHabit(date, habit.key, isChecked)
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    }
            
                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = {
                            isSending = true
                            val validDates = weekDates.filterNotNull()
                            viewModel.saveWeeklyLogs(validDates) { success ->
                                isSending = false
                                val message = if (success) "Laporan berhasil dikirim ke server" else "Gagal mengirim laporan"
                                Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                            }
                        },
                        modifier = Modifier.fillMaxWidth().height(56.dp),
                        enabled = !isSending,
                        shape = RoundedCornerShape(18.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF0B1F33).copy(alpha = 0.55f),
                            contentColor = Color.White,
                            disabledContainerColor = Color(0xFF0B1F33).copy(alpha = 0.25f),
                            disabledContentColor = Color.White.copy(alpha = 0.55f)
                        )
                    ) {
                        if (isSending) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Mengirim...")
                        } else {
                            Text("Kirim Laporan")
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun DropdownSelector(
    label: String,
    value: String,
    options: List<String>,
    onOptionSelected: (String) -> Unit,
    modifier: Modifier = Modifier,
    containerColor: Color,
    borderColor: Color
) {
    var expanded by remember { mutableStateOf(false) }

    Box(modifier = modifier) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            label = { Text(label) },
            readOnly = true,
            trailingIcon = {
                Icon(Icons.Default.ArrowDropDown, "Select", Modifier.clickable { expanded = true })
            },
            modifier = Modifier.fillMaxWidth().clickable { expanded = true },
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = containerColor,
                unfocusedContainerColor = containerColor,
                focusedBorderColor = borderColor,
                unfocusedBorderColor = borderColor,
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White,
                focusedLabelColor = Color.White.copy(alpha = 0.85f),
                unfocusedLabelColor = Color.White.copy(alpha = 0.85f),
                focusedTrailingIconColor = Color.White,
                unfocusedTrailingIconColor = Color.White
            )
        )
        // Overlay transparent button to capture clicks
        Box(modifier = Modifier.matchParentSize().clickable { expanded = true })
        
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            options.forEach { option ->
                DropdownMenuItem(
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

@Composable
fun WeekSelectorButton(
    week: Int,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier,
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = if (isSelected) Color.White.copy(alpha = 0.16f) else Color(0xFF0B1F33).copy(alpha = 0.22f),
            contentColor = Color.White
        ),
        contentPadding = PaddingValues(horizontal = 4.dp, vertical = 10.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.18f)),
        shape = RoundedCornerShape(14.dp)
    ) {
        Text(
            text = "Mg $week",
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            softWrap = false,
            color = Color.White,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
fun RowScope.TableHeaderCell(text: String, weight: Float) {
    Box(
        modifier = Modifier
            .weight(weight)
            .fillMaxHeight()
            .border(0.5.dp, SevenHabitsTableBorderColor),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
            softWrap = false,
            maxLines = 1,
            modifier = Modifier.padding(4.dp)
        )
    }
}

@Composable
fun HabitRow(
    habit: HabitInfo,
    weekDates: Array<String?>,
    logs: Map<String, com.satupintu.mobile.data.model.HabitLog>,
    onToggle: (String, Boolean) -> Unit
) {
    val borderColor = SevenHabitsTableBorderColor
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .border(0.5.dp, borderColor)
            .height(IntrinsicSize.Min),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // No
        Box(
            modifier = Modifier
                .weight(0.1f)
                .fillMaxHeight()
                .border(0.5.dp, borderColor),
            contentAlignment = Alignment.Center
        ) {
            Text(habit.number, fontSize = 12.sp, color = Color.White)
        }

        // Habit Name & Desc
        Column(
            modifier = Modifier
                .weight(0.4f)
                .fillMaxHeight()
                .border(0.5.dp, borderColor)
                .padding(4.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Text(habit.title, fontWeight = FontWeight.Bold, fontSize = 12.sp, lineHeight = 14.sp, color = Color.White)
            Text(habit.description, fontSize = 10.sp, lineHeight = 12.sp, color = Color.White.copy(alpha = 0.75f))
        }

        // Checkboxes (Mon-Sun)
        for (i in 0..6) {
            val date = weekDates[i]
            Box(
                modifier = Modifier
                    .weight(0.5f / 7)
                    .fillMaxHeight()
                    .border(0.5.dp, borderColor),
                contentAlignment = Alignment.Center
            ) {
                if (date != null) {
                    val isChecked = logs[date]?.habits?.get(habit.key) ?: false
                    Checkbox(
                        checked = isChecked,
                        onCheckedChange = { onToggle(date, it) },
                        modifier = Modifier.scale(0.7f),
                        colors = CheckboxDefaults.colors(
                            checkedColor = Color.White,
                            checkmarkColor = Color(0xFF0F2A43),
                            uncheckedColor = Color.White.copy(alpha = 0.55f)
                        )
                    )
                } else {
                    // Disabled/Empty slot
                    Spacer(modifier = Modifier.size(16.dp))
                }
            }
        }
    }
}

