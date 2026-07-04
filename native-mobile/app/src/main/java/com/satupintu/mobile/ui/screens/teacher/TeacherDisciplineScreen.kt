package com.satupintu.mobile.ui.screens.teacher

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.satupintu.mobile.data.model.DisciplineRule
import com.satupintu.mobile.data.model.Student
import com.satupintu.mobile.ui.viewmodel.TeacherDisciplineViewModel
import kotlin.concurrent.thread
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import com.satupintu.mobile.ui.viewmodel.DisciplineHistoryItem

private val LenteraPageBrush = Brush.verticalGradient(
    colors = listOf(
        Color(0xFF12D6C6),
        Color(0xFF0F7BFF),
        Color(0xFF0F2A43)
    )
)

private val LenteraHeaderBrush = Brush.horizontalGradient(
    colors = listOf(
        Color(0xFF0F2A43),
        Color(0xFF0F7BFF)
    )
)

private val LenteraGlassCard = Color(0xFF0B1F33).copy(alpha = 0.22f)
private val LenteraGlassBorder = Color.White.copy(alpha = 0.18f)
private val LenteraTextSecondary = Color.White.copy(alpha = 0.78f)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TeacherDisciplineScreen(
    teacherNuptk: String,
    onBack: () -> Unit,
    viewModel: TeacherDisciplineViewModel = viewModel()
) {
    // #region debug-point A:reporter
    fun reportTeacherDisciplineDebug(hypothesisId: String, location: String, msg: String, data: JSONObject = JSONObject()) {
        thread(start = true) {
            try {
                val body = JSONObject()
                    .put("sessionId", "teacher-discipline-home")
                    .put("runId", "pre-fix")
                    .put("hypothesisId", hypothesisId)
                    .put("location", location)
                    .put("msg", "[DEBUG] $msg")
                    .put("data", data)
                    .put("ts", System.currentTimeMillis())
                    .toString()
                val conn = java.net.URL("http://192.168.0.114:7777/event").openConnection() as java.net.HttpURLConnection
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.outputStream.use { it.write(body.toByteArray()) }
                conn.inputStream.close()
                conn.disconnect()
            } catch (_: Exception) {
            }
        }
    }
    // #endregion

    val context = LocalContext.current
    val students by viewModel.students.collectAsState()
    val rules by viewModel.rules.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val teacher by viewModel.teacher.collectAsState()
    val stats by viewModel.stats.collectAsState()
    val selectedStudent by viewModel.selectedStudent.collectAsState()
    val history by viewModel.history.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    var showInputDialog by remember { mutableStateOf(false) }

    LaunchedEffect(teacherNuptk) {
        // #region debug-point A:screen-entry
        reportTeacherDisciplineDebug(
            hypothesisId = "A",
            location = "TeacherDisciplineScreen:LaunchedEffect(teacherNuptk)",
            msg = "discipline screen entered",
            data = JSONObject().put("teacherNuptk", teacherNuptk)
        )
        // #endregion
        if (teacherNuptk.isNotEmpty()) {
            viewModel.setTeacherNuptk(teacherNuptk)
        }
    }

    LaunchedEffect(selectedStudent) {
        // #region debug-point D:selected-student-state
        reportTeacherDisciplineDebug(
            hypothesisId = "D",
            location = "TeacherDisciplineScreen:LaunchedEffect(selectedStudent)",
            msg = "selected student state changed",
            data = JSONObject()
                .put("hasSelectedStudent", selectedStudent != null)
                .put("studentName", selectedStudent?.name ?: "")
        )
        // #endregion
        showInputDialog = selectedStudent != null
    }

    LaunchedEffect(isLoading, students.size, rules.size, history.size, teacher?.homeroomClass) {
        // #region debug-point A:screen-state
        reportTeacherDisciplineDebug(
            hypothesisId = "A",
            location = "TeacherDisciplineScreen:LaunchedEffect(screen-state)",
            msg = "discipline screen state snapshot",
            data = JSONObject()
                .put("isLoading", isLoading)
                .put("students", students.size)
                .put("rules", rules.size)
                .put("history", history.size)
                .put("homeroomClass", teacher?.homeroomClass ?: "")
        )
        // #endregion
    }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            Box(
                modifier = Modifier.fillMaxWidth().background(LenteraHeaderBrush)
            ) {
                TopAppBar(
                    title = {
                        Column {
                            Text("Monitoring Kedisiplinan", fontWeight = FontWeight.Bold)
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
            if (isLoading) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center), color = Color.White)
            } else if (!errorMessage.isNullOrBlank()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = errorMessage.orEmpty(),
                            style = MaterialTheme.typography.bodyLarge,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = {
                                viewModel.clearError()
                                if (teacherNuptk.isNotBlank()) {
                                    viewModel.setTeacherNuptk(teacherNuptk)
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.15f)),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Coba Lagi", color = Color.White)
                        }
                    }
                }
            } else {
                DisciplineRecapContent(
                    stats = stats,
                    history = history,
                    students = students,
                    onStudentClick = { viewModel.selectStudent(it) }
                )
            }
        }
    }

    if (showInputDialog && selectedStudent != null) {
        AddDisciplineDialog(
            student = selectedStudent!!,
            rules = rules,
            onDismiss = {
                showInputDialog = false
                viewModel.clearSelection()
            },
            onSave = { rule, description ->
                viewModel.addRecord(rule, description) { success ->
                    if (success) {
                        Toast.makeText(context, "Pelanggaran final berhasil dicatat", Toast.LENGTH_SHORT).show()
                        showInputDialog = false
                        viewModel.clearSelection()
                    } else {
                        Toast.makeText(context, "Gagal menyimpan data", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        )
    }
}

@Composable
fun DisciplineRecapContent(
    stats: com.satupintu.mobile.ui.viewmodel.DisciplineStats,
    history: List<DisciplineHistoryItem>,
    students: List<Student>,
    onStudentClick: (Student) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                DisciplineStatCard(
                    label = "Pelanggaran",
                    count = stats.violationCount,
                    points = stats.violationPoints,
                    color = Color(0xFFF44336),
                    modifier = Modifier.weight(1f)
                )
            }
        }

        item {
            Text(
                "Input Pelanggaran Final",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        if (students.isEmpty()) {
            item {
                Box(modifier = Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                    Text("Belum ada siswa di kelas wali.", color = LenteraTextSecondary)
                }
            }
        } else {
            items(students) { student ->
                StudentDisciplineCard(student = student) { onStudentClick(student) }
            }
        }

        item {
            Text(
                "Riwayat Terbaru",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        if (history.isEmpty()) {
            item {
                Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text("Belum ada data kedisiplinan", color = LenteraTextSecondary)
                }
            }
        } else {
            itemsIndexed(history) { index, item ->
                DisciplineHistoryRow(item = item, rowIndex = index)
            }
        }
    }
}

@Composable
fun DisciplineHistoryRow(item: DisciplineHistoryItem, rowIndex: Int) {
    val isViolation = item.rule?.category == "VIOLATION"
    val color = if (isViolation) Color(0xFFF44336) else Color(0xFF4CAF50)
    val dateFormatter = SimpleDateFormat("dd MMM yyyy, HH:mm", Locale("id", "ID"))

    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = LenteraGlassCard),
        border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Box(
                modifier = Modifier.fillMaxWidth().height(4.dp).background(color)
            )
            Row(
                modifier = Modifier.padding(14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = Color.White.copy(alpha = 0.15f)
                ) {
                    Text(
                        text = (rowIndex + 1).toString(),
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Box(
                    modifier = Modifier.size(8.dp).background(color, CircleShape)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = item.student.name,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = item.rule?.ruleName ?: "Aturan tidak ditemukan",
                        style = MaterialTheme.typography.bodyMedium,
                        color = LenteraTextSecondary
                    )
                    if (!item.record.description.isNullOrEmpty()) {
                        Text(
                            text = item.record.description,
                            style = MaterialTheme.typography.bodySmall,
                            color = LenteraTextSecondary,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = dateFormatter.format(Date(item.record.date)),
                        style = MaterialTheme.typography.labelSmall,
                        color = LenteraTextSecondary
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "${item.record.points} Poin",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = color
                    )
                    Text(
                        text = if (isViolation) "Pelanggaran" else "Prestasi",
                        style = MaterialTheme.typography.labelSmall,
                        color = color
                    )
                }
            }
        }
    }
}

@Composable
fun DisciplineStatCard(label: String, count: Int, points: Int, color: Color, modifier: Modifier = Modifier) {
    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = LenteraGlassCard),
        border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = modifier.height(90.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "$count Kasus",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = color
            )
            Text(
                text = "$points Poin",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = LenteraTextSecondary
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = LenteraTextSecondary
            )
        }
    }
}

