package com.satupintu.mobile.ui.screens.teacher

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.satupintu.mobile.data.model.LiteracyLog
import com.satupintu.mobile.ui.viewmodel.TeacherLiteracyViewModel
import java.text.SimpleDateFormat
import java.util.*

private val LenteraPageBrush = Brush.verticalGradient(
    colors = listOf(Color(0xFF12D6C6), Color(0xFF0F7BFF), Color(0xFF0F2A43))
)

private val LenteraHeaderBrush = Brush.horizontalGradient(
    colors = listOf(Color(0xFF0F2A43), Color(0xFF0F7BFF))
)

private val LenteraGlassCard = Color(0xFF0B1F33).copy(alpha = 0.22f)
private val LenteraGlassBorder = Color.White.copy(alpha = 0.18f)
private val LenteraTextSecondary = Color.White.copy(alpha = 0.78f)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TeacherLiteracyScreen(
    teacherNuptk: String,
    onBack: () -> Unit,
    viewModel: TeacherLiteracyViewModel = viewModel()
) {
    val logs by viewModel.logs.collectAsState()
    val teacher by viewModel.teacher.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    var selectedTab by remember { mutableStateOf(0) }
    var selectedLog by remember { mutableStateOf<LiteracyLog?>(null) }
    var showGradeDialog by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }

    LaunchedEffect(teacherNuptk) {
        if (teacherNuptk.isNotBlank()) {
            viewModel.setTeacherNuptk(teacherNuptk)
        }
    }

    val filteredLogs = logs.filter {
        val isReviewed = isReviewedStatus(it.status)
        if (selectedTab == 0) !isReviewed else isReviewed
    }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            Box(modifier = Modifier.fillMaxWidth().background(LenteraHeaderBrush)) {
                TopAppBar(
                    title = {
                        Column {
                            Text("Literasi Siswa", fontWeight = FontWeight.Bold)
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
                    selectedTabIndex = selectedTab,
                    containerColor = Color.Transparent,
                    contentColor = Color.White
                ) {
                    Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, selectedContentColor = Color.White, unselectedContentColor = Color.White.copy(alpha = 0.7f), text = { Text("Perlu Dinilai") })
                    Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, selectedContentColor = Color.White, unselectedContentColor = Color.White.copy(alpha = 0.7f), text = { Text("Sudah Dinilai") })
                }

                if (isLoading) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Color.White)
                    }
                } else {
                    if (filteredLogs.isEmpty()) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text("Tidak ada data literasi", style = MaterialTheme.typography.bodyLarge, color = Color.White)
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            itemsIndexed(filteredLogs) { index, log ->
                                LiteracyLogCard(
                                    log = log,
                                    rowIndex = index,
                                    onClick = {
                                        selectedLog = log
                                        showGradeDialog = true
                                    },
                                    onDelete = {
                                        selectedLog = log
                                        showDeleteDialog = true
                                    },
                                    showDelete = selectedTab == 1
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showGradeDialog && selectedLog != null) {
        GradeDialog(
            log = selectedLog!!,
            onDismiss = { showGradeDialog = false },
            onSubmit = { grade, feedback ->
                viewModel.submitGrade(selectedLog!!.id, grade, feedback)
                showGradeDialog = false
            }
        )
    }

    if (showDeleteDialog && selectedLog != null) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Hapus Laporan", color = Color.White) },
            text = { Text("Apakah Anda yakin ingin menghapus laporan literasi dari ${selectedLog!!.studentName}?", color = LenteraTextSecondary) },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteLog(selectedLog!!.id)
                        showDeleteDialog = false
                        selectedLog = null
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = Color(0xFFF44336))
                ) {
                    Text("Hapus")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("Batal", color = Color.White)
                }
            },
            containerColor = Color(0xFF0F2A43),
            shape = RoundedCornerShape(20.dp)
        )
    }
}

