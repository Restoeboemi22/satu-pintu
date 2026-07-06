package com.satupintu.mobile.ui.screens.staff

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.satupintu.mobile.data.model.DisciplineRule
import com.satupintu.mobile.data.model.Student
import com.satupintu.mobile.ui.viewmodel.StaffDisciplineViewModel
import com.satupintu.mobile.util.SecurityUtils
import com.satupintu.mobile.utils.SecurePreferences
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StaffDisciplineScreen(
    onNavigateBack: () -> Unit
) {
    val viewModel: StaffDisciplineViewModel = viewModel()
    val allStudents by viewModel.filteredStudents.collectAsState()
    val rules by viewModel.rules.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val selectedStudent by viewModel.selectedStudent.collectAsState()
    val availableClasses by viewModel.availableClasses.collectAsState()
    val selectedClass by viewModel.selectedClass.collectAsState()
    
    val context = LocalContext.current
    var searchQuery by remember { mutableStateOf("") }
    var showInputDialog by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        val prefs = SecurePreferences.getSessionPrefs(context)
        val displayName = prefs.getString("user_display_name", "") ?: ""
        val credential = SecurityUtils.getStoredLoginKey(prefs)
        val schoolId = SecurityUtils.getStoredSchoolId(prefs)
        viewModel.setReporterSession(displayName = displayName, credential = credential)
        viewModel.setSchoolScope(schoolId)
    }

    // Handle dialog visibility based on selection
    LaunchedEffect(selectedStudent) {
        if (selectedStudent != null) {
            showInputDialog = true
        }
    }

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
    val glassStrong = Color(0xFF0B1F33).copy(alpha = 0.38f)
    val glassBorder = Color.White.copy(alpha = 0.18f)

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
                    title = { 
                        Column {
                            Text("Catat Pelanggaran", fontWeight = FontWeight.Bold)
                            Text("Panel Petugas OSIS", style = MaterialTheme.typography.bodySmall)
                        }
                    },
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
                .fillMaxSize()
                .background(pageBackground)
                .padding(paddingValues)
        ) {
            Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                // Search Bar
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { 
                        searchQuery = it
                        viewModel.searchStudents(it)
                    },
                    label = { Text("Cari Siswa (Nama/Kelas)") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Color.White) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color.White.copy(alpha = 0.42f),
                        unfocusedBorderColor = glassBorder,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedContainerColor = glassCard,
                        unfocusedContainerColor = glassCard,
                        focusedLabelColor = Color.White,
                        unfocusedLabelColor = Color.White.copy(alpha = 0.78f),
                        cursorColor = Color.White
                    )
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                // Class Filter
                Text("Filter Kelas", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold, color = Color.White)
                Spacer(modifier = Modifier.height(8.dp))
                
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    item {
                        FilterChip(
                            selected = selectedClass == null,
                            onClick = { viewModel.filterByClass(null) },
                            label = { Text("Semua") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Color.White.copy(alpha = 0.16f),
                                selectedLabelColor = Color.White,
                                containerColor = glassCard,
                                labelColor = Color.White.copy(alpha = 0.78f)
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = selectedClass == null,
                                borderColor = glassBorder,
                                selectedBorderColor = Color.White.copy(alpha = 0.32f)
                            )
                        )
                    }
                    items(availableClasses) { className ->
                        FilterChip(
                            selected = selectedClass == className,
                            onClick = { viewModel.filterByClass(className) },
                            label = { Text(className) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Color.White.copy(alpha = 0.16f),
                                selectedLabelColor = Color.White,
                                containerColor = glassCard,
                                labelColor = Color.White.copy(alpha = 0.78f)
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = selectedClass == className,
                                borderColor = glassBorder,
                                selectedBorderColor = Color.White.copy(alpha = 0.32f)
                            )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
                
                Text("Daftar Siswa", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
                
                Spacer(modifier = Modifier.height(8.dp))

                // Student List
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(allStudents) { student ->
                        StaffStudentCard(student = student) {
                            viewModel.selectStudent(student)
                        }
                    }
                }
            }

            if (isLoading) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center), color = Color.White)
            }
        }
    }

    if (showInputDialog && selectedStudent != null) {
        StaffInputViolationDialog(
            student = selectedStudent!!,
            rules = rules,
            onDismiss = {
                showInputDialog = false
                viewModel.clearSelection()
            },
            onSubmit = { rule, desc, date ->
                viewModel.addRecord(rule, desc, date) { success ->
                    if (success) {
                        Toast.makeText(context, "Pelanggaran berhasil dicatat", Toast.LENGTH_SHORT).show()
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
fun StaffStudentCard(student: Student, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable { onClick() },
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0B1F33).copy(alpha = 0.22f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.18f))
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.14f)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = student.name.take(1).uppercase(),
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
            
            Spacer(modifier = Modifier.width(16.dp))
            
            Column {
                Text(student.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
                Text(student.className, style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = 0.78f))
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StaffInputViolationDialog(
    student: Student,
    rules: List<DisciplineRule>,
    onDismiss: () -> Unit,
    onSubmit: (DisciplineRule, String, Long) -> Unit
) {
    var selectedRule by remember { mutableStateOf<DisciplineRule?>(null) }
    var description by remember { mutableStateOf("") }
    var isDropdownExpanded by remember { mutableStateOf(false) }
    
    // Date Picker State
    var selectedDateMillis by remember { mutableStateOf(System.currentTimeMillis()) }
    var showDatePicker by remember { mutableStateOf(false) }
    val datePickerState = rememberDatePickerState(initialSelectedDateMillis = selectedDateMillis)

    // Filter rules to violations only
    val violationRules = rules.filter { it.category == "VIOLATION" }
    
    // Format Date
    val dateFormatter = SimpleDateFormat("EEEE, dd MMMM yyyy", Locale("id", "ID"))

    if (showDatePicker) {
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        datePickerState.selectedDateMillis?.let {
                            selectedDateMillis = it
                        }
                        showDatePicker = false
                    }
                ) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Batal") }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF0B1F33).copy(alpha = 0.96f),
        titleContentColor = Color.White,
        textContentColor = Color.White,
        title = { Text("Catat Pelanggaran") },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                Text("Siswa: ${student.name} (${student.className})", fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(16.dp))
                
                // Date Selection
                OutlinedTextField(
                    value = dateFormatter.format(Date(selectedDateMillis)),
                    onValueChange = {},
                    label = { Text("Tanggal Kejadian") },
                    readOnly = true,
                    trailingIcon = { 
                        IconButton(onClick = { showDatePicker = true }) {
                            Icon(Icons.Default.DateRange, contentDescription = "Pilih Tanggal")
                        }
                    },
                    modifier = Modifier.fillMaxWidth().clickable { showDatePicker = true },
                    enabled = false, // Disable text input, handle click on modifier
                    colors = OutlinedTextFieldDefaults.colors(
                        disabledTextColor = Color.White,
                        disabledBorderColor = Color.White.copy(alpha = 0.18f),
                        disabledLabelColor = Color.White.copy(alpha = 0.78f),
                        disabledTrailingIconColor = Color.White.copy(alpha = 0.78f),
                        disabledContainerColor = Color.White.copy(alpha = 0.08f)
                    )
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                // Rule Selection
                ExposedDropdownMenuBox(
                    expanded = isDropdownExpanded,
                    onExpandedChange = { isDropdownExpanded = it }
                ) {
                    OutlinedTextField(
                        value = selectedRule?.ruleName ?: "Pilih Jenis Pelanggaran",
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = isDropdownExpanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                        colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(
                            focusedBorderColor = Color.White.copy(alpha = 0.42f),
                            unfocusedBorderColor = Color.White.copy(alpha = 0.18f),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedContainerColor = Color.White.copy(alpha = 0.08f),
                            unfocusedContainerColor = Color.White.copy(alpha = 0.08f)
                        )
                    )
                    ExposedDropdownMenu(
                        expanded = isDropdownExpanded,
                        onDismissRequest = { isDropdownExpanded = false }
                    ) {
                        violationRules.forEach { rule ->
                            DropdownMenuItem(
                                text = { 
                                    Column {
                                        Text(rule.ruleName, fontWeight = FontWeight.Bold)
                                        Text("${rule.points} Poin", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                                    }
                                },
                                onClick = {
                                    selectedRule = rule
                                    isDropdownExpanded = false
                                }
                            )
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(8.dp))
                
                // Description
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Keterangan Tambahan (Opsional)") },
                    modifier = Modifier.fillMaxWidth(),
                    maxLines = 3,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color.White.copy(alpha = 0.42f),
                        unfocusedBorderColor = Color.White.copy(alpha = 0.18f),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedContainerColor = Color.White.copy(alpha = 0.08f),
                        unfocusedContainerColor = Color.White.copy(alpha = 0.08f),
                        focusedLabelColor = Color.White,
                        unfocusedLabelColor = Color.White.copy(alpha = 0.78f),
                        cursorColor = Color.White
                    )
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (selectedRule != null) {
                        onSubmit(selectedRule!!, description, selectedDateMillis)
                    }
                },
                enabled = selectedRule != null,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.White.copy(alpha = 0.16f),
                    contentColor = Color.White
                )
            ) {
                Text("Simpan")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Batal", color = Color.White.copy(alpha = 0.78f))
            }
        }
    )
}

