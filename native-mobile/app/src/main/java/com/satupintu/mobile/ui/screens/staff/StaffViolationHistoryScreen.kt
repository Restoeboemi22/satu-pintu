package com.satupintu.mobile.ui.screens.staff

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.satupintu.mobile.ui.viewmodel.StaffViolationHistoryViewModel
import com.satupintu.mobile.ui.viewmodel.ViolationHistoryItem
import com.satupintu.mobile.utils.SecurePreferences

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StaffViolationHistoryScreen(
    onNavigateBack: () -> Unit,
    viewModel: StaffViolationHistoryViewModel = viewModel()
) {
    val violations by viewModel.filteredViolations.collectAsState()
    val availableClasses by viewModel.availableClasses.collectAsState()
    val selectedClass by viewModel.selectedClass.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        val prefs = SecurePreferences.getSessionPrefs(context)
        val schoolId = prefs.getString("user_school_id", "") ?: ""
        viewModel.setSchoolScope(schoolId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Data Pelanggaran") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFFF44336), // Red for violation context
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Class Filter
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                item {
                    FilterChip(
                        selected = selectedClass == null,
                        onClick = { viewModel.filterByClass(null) },
                        label = { Text("Semua") },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = Color(0xFFF44336),
                            selectedLabelColor = Color.White
                        )
                    )
                }
                items(availableClasses) { className ->
                    FilterChip(
                        selected = selectedClass == className,
                        onClick = { viewModel.filterByClass(className) },
                        label = { Text(className) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = Color(0xFFF44336),
                            selectedLabelColor = Color.White
                        )
                    )
                }
            }

            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (violations.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Belum ada data pelanggaran")
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(violations) { violation ->
                        ViolationHistoryCard(violation)
                    }
                }
            }
        }
    }
}

@Composable
fun ViolationHistoryCard(violation: ViolationHistoryItem) {
    Card(
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = null,
                tint = Color(0xFFF44336),
                modifier = Modifier.size(40.dp)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text(
                    text = violation.studentName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${violation.studentClass} â€¢ ${violation.date}",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.Gray
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = violation.violationName,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.Black
                )
            }
        }
    }
}

