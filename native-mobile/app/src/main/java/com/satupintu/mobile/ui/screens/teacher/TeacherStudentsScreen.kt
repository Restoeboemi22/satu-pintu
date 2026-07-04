package com.satupintu.mobile.ui.screens.teacher

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.satupintu.mobile.data.model.Student
import com.satupintu.mobile.data.model.VirtualPet
import com.satupintu.mobile.ui.viewmodel.TeacherStudentsViewModel

private val LenteraPageBrush = Brush.verticalGradient(
    colors = listOf(Color(0xFF12D6C6), Color(0xFF0F7BFF), Color(0xFF0F2A43))
)

private val LenteraHeaderBrush = Brush.horizontalGradient(
    colors = listOf(Color(0xFF0F2A43), Color(0xFF0F7BFF))
)

private val LenteraGlassCard = Color(0xFF0B1F33).copy(alpha = 0.22f)
private val LenteraGlassBorder = Color.White.copy(alpha = 0.18f)
private val LenteraTextSecondary = Color.White.copy(alpha = 0.78f)
private val StudentTableDividerColor = Color.White.copy(alpha = 0.24f)

private val TABLE_NO_WIDTH = 40.dp
private val TABLE_NISN_WIDTH = 90.dp
private val TABLE_CLASS_WIDTH = 70.dp
private val TABLE_PET_WIDTH = 80.dp
private val TABLE_ROW_HEIGHT = 48.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TeacherStudentsScreen(
    teacherNuptk: String,
    onBack: () -> Unit,
    viewModel: TeacherStudentsViewModel = viewModel()
) {
    val students by viewModel.filteredStudents.collectAsState()
    val studentPets by viewModel.studentPets.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val teacher by viewModel.teacher.collectAsState()

    LaunchedEffect(teacherNuptk) {
        if (teacherNuptk.isNotEmpty()) {
            viewModel.setTeacherNuptk(teacherNuptk)
        }
    }

    var selectedStudent by remember { mutableStateOf<Student?>(null) }

    if (selectedStudent != null) {
        AlertDialog(
            onDismissRequest = { selectedStudent = null },
            title = { Text(text = "Detail Siswa", style = MaterialTheme.typography.headlineSmall, color = Color.White) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    DetailItem("Nama", selectedStudent!!.name)
                    DetailItem("NISN", selectedStudent!!.nisn)
                    DetailItem("Kelas", selectedStudent!!.className)
                    DetailItem("Jenis Kelamin", if (selectedStudent!!.gender == "L") "Laki-laki" else "Perempuan")
                    HorizontalDivider(color = LenteraGlassBorder, modifier = Modifier.padding(vertical = 4.dp))
                    DetailItem("Nama Orang Tua", selectedStudent!!.parentName ?: "-")
                    DetailItem("No. HP Orang Tua", selectedStudent!!.parentPhone ?: "-")
                    HorizontalDivider(color = LenteraGlassBorder, modifier = Modifier.padding(vertical = 4.dp))
                    DetailItem("Device ID", selectedStudent!!.deviceId ?: "Belum Terdaftar")
                }
            },
            confirmButton = {
                TextButton(onClick = { selectedStudent = null }) {
                    Text("Tutup", color = Color.White)
                }
            },
            containerColor = Color(0xFF0F2A43),
            shape = RoundedCornerShape(20.dp)
        )
    }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            Box(modifier = Modifier.fillMaxWidth().background(LenteraHeaderBrush)) {
                TopAppBar(
                    title = {
                        Column {
                            Text("Data Siswa", fontWeight = FontWeight.Bold)
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
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { viewModel.onSearchQueryChanged(it) },
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    placeholder = { Text("Cari nama, NISN, atau kelas...", color = LenteraTextSecondary) },
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
                    if (students.isEmpty()) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text("Tidak ada data siswa", style = MaterialTheme.typography.bodyLarge, color = Color.White)
                        }
                    } else {
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f)
                                .padding(horizontal = 16.dp),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = LenteraGlassCard),
                            border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder)
                        ) {
                            Column(modifier = Modifier.fillMaxSize()) {
                                StudentTableHeader()
                                HorizontalDivider(color = StudentTableDividerColor, thickness = 1.dp)
                                LazyColumn(modifier = Modifier.fillMaxSize()) {
                                    itemsIndexed(students) { index, student ->
                                        val pet = studentPets[student.id]
                                        StudentTableRow(
                                            index = index + 1,
                                            student = student,
                                            pet = pet,
                                            onClick = { selectedStudent = student }
                                        )
                                        if (index != students.lastIndex) {
                                            HorizontalDivider(
                                                color = StudentTableDividerColor,
                                                thickness = 1.dp
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))
                    }
                }
            }
        }
    }
}