@Composable
fun LiteracyLogCard(log: LiteracyLog, rowIndex: Int, onClick: () -> Unit, onDelete: () -> Unit, showDelete: Boolean) {
    val isReviewed = isReviewedStatus(log.status)
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = LenteraGlassCard),
        border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Box(
                modifier = Modifier.fillMaxWidth().height(4.dp)
                    .background(if (isReviewed) Color(0xFF4CAF50) else Color(0xFF0F7BFF))
            )
            Column(modifier = Modifier.padding(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
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
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = log.studentName,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            color = Color.White
                        )
                        Text(
                            text = "${log.studentClass} â€¢ ${formatDate(log.timestamp)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = LenteraTextSecondary
                        )
                    }
                    if (isReviewed) {
                        Badge(containerColor = Color(0xFF4CAF50)) {
                            Text("Nilai: ${log.grade ?: "-"}", color = Color.White, modifier = Modifier.padding(4.dp))
                        }
                        if (showDelete) {
                            IconButton(onClick = onDelete, modifier = Modifier.size(24.dp)) {
                                Icon(Icons.Default.Delete, contentDescription = "Hapus", tint = Color(0xFFF44336))
                            }
                        }
                    } else {
                        Badge(containerColor = Color(0xFFFF9800)) {
                            Text("Menunggu", color = Color.White, modifier = Modifier.padding(4.dp))
                        }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(color = LenteraGlassBorder, thickness = 1.dp)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "${log.bookTitle} (${log.author})",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = Color.White
                )
                Text(
                    text = log.summary,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    color = LenteraTextSecondary
                )
            }
        }
    }
}

@Composable
fun GradeDialog(log: LiteracyLog, onDismiss: () -> Unit, onSubmit: (String, String) -> Unit) {
    var grade by remember { mutableStateOf(log.grade ?: "A") }
    var feedback by remember { mutableStateOf(log.feedback ?: "") }
    val grades = listOf("A", "B", "C", "D")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Nilai Literasi", color = Color.White) },
        text = {
            Column {
                Text("Nama: ${log.studentName}", style = MaterialTheme.typography.bodySmall, color = LenteraTextSecondary)
                Text("Buku: ${log.bookTitle}", style = MaterialTheme.typography.bodySmall, color = LenteraTextSecondary)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Ringkasan:", style = MaterialTheme.typography.labelMedium, color = LenteraTextSecondary)
                Card(
                    colors = CardDefaults.cardColors(containerColor = LenteraGlassCard),
                    modifier = Modifier.fillMaxWidth().heightIn(max = 150.dp)
                ) {
                    Column(modifier = Modifier.padding(8.dp).verticalScroll(rememberScrollState())) {
                        Text(log.summary, style = MaterialTheme.typography.bodySmall, color = Color.White)
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
                Text("Pilih Nilai:", style = MaterialTheme.typography.labelMedium, color = LenteraTextSecondary)
                Row(horizontalArrangement = Arrangement.SpaceEvenly, modifier = Modifier.fillMaxWidth()) {
                    grades.forEach { g ->
                        FilterChip(
                            selected = grade == g,
                            onClick = { grade = g },
                            label = { Text(g, color = Color.White) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Color.White.copy(alpha = 0.2f),
                                containerColor = LenteraGlassCard
                            )
                        )
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = feedback,
                    onValueChange = { feedback = it },
                    label = { Text("Umpan Balik (Opsional)", color = LenteraTextSecondary) },
                    modifier = Modifier.fillMaxWidth(),
                    maxLines = 3,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color.White.copy(alpha = 0.42f),
                        unfocusedBorderColor = LenteraGlassBorder,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        cursorColor = Color.White
                    ),
                    shape = RoundedCornerShape(16.dp)
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onSubmit(grade, feedback) },
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

fun formatDate(timestamp: Long): String {
    val sdf = SimpleDateFormat("dd MMM HH:mm", Locale("id", "ID"))
    return sdf.format(Date(timestamp))
}

private fun isReviewedStatus(status: String): Boolean {
    return status.equals("reviewed", ignoreCase = true) ||
        status.equals("corrected", ignoreCase = true)
}

