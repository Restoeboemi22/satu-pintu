package com.satupintu.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.satupintu.mobile.ui.viewmodel.DisciplineRecordWithRule
import com.satupintu.mobile.ui.viewmodel.DisciplineUiState
import com.satupintu.mobile.ui.viewmodel.DisciplineViewModel
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DisciplineScreen(
    userCredential: String,
    studentId: String,
    schoolId: String,
    onBack: () -> Unit,
    viewModel: DisciplineViewModel = viewModel()
) {
    LaunchedEffect(userCredential, studentId, schoolId) {
        viewModel.loadData(
            userCredential = userCredential,
            studentId = studentId,
            schoolId = schoolId
        )
    }

    val uiState by viewModel.uiState.collectAsState()

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
                    title = { Text("Sistem Kedisiplinan") },
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
        val pageBackground = remember {
            Brush.verticalGradient(
                colors = listOf(
                    Color(0xFF12D6C6),
                    Color(0xFF0F7BFF),
                    Color(0xFF0F2A43)
                )
            )
        }
        Box(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .background(pageBackground)
        ) {
            when (val state = uiState) {
                is DisciplineUiState.Loading -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center),
                        color = Color.White
                    )
                }
                is DisciplineUiState.Error -> {
                    Text(
                        text = state.message,
                        color = Color(0xFFFFB4A9),
                        modifier = Modifier.align(Alignment.Center).padding(16.dp)
                    )
                }
                is DisciplineUiState.Success -> {
                    DisciplineContent(
                        violationPoints = state.violationPoints,
                        achievementPoints = state.achievementPoints,
                        records = state.records
                    )
                }
            }
        }
    }
}

@Composable
fun DisciplineContent(
    violationPoints: Int,
    achievementPoints: Int,
    records: List<DisciplineRecordWithRule>
) {
    val glassBg = Color(0xFF0B1F33).copy(alpha = 0.22f)
    val glassBorder = Color.White.copy(alpha = 0.18f)
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Summary Cards
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            SummaryCard(
                title = "Pelanggaran",
                points = violationPoints,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.weight(1f),
                containerColor = glassBg,
                borderColor = glassBorder
            )
            SummaryCard(
                title = "Prestasi",
                points = achievementPoints,
                color = Color(0xFF4CAF50), // Green
                modifier = Modifier.weight(1f),
                containerColor = glassBg,
                borderColor = glassBorder
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Riwayat Catatan",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
        Spacer(modifier = Modifier.height(8.dp))

        if (records.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().weight(1f), contentAlignment = Alignment.Center) {
                Text(
                    text = "Belum ada catatan kedisiplinan.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.75f),
                    textAlign = TextAlign.Center
                )
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(bottom = 16.dp),
                modifier = Modifier.weight(1f)
            ) {
                items(records) { item ->
                    DisciplineRecordItem(item, containerColor = glassBg, borderColor = glassBorder)
                }
            }
        }
    }
}

@Composable
fun SummaryCard(
    title: String,
    points: Int,
    color: Color,
    modifier: Modifier = Modifier,
    containerColor: Color,
    borderColor: Color
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        colors = CardDefaults.cardColors(containerColor = containerColor),
        border = androidx.compose.foundation.BorderStroke(1.dp, borderColor)
    ) {
        Column(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = points.toString(),
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = color
            )
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.8f)
            )
        }
    }
}

@Composable
fun DisciplineRecordItem(item: DisciplineRecordWithRule, containerColor: Color, borderColor: Color) {
    val isViolation = item.rule?.category == "VIOLATION"
    val color = if (isViolation) MaterialTheme.colorScheme.error else Color(0xFF4CAF50)
    val icon = if (isViolation) Icons.Default.Warning else Icons.Default.CheckCircle
    val dateStr = SimpleDateFormat("dd MMM yyyy", Locale.getDefault()).format(Date(item.record.date))

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = containerColor),
        border = androidx.compose.foundation.BorderStroke(1.dp, borderColor),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(color.copy(alpha = 0.1f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = color)
            }
            
            Spacer(modifier = Modifier.width(16.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.rule?.ruleName ?: item.record.description ?: "Catatan",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = dateStr,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.75f)
                )
                if (item.record.description != null && item.record.description != item.rule?.ruleName) {
                    Text(
                        text = item.record.description,
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 1,
                        color = Color.White.copy(alpha = 0.8f)
                    )
                }
            }
            
            Text(
                text = "${item.record.points} Poin",
                style = MaterialTheme.typography.labelLarge,
                color = color,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