@Composable
fun StudentTableHeader() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.1f))
            .height(TABLE_ROW_HEIGHT)
            .padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        StudentTableHeaderCell("NO", Modifier.width(TABLE_NO_WIDTH), withRightBorder = false)
        StudentColumnDivider(modifier = Modifier.fillMaxHeight())
        StudentTableHeaderCell("NISN", Modifier.width(TABLE_NISN_WIDTH), withRightBorder = false)
        StudentColumnDivider(modifier = Modifier.fillMaxHeight())
        StudentTableHeaderCell("NAMA", Modifier.weight(1f), withRightBorder = false)
        StudentColumnDivider(modifier = Modifier.fillMaxHeight())
        StudentTableHeaderCell("KELAS", Modifier.width(TABLE_CLASS_WIDTH), withRightBorder = false)
        StudentColumnDivider(modifier = Modifier.fillMaxHeight())
        StudentTableHeaderCell("PET", Modifier.width(TABLE_PET_WIDTH), withRightBorder = false)
    }
}

@Composable
fun StudentTableRow(
    index: Int,
    student: Student,
    pet: VirtualPet?,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .height(TABLE_ROW_HEIGHT)
            .padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .width(TABLE_NO_WIDTH)
                .fillMaxHeight(),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = index.toString(),
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                textAlign = TextAlign.Center
            )
        }
        StudentColumnDivider(modifier = Modifier.fillMaxHeight())

        Box(
            modifier = Modifier
                .width(TABLE_NISN_WIDTH)
                .fillMaxHeight(),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = student.nisn,
                style = MaterialTheme.typography.bodySmall,
                color = LenteraTextSecondary,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        StudentColumnDivider(modifier = Modifier.fillMaxHeight())

        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight(),
            contentAlignment = Alignment.CenterStart
        ) {
            Text(
                text = student.name,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.SemiBold,
                color = Color.White,
                modifier = Modifier.padding(horizontal = 8.dp),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        StudentColumnDivider(modifier = Modifier.fillMaxHeight())

        Box(
            modifier = Modifier
                .width(TABLE_CLASS_WIDTH)
                .fillMaxHeight(),
            contentAlignment = Alignment.Center
        ) {
            Surface(
                shape = RoundedCornerShape(6.dp),
                color = Color(0xFF0F7BFF).copy(alpha = 0.2f)
            ) {
                Text(
                    text = student.className.replace("Kelas ", ""),
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFF93C5FD),
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
        StudentColumnDivider(modifier = Modifier.fillMaxHeight())

        Box(
            modifier = Modifier
                .width(TABLE_PET_WIDTH)
                .fillMaxHeight(),
            contentAlignment = Alignment.Center
        ) {
            val isDead = pet?.status == "DEAD" || (pet?.health ?: 0) <= 0
            val isSick = !isDead && ((pet?.health ?: 100) < 30 || (pet?.happiness ?: 100) < 30)

            Surface(
                shape = RoundedCornerShape(6.dp),
                color = when {
                    pet == null -> Color.Gray.copy(alpha = 0.2f)
                    isDead -> Color(0xFFF44336).copy(alpha = 0.2f)
                    isSick -> Color(0xFFFF9800).copy(alpha = 0.2f)
                    else -> Color(0xFF4CAF50).copy(alpha = 0.2f)
                }
            ) {
                Text(
                    text = when {
                        pet == null -> "-"
                        isDead -> "Mati"
                        isSick -> "Sakit"
                        else -> "Sehat"
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = when {
                        pet == null -> Color.Gray
                        isDead -> Color(0xFFF44336)
                        isSick -> Color(0xFFFF9800)
                        else -> Color(0xFF4CAF50)
                    },
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
fun StudentColumnDivider(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .width(1.dp)
            .background(StudentTableDividerColor)
    )
}

@Composable
fun StudentTableHeaderCell(
    text: String,
    modifier: Modifier = Modifier,
    withRightBorder: Boolean = false
) {
    Box(
        modifier = modifier.fillMaxHeight(),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            textAlign = TextAlign.Center
        )
        if (withRightBorder) {
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .width(1.dp)
                    .align(Alignment.CenterEnd)
                    .background(StudentTableDividerColor)
            )
        }
    }
}

@Composable
fun DetailItem(label: String, value: String) {
    Column {
        Text(text = label, style = MaterialTheme.typography.labelMedium, color = LenteraTextSecondary)
        Text(text = value, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium, color = Color.White)
    }
}

