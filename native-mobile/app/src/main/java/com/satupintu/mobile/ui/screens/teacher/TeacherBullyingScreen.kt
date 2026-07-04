package com.satupintu.mobile.ui.screens.teacher

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Warning
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
import com.satupintu.mobile.data.model.BullyingReport
import com.satupintu.mobile.ui.viewmodel.TeacherBullyingViewModel
import java.text.SimpleDateFormat
import java.util.*

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
fun TeacherBullyingScreen(
    teacherNuptk: String,
    onBack: () -> Unit,
    viewModel: TeacherBullyingViewModel = viewModel()
) {
    val reports by viewModel.reports.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val teacher by viewModel.teacher.collectAsState()

    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Lapor Bullying", "Lapor Peristiwa")

    LaunchedEffect(teacherNuptk) {
        if (teacherNuptk.isNotEmpty()) {
            viewModel.setTeacherNuptk(teacherNuptk)
        }
    }

    val filteredReports = remember(reports, selectedTab) {
        reports.filter { report ->
            if (selectedTab == 0) {
                report.category == "BULLYING" || report.category == null
            } else {
                report.category == "INCIDENT"
            }
        }
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
                            Text("Layanan Aduan", fontWeight = FontWeight.Bold)
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
                    tabs.forEachIndexed { index, title ->
                        Tab(
                            selected = selectedTab == index,
                            onClick = { selectedTab = index },
                            selectedContentColor = Color.White,
                            unselectedContentColor = Color.White.copy(alpha = 0.7f),
                            text = { Text(title) }
                        )
                    }
                }

                Box(modifier = Modifier.weight(1f).fillMaxWidth().padding(16.dp)) {
                    if (isLoading) {
                        CircularProgressIndicator(modifier = Modifier.align(Alignment.Center), color = Color.White)
                    } else {
                        if (filteredReports.isEmpty()) {
                            Column(
                                modifier = Modifier.align(Alignment.Center),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = Color(0xFF4CAF50),
                                    modifier = Modifier.size(48.dp)
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                                Text("Tidak ada laporan masuk", color = Color.White)
                            }
                        } else {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                items(filteredReports) { report ->
                                    BullyingReportCard(
                                        report = report,
                                        onMarkHandled = { viewModel.markAsHandled(report.id) },
                                        onMarkUnhandled = { viewModel.markAsUnhandled(report.id) }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun BullyingReportCard(
    report: BullyingReport,
    onMarkHandled: () -> Unit,
    onMarkUnhandled: () -> Unit
) {
    val isHandled = report.status == "RESOLVED" || report.status == "CLOSED"
    val dateFormatter = SimpleDateFormat("dd MMM yyyy, HH:mm", Locale("id", "ID"))

    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = LenteraGlassCard),
        border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                SuggestionChip(
                    onClick = { },
                    label = { Text(report.incidentType, color = Color.White) },
                    colors = SuggestionChipDefaults.suggestionChipColors(
                        containerColor = Color.White.copy(alpha = 0.15f)
                    )
                )
                Text(
                    text = dateFormatter.format(Date(report.createdAt)),
                    style = MaterialTheme.typography.labelSmall,
                    color = LenteraTextSecondary
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = report.description ?: "Tidak ada deskripsi",
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 4,
                overflow = TextOverflow.Ellipsis,
                color = Color.White
            )

            Spacer(modifier = Modifier.height(12.dp))

            HorizontalDivider(color = LenteraGlassBorder, thickness = 0.5.dp)
            Spacer(modifier = Modifier.height(8.dp))

            if (!report.isAnonymous) {
                ReportDetailRow("Pelapor", report.reporterName ?: "-")
            } else {
                ReportDetailRow("Pelapor", "${report.reporterName ?: "Siswa"} (Anonim)")
            }

            if (!report.victimName.isNullOrEmpty()) {
                ReportDetailRow("Korban", report.victimName)
            }

            if (!report.perpetratorName.isNullOrEmpty()) {
                ReportDetailRow("Pelaku", report.perpetratorName)
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Status Penanganan:",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = LenteraTextSecondary
            )
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onMarkUnhandled,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (!isHandled) Color(0xFFF44336) else Color.Transparent,
                        contentColor = if (!isHandled) Color.White else Color.Gray
                    ),
                    border = if (isHandled) androidx.compose.foundation.BorderStroke(1.dp, Color.Gray) else null,
                    shape = RoundedCornerShape(12.dp)
                ) {
                    if (!isHandled) {
                        Icon(Icons.Default.Warning, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                    }
                    Text("Belum")
                }

                Button(
                    onClick = onMarkHandled,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isHandled) Color(0xFF4CAF50) else Color.Transparent,
                        contentColor = if (isHandled) Color.White else Color.Gray
                    ),
                    border = if (!isHandled) androidx.compose.foundation.BorderStroke(1.dp, Color.Gray) else null,
                    shape = RoundedCornerShape(12.dp)
                ) {
                    if (isHandled) {
                        Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                    }
                    Text("Sudah")
                }
            }
        }
    }
}

@Composable
fun ReportDetailRow(label: String, value: String) {
    Row(modifier = Modifier.padding(vertical = 2.dp)) {
        Text(
            text = "$label: ",
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Bold,
            color = LenteraTextSecondary,
            modifier = Modifier.width(70.dp)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            color = Color.White
        )
    }
}

