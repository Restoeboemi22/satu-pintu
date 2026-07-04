package com.satupintu.mobile.ui.screens.student

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
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
import com.satupintu.mobile.ui.viewmodel.ReportBullyingViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportBullyingScreen(
    userCredential: String,
    studentId: String,
    schoolId: String,
    category: String = "BULLYING",
    onNavigateBack: () -> Unit,
    viewModel: ReportBullyingViewModel = viewModel()
) {
    val context = LocalContext.current
    val isLoading by viewModel.isLoading.collectAsState()
    val isSuccess by viewModel.isSuccess.collectAsState()
    val error by viewModel.error.collectAsState()

    // Determine incident types based on category
    val incidentTypes = if (category == "INCIDENT") {
        listOf("TAWURAN", "KECELAKAAN", "KEHILANGAN", "KERUSAKAN_FASILITAS", "LAINNYA")
    } else {
        listOf("VERBAL", "PHYSICAL", "CYBER", "SOCIAL", "SEXUAL", "OTHER")
    }

    var incidentType by remember { mutableStateOf(incidentTypes.first()) }
    var incidentLocation by remember { mutableStateOf("") }
    var victimName by remember { mutableStateOf("") }
    var perpetratorName by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var isAnonymous by remember { mutableStateOf(false) }
    var incidentTypeExpanded by remember { mutableStateOf(false) }
    
    val screenTitle = if (category == "INCIDENT") "Lapor Peristiwa" else "Lapor Bullying"
    val pageBackground = remember {
        Brush.verticalGradient(
            colors = listOf(
                Color(0xFF12D6C6),
                Color(0xFF0F7BFF),
                Color(0xFF0F2A43)
            )
        )
    }
    val glassCard = Color(0xFF0B1F33).copy(alpha = 0.22f)
    val glassBorder = Color.White.copy(alpha = 0.18f)
    val textSecondary = Color.White.copy(alpha = 0.78f)

    LaunchedEffect(isSuccess) {
        if (isSuccess) {
            Toast.makeText(context, "Laporan berhasil dikirim", Toast.LENGTH_LONG).show()
            viewModel.resetState()
            onNavigateBack()
        }
    }

    LaunchedEffect(error) {
        if (error != null) {
            Toast.makeText(context, error, Toast.LENGTH_LONG).show()
        }
    }

    Scaffold(
        containerColor = Color.Transparent,
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
                    title = { Text(screenTitle, fontWeight = FontWeight.Bold) },
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
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .padding(paddingValues)
                .fillMaxSize()
                .background(pageBackground)
        ) {
            Card(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                shape = RoundedCornerShape(22.dp),
                colors = CardDefaults.cardColors(containerColor = glassCard),
                border = androidx.compose.foundation.BorderStroke(1.dp, glassBorder)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = if (category == "INCIDENT") {
                            "Laporkan peristiwa yang terjadi dengan aman dan jelas."
                        } else {
                            "Laporkan bullying dengan aman. Identitas pelapor bisa disamarkan."
                        },
                        color = textSecondary,
                        style = MaterialTheme.typography.bodyMedium
                    )

                    // Anonymous Toggle
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Checkbox(
                            checked = isAnonymous,
                            onCheckedChange = { isAnonymous = it },
                            colors = CheckboxDefaults.colors(
                                checkedColor = Color.White.copy(alpha = 0.18f),
                                uncheckedColor = textSecondary,
                                checkmarkColor = Color.White
                            )
                        )
                        Text("Lapor sebagai Anonim", color = Color.White)
                    }

                    // Incident Type Dropdown
                    ExposedDropdownMenuBox(
                        expanded = incidentTypeExpanded,
                        onExpandedChange = { incidentTypeExpanded = !incidentTypeExpanded }
                    ) {
                        OutlinedTextField(
                            value = incidentType,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Jenis Kejadian") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = incidentTypeExpanded) },
                            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(
                                focusedBorderColor = Color.White.copy(alpha = 0.42f),
                                unfocusedBorderColor = glassBorder,
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedContainerColor = Color.White.copy(alpha = 0.08f),
                                unfocusedContainerColor = Color.White.copy(alpha = 0.08f),
                                focusedLabelColor = Color.White,
                                unfocusedLabelColor = textSecondary
                            ),
                            modifier = Modifier.menuAnchor().fillMaxWidth()
                        )
                        ExposedDropdownMenu(
                            expanded = incidentTypeExpanded,
                            onDismissRequest = { incidentTypeExpanded = false }
                        ) {
                            incidentTypes.forEach { type ->
                                DropdownMenuItem(
                                    text = { Text(type) },
                                    onClick = {
                                        incidentType = type
                                        incidentTypeExpanded = false
                                    }
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = incidentLocation,
                        onValueChange = { incidentLocation = it },
                        label = { Text("Lokasi Kejadian") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color.White.copy(alpha = 0.42f),
                            unfocusedBorderColor = glassBorder,
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedContainerColor = Color.White.copy(alpha = 0.08f),
                            unfocusedContainerColor = Color.White.copy(alpha = 0.08f),
                            focusedLabelColor = Color.White,
                            unfocusedLabelColor = textSecondary,
                            cursorColor = Color.White
                        )
                    )

                    OutlinedTextField(
                        value = victimName,
                        onValueChange = { victimName = it },
                        label = { Text("Nama Korban (Opsional)") },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Kosongkan jika tidak tahu", color = textSecondary) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color.White.copy(alpha = 0.42f),
                            unfocusedBorderColor = glassBorder,
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedContainerColor = Color.White.copy(alpha = 0.08f),
                            unfocusedContainerColor = Color.White.copy(alpha = 0.08f),
                            focusedLabelColor = Color.White,
                            unfocusedLabelColor = textSecondary,
                            focusedPlaceholderColor = textSecondary,
                            unfocusedPlaceholderColor = textSecondary,
                            cursorColor = Color.White
                        )
                    )

                    OutlinedTextField(
                        value = perpetratorName,
                        onValueChange = { perpetratorName = it },
                        label = { Text("Nama Pelaku (Opsional)") },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Kosongkan jika tidak tahu", color = textSecondary) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color.White.copy(alpha = 0.42f),
                            unfocusedBorderColor = glassBorder,
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedContainerColor = Color.White.copy(alpha = 0.08f),
                            unfocusedContainerColor = Color.White.copy(alpha = 0.08f),
                            focusedLabelColor = Color.White,
                            unfocusedLabelColor = textSecondary,
                            focusedPlaceholderColor = textSecondary,
                            unfocusedPlaceholderColor = textSecondary,
                            cursorColor = Color.White
                        )
                    )

                    OutlinedTextField(
                        value = description,
                        onValueChange = { description = it },
                        label = { Text("Deskripsi Kejadian") },
                        modifier = Modifier.fillMaxWidth().height(120.dp),
                        minLines = 3,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color.White.copy(alpha = 0.42f),
                            unfocusedBorderColor = glassBorder,
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedContainerColor = Color.White.copy(alpha = 0.08f),
                            unfocusedContainerColor = Color.White.copy(alpha = 0.08f),
                            focusedLabelColor = Color.White,
                            unfocusedLabelColor = textSecondary,
                            cursorColor = Color.White
                        )
                    )

                    Button(
                        onClick = {
                            if (description.isBlank() || incidentLocation.isBlank()) {
                                Toast.makeText(context, "Mohon lengkapi lokasi dan deskripsi", Toast.LENGTH_SHORT).show()
                                return@Button
                            }
                            
                            viewModel.submitReport(
                                userCredential = userCredential,
                                studentId = studentId,
                                schoolId = schoolId,
                                isAnonymous = isAnonymous,
                                category = category,
                                incidentType = incidentType,
                                description = description,
                                victimName = victimName.ifBlank { null } ?: "",
                                perpetratorName = perpetratorName.ifBlank { null } ?: "",
                                incidentLocation = incidentLocation,
                                incidentDate = System.currentTimeMillis()
                            )
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isLoading,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color.White.copy(alpha = 0.16f),
                            contentColor = Color.White
                        )
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                color = Color.White,
                                modifier = Modifier.size(24.dp)
                            )
                        } else {
                            Text("Kirim Laporan")
                        }
                    }
                }
            }
        }
    }
}

