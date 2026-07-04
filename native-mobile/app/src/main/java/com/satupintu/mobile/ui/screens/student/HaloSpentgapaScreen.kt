package com.satupintu.mobile.ui.screens.student

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.satupintu.mobile.data.model.BullyingReport
import com.satupintu.mobile.ui.viewmodel.HaloSpentgapaViewModel
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HaloSpentgapaScreen(
    studentCredential: String,
    studentId: String,
    schoolId: String,
    onNavigateBack: () -> Unit,
    onNavigateToReport: (String) -> Unit,
    viewModel: HaloSpentgapaViewModel = viewModel()
) {
    val reports by viewModel.reports.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    
    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("Layanan", "Riwayat Laporan")
    val pageBackground = remember {
        Brush.verticalGradient(
            colors = listOf(
                Color(0xFF12D6C6),
                Color(0xFF0F7BFF),
                Color(0xFF0F2A43)
            )
        )
    }

    LaunchedEffect(studentCredential, studentId, schoolId) {
        viewModel.loadReports(
            studentCredential = studentCredential,
            studentId = studentId,
            schoolId = schoolId
        )
    }

    Scaffold(
        topBar = {
            Column {
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
                        title = { Text("Layanan Aduan") },
                        navigationIcon = {
                            IconButton(onClick = onNavigateBack) {
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
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF0B1F33).copy(alpha = 0.28f))
                ) {
                    TabRow(
                        selectedTabIndex = selectedTab,
                        containerColor = Color.Transparent,
                        contentColor = Color.White,
                        divider = {},
                        indicator = { tabPositions ->
                            val currentTab = tabPositions[selectedTab]
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .wrapContentSize(Alignment.BottomStart)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .offset(x = currentTab.left)
                                        .width(currentTab.width)
                                        .height(3.dp)
                                        .background(Color.White, RoundedCornerShape(999.dp))
                                )
                            }
                        }
                    ) {
                        tabs.forEachIndexed { index, title ->
                            Tab(
                                selected = selectedTab == index,
                                onClick = { selectedTab = index },
                                selectedContentColor = Color.White,
                                unselectedContentColor = Color.White.copy(alpha = 0.76f),
                                text = { Text(title) }
                            )
                        }
                    }
                }
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .background(pageBackground)
        ) {
            if (selectedTab == 0) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.Top,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Layanan Pengaduan Siswa",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                    
                    Text(
                        text = "Pilih jenis laporan yang ingin Anda sampaikan. Identitas Anda aman.",
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center,
                        color = Color.White.copy(alpha = 0.8f),
                        modifier = Modifier.padding(bottom = 24.dp)
                    )

                    MenuCard(
                        title = "Lapor Bullying",
                        description = "Laporkan tindakan perundungan (bullying) fisik, verbal, atau cyber.",
                        icon = Icons.Default.Warning,
                        color = Color(0xFFE53935), // Red
                        onClick = { onNavigateToReport("BULLYING") }
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    MenuCard(
                        title = "Lapor Peristiwa",
                        description = "Laporkan kejadian lain seperti tawuran, kecelakaan, kehilangan, atau kerusakan fasilitas.",
                        icon = Icons.Default.Info,
                        color = Color(0xFFFB8C00), // Orange
                        onClick = { onNavigateToReport("INCIDENT") }
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    if (isLoading) {
                        item { 
                            Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator(color = Color.White) 
                            }
                        }
                    } else if (reports.isEmpty()) {
                        item {
                            Column(
                                modifier = Modifier.fillMaxWidth().padding(top = 32.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Info,
                                    contentDescription = null,
                                    tint = Color.White.copy(alpha = 0.75f),
                                    modifier = Modifier.size(48.dp)
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                                Text(
                                    text = "Belum ada riwayat laporan",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Color.White.copy(alpha = 0.75f)
                                )
                            }
                        }
                    } else {
                        items(reports) { report ->
                            ReportHistoryCard(report)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ReportHistoryCard(report: BullyingReport) {
    val isResolved = report.status == "RESOLVED" || report.status == "CLOSED"
    val statusColor = if (isResolved) Color(0xFF4CAF50) else Color(0xFFFFA000)
    val statusText = when(report.status) {
        "PENDING" -> "Menunggu"
        "INVESTIGATING" -> "Sedang Diproses"
        "RESOLVED" -> "Ditindaklanjuti"
        "CLOSED" -> "Selesai"
        else -> report.status
    }
    
    val dateStr = remember(report.createdAt) {
        val sdf = SimpleDateFormat("dd MMM yyyy HH:mm", Locale.getDefault())
        sdf.format(Date(report.createdAt))
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0B1F33).copy(alpha = 0.22f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.18f))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (report.category == "INCIDENT") "Laporan Peristiwa" else "Laporan Bullying",
                    style = MaterialTheme.typography.labelMedium,
                    color = Color.White.copy(alpha = 0.75f)
                )
                Surface(
                    color = statusColor.copy(alpha = 0.18f),
                    contentColor = statusColor,
                    shape = RoundedCornerShape(999.dp)
                ) {
                    Text(
                        text = statusText,
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = report.description ?: "Tidak ada deskripsi",
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 2,
                color = Color.White.copy(alpha = 0.9f)
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Info, // Clock icon would be better but using available
                    contentDescription = null,
                    modifier = Modifier.size(12.dp),
                    tint = Color.White.copy(alpha = 0.7f)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = dateStr,
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.7f)
                )
            }
        }
    }
}

@Composable
fun MenuCard(
    title: String,
    description: String,
    icon: ImageVector,
    color: Color,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(20.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0B1F33).copy(alpha = 0.22f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.18f))
    ) {
        Row(
            modifier = Modifier
                .padding(24.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = color.copy(alpha = 0.18f),
                modifier = Modifier.size(56.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }
            
            Spacer(modifier = Modifier.width(16.dp))
            
            Column {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.8f),
                    lineHeight = 16.sp
                )
            }
        }
    }
}