@Composable
fun StudentDisciplineCard(student: Student, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = LenteraGlassCard),
        border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(48.dp).background(Color.White.copy(alpha = 0.15f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Person, contentDescription = null, tint = Color.White)
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text(student.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
                Text(student.nisn, style = MaterialTheme.typography.bodySmall, color = LenteraTextSecondary)
            }
            Spacer(modifier = Modifier.weight(1f))
            Icon(Icons.Default.Add, contentDescription = "Input", tint = Color.White)
        }
    }
}

@Composable
fun AddDisciplineDialog(
    student: Student,
    rules: List<DisciplineRule>,
    onDismiss: () -> Unit,
    onSave: (DisciplineRule, String) -> Unit
) {
    var selectedCategory by remember { mutableStateOf("VIOLATION") }
    var selectedRule by remember { mutableStateOf<DisciplineRule?>(null) }
    var description by remember { mutableStateOf("") }

    val filteredRules = rules.filter { it.category == selectedCategory }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Input Poin: ${student.name}", color = Color.White) },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text("Pilih Jenis:", style = MaterialTheme.typography.labelSmall, color = LenteraTextSecondary)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(150.dp)
                        .padding(vertical = 8.dp)
                        .background(LenteraGlassCard, RoundedCornerShape(12.dp))
                        .border(1.dp, LenteraGlassBorder, RoundedCornerShape(12.dp))
                ) {
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        items(filteredRules) { rule ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { selectedRule = rule }
                                    .background(if (selectedRule == rule) Color.White.copy(alpha = 0.15f) else Color.Transparent)
                                    .padding(8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(rule.ruleName, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium, color = Color.White)
                                Text("${rule.points} Poin", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }
                    }
                }

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Keterangan Tambahan", color = LenteraTextSecondary) },
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
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (selectedRule != null) {
                        onSave(selectedRule!!, description)
                    }
                },
                enabled = selectedRule != null,
                colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.15f)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Simpan", color = Color.White)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Batal", color = Color.White)
            }
        },
        containerColor = Color(0xFF0F2A43),
        shape = RoundedCornerShape(20.dp)
    )
}

