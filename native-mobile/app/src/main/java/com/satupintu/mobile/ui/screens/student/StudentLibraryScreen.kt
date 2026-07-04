package com.satupintu.mobile.ui.screens.student

import android.widget.Toast
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import com.satupintu.mobile.data.model.LiteracyTask
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.satupintu.mobile.R
import com.satupintu.mobile.data.model.Book
import com.satupintu.mobile.ui.viewmodel.StudentLibraryViewModel

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
private val LenteraGlassStrong = Color(0xFF0B1F33).copy(alpha = 0.38f)
private val LenteraGlassBorder = Color.White.copy(alpha = 0.18f)
private val LenteraTextSecondary = Color.White.copy(alpha = 0.78f)
private val LenteraAccent = Color(0xFF93C5FD)
private val LenteraAccentStrong = Color(0xFF12D6C6)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LenteraTopBar(
    title: String,
    onBack: () -> Unit,
    actions: @Composable RowScope.() -> Unit = {}
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(LenteraHeaderBrush)
    ) {
        TopAppBar(
            title = { Text(title, fontWeight = FontWeight.Bold) },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                }
            },
            actions = actions,
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = Color.Transparent,
                titleContentColor = Color.White,
                navigationIconContentColor = Color.White,
                actionIconContentColor = Color.White
            )
        )
    }
}

@Composable
private fun LenteraGlassCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = LenteraGlassCard),
        border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(content = content)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StudentLibraryScreen(
    studentId: String,
    initialStudentName: String = "",
    initialStudentClass: String = "",
    initialStudentSchoolId: String = "",
    onBack: () -> Unit,
    onReadBook: (String, String) -> Unit,
    viewModel: StudentLibraryViewModel = viewModel()
) {
    var selectedTab by remember { mutableStateOf(1) } // Default to Katalog (1) as per user feedback/screenshot context
    var studentName by remember { mutableStateOf(initialStudentName.ifBlank { "Siswa" }) }
    var studentSchoolId by remember { mutableStateOf(initialStudentSchoolId.trim().lowercase()) }
    var studentClass by remember { mutableStateOf(initialStudentClass) }

    LaunchedEffect(studentId, initialStudentName, initialStudentClass, initialStudentSchoolId) {
        if (initialStudentName.isNotBlank()) {
            studentName = initialStudentName
        }
        if (initialStudentSchoolId.isNotBlank()) {
            studentSchoolId = initialStudentSchoolId.trim().lowercase()
        }
        if (initialStudentClass.isNotBlank()) {
            studentClass = initialStudentClass
        }

        val needsLookup = studentName == "Siswa" || studentSchoolId.isBlank() || studentClass.isBlank()
        if (studentId.isNotEmpty() && needsLookup) {
            val db = FirebaseDatabase.getInstance()
            db.getReference("master_students").child(studentId).addListenerForSingleValueEvent(object : ValueEventListener {
                override fun onDataChange(masterSnapshot: DataSnapshot) {
                    if (masterSnapshot.exists()) {
                        studentName = masterSnapshot.child("name").getValue(String::class.java) ?: "Siswa"
                        studentSchoolId = masterSnapshot.child("schoolId").getValue(String::class.java)?.trim()?.lowercase() ?: ""
                        studentClass = masterSnapshot.child("class").getValue(String::class.java)
                            ?: masterSnapshot.child("kelas").getValue(String::class.java)
                            ?: ""
                        return
                    }

                    db.getReference("students").child(studentId).addListenerForSingleValueEvent(object : ValueEventListener {
                        override fun onDataChange(legacyDirect: DataSnapshot) {
                            if (legacyDirect.exists()) {
                                studentName = legacyDirect.child("name").getValue(String::class.java) ?: "Siswa"
                                studentSchoolId = legacyDirect.child("schoolId").getValue(String::class.java)?.trim()?.lowercase() ?: ""
                                studentClass = legacyDirect.child("class").getValue(String::class.java)
                                    ?: legacyDirect.child("kelas").getValue(String::class.java)
                                    ?: ""
                                return
                            }

                            db.getReference("students").orderByChild("nisn").equalTo(studentId)
                                .addListenerForSingleValueEvent(object : ValueEventListener {
                                    override fun onDataChange(snapshot: DataSnapshot) {
                                        if (snapshot.exists()) {
                                            val student = snapshot.children.first()
                                            studentName = student.child("name").getValue(String::class.java) ?: "Siswa"
                                            studentSchoolId = student.child("schoolId").getValue(String::class.java)?.trim()?.lowercase() ?: ""
                                            studentClass = student.child("class").getValue(String::class.java)
                                                ?: student.child("kelas").getValue(String::class.java)
                                                ?: ""
                                        }
                                    }

                                    override fun onCancelled(error: DatabaseError) {}
                                })
                        }

                        override fun onCancelled(error: DatabaseError) {}
                    })
                }

                override fun onCancelled(error: DatabaseError) {}
            })
        }
    }

    LaunchedEffect(studentSchoolId) {
        viewModel.setSchoolScope(studentSchoolId)
    }

    LaunchedEffect(studentId) {
        viewModel.setStudentScope(studentId)
    }

    Scaffold(
        containerColor = Color.Transparent,
        bottomBar = {
            NavigationBar(
                containerColor = LenteraGlassStrong,
                tonalElevation = 0.dp
            ) {
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Home, contentDescription = "Beranda") },
                    label = { Text("Beranda") },
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color.White,
                        selectedTextColor = Color.White,
                        unselectedIconColor = Color.White.copy(alpha = 0.7f),
                        unselectedTextColor = Color.White.copy(alpha = 0.7f),
                        indicatorColor = Color.White.copy(alpha = 0.16f)
                    )
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.List, contentDescription = "Katalog") },
                    label = { Text("Katalog") },
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color.White,
                        selectedTextColor = Color.White,
                        unselectedIconColor = Color.White.copy(alpha = 0.7f),
                        unselectedTextColor = Color.White.copy(alpha = 0.7f),
                        indicatorColor = Color.White.copy(alpha = 0.16f)
                    )
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Edit, contentDescription = "Tugas") },
                    label = { Text("Tugas Literasi") },
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color.White,
                        selectedTextColor = Color.White,
                        unselectedIconColor = Color.White.copy(alpha = 0.7f),
                        unselectedTextColor = Color.White.copy(alpha = 0.7f),
                        indicatorColor = Color.White.copy(alpha = 0.16f)
                    )
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Favorite, contentDescription = "Buku Saya") },
                    label = { Text("Buku Saya") },
                    selected = selectedTab == 3,
                    onClick = { selectedTab = 3 },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color.White,
                        selectedTextColor = Color.White,
                        unselectedIconColor = Color.White.copy(alpha = 0.7f),
                        unselectedTextColor = Color.White.copy(alpha = 0.7f),
                        indicatorColor = Color.White.copy(alpha = 0.16f)
                    )
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Person, contentDescription = "Profil") },
                    label = { Text("Profil") },
                    selected = selectedTab == 4,
                    onClick = { selectedTab = 4 },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color.White,
                        selectedTextColor = Color.White,
                        unselectedIconColor = Color.White.copy(alpha = 0.7f),
                        unselectedTextColor = Color.White.copy(alpha = 0.7f),
                        indicatorColor = Color.White.copy(alpha = 0.16f)
                    )
                )
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(LenteraPageBrush)
                .padding(paddingValues)
        ) {
            when (selectedTab) {
                0 -> LibraryHomeView(
                    studentId = studentId,
                    studentName = studentName,
                    onNavigateToCatalog = { selectedTab = 1 },
                    onNavigateToTasks = { selectedTab = 2 },
                    onNavigateToMyBooks = { selectedTab = 3 },
                    onBack = onBack
                )
                1 -> LibraryCatalogView(
                    viewModel = viewModel,
                    studentName = studentName,
                    onReadBook = onReadBook,
                    onBack = onBack
                )
                2 -> LibraryTasksView(
                    studentId = studentId,
                    studentName = studentName,
                    studentClass = studentClass,
                    studentSchoolId = studentSchoolId,
                    viewModel = viewModel,
                    onBack = { selectedTab = 1 }
                )
                3 -> LibraryMyBooksView(onBack = { selectedTab = 1 })
                4 -> LibraryProfileView(studentId = studentId, onBack = { selectedTab = 1 })
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryHomeView(
    studentId: String,
    studentName: String,
    onNavigateToCatalog: () -> Unit,
    onNavigateToTasks: () -> Unit,
    onNavigateToMyBooks: () -> Unit,
    onBack: () -> Unit
) {
    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            LenteraTopBar(title = "Lentera Digital", onBack = onBack)
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(LenteraPageBrush)
                .padding(padding)
        ) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                // Welcome Section
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Halo,", style = MaterialTheme.typography.bodyLarge, color = LenteraTextSecondary)
                        Text(
                            text = studentName, 
                            style = MaterialTheme.typography.headlineSmall, 
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                    Surface(
                        shape = CircleShape,
                        color = Color.White.copy(alpha = 0.16f),
                        modifier = Modifier.size(48.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = studentName.take(1).uppercase(),
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                }
                }

                item {
                // Stats Card
                LenteraGlassCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text("Statistik Saya", style = MaterialTheme.typography.labelLarge, color = LenteraTextSecondary)
                        Spacer(modifier = Modifier.height(16.dp))
                        Row(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("0", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = Color.White)
                                Text("Total Poin", style = MaterialTheme.typography.bodySmall, color = LenteraTextSecondary)
                            }
                            Box(
                                modifier = Modifier
                                    .width(1.dp)
                                    .height(40.dp)
                                    .background(LenteraGlassBorder)
                            )
                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("0", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = Color.White)
                                Text("Buku Dibaca", style = MaterialTheme.typography.bodySmall, color = LenteraTextSecondary)
                            }
                        }
                    }
                }
                }

                item {
                // Featured Challenge
                Text("Tantangan Minggu Ini", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
                Spacer(modifier = Modifier.height(8.dp))
                LenteraGlassCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Star, contentDescription = null, tint = LenteraAccentStrong)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Tantangan Membaca", fontWeight = FontWeight.Bold, color = Color.White)
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Baca 1 buku kategori Fiksi minggu ini dan dapatkan 50 poin tambahan!", style = MaterialTheme.typography.bodyMedium, color = LenteraTextSecondary)
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = onNavigateToTasks,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color.White.copy(alpha = 0.16f),
                                contentColor = Color.White
                            )
                        ) {
                            Text("Lihat Tugas")
                        }
                    }
                }
                }

                item {
                // Quick Actions Grid
                Text("Menu Cepat", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
                Spacer(modifier = Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    QuickActionCard(
                        title = "Katalog",
                        icon = Icons.Default.List,
                        color = Color(0xFF4CAF50),
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToCatalog
                    )
                    QuickActionCard(
                        title = "Buku Saya",
                        icon = Icons.Default.Favorite,
                        color = Color(0xFF9C27B0),
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToMyBooks
                    )
                }
            }
        }
        }
    }
}

@Composable
fun QuickActionCard(title: String, icon: ImageVector, color: Color, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        colors = CardDefaults.cardColors(containerColor = LenteraGlassCard),
        border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder),
        modifier = modifier.height(100.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(32.dp))
            Spacer(modifier = Modifier.height(8.dp))
            Text(text = title, fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyMedium, color = Color.White)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryCatalogView(
    viewModel: StudentLibraryViewModel,
    studentName: String,
    onReadBook: (String, String) -> Unit,
    onBack: () -> Unit
) {
    val books by viewModel.filteredBooks.collectAsState()
    val categories by viewModel.categories.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val selectedCategory by viewModel.selectedCategory.collectAsState()

    val keyboardController = LocalSoftwareKeyboardController.current

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            LenteraTopBar(
                title = "Lentera Digital",
                onBack = onBack,
                actions = {
                    IconButton(onClick = { viewModel.refreshBooks() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(LenteraPageBrush)
                .padding(paddingValues)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            ) {
            // Header: Lentera Digital
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    painter = painterResource(id = R.drawable.ic_literacy_book), // Assuming this drawable exists or use a vector
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Lentera Digital",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Header: Greeting
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp), tint = LenteraTextSecondary)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Halo, $studentName",
                    style = MaterialTheme.typography.bodyMedium,
                    color = LenteraTextSecondary
                )
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Header: Katalog Buku
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.List, contentDescription = null, tint = Color.White)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Katalog Buku",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
            
            Spacer(modifier = Modifier.height(16.dp))

            // Categories
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                items(categories) { category ->
                    FilterChip(
                        selected = category == selectedCategory,
                        onClick = { viewModel.onCategorySelected(category) },
                        label = { Text(category) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = Color.White.copy(alpha = 0.16f),
                            selectedLabelColor = Color.White,
                            containerColor = LenteraGlassCard,
                            labelColor = LenteraTextSecondary
                        ),
                        border = FilterChipDefaults.filterChipBorder(
                            enabled = true,
                            selected = category == selectedCategory,
                            borderColor = LenteraGlassBorder,
                            selectedBorderColor = Color.White.copy(alpha = 0.32f)
                        )
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { viewModel.onSearchQueryChanged(it) },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Cari judul buku...", color = LenteraTextSecondary) },
                trailingIcon = { 
                    IconButton(onClick = { /* Search action if needed */ }) {
                        Icon(Icons.Default.Search, contentDescription = null, tint = Color.White)
                    }
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { keyboardController?.hide() }),
                shape = RoundedCornerShape(16.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color.White.copy(alpha = 0.42f),
                    unfocusedBorderColor = LenteraGlassBorder,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    focusedContainerColor = LenteraGlassCard,
                    unfocusedContainerColor = LenteraGlassCard,
                    cursorColor = Color.White
                )
            )
            
            Spacer(modifier = Modifier.height(16.dp))

            // Content
            Box(modifier = Modifier.fillMaxSize()) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center), color = Color.White)
                } else if (error != null) {
                    Column(
                        modifier = Modifier.align(Alignment.Center),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFFFB4A9), modifier = Modifier.size(48.dp))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = error ?: "Terjadi kesalahan", color = Color(0xFFFFB4A9))
                    }
                } else if (books.isEmpty()) {
                    Column(
                        modifier = Modifier.align(Alignment.Center),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_literacy_book), // Placeholder icon
                            contentDescription = null,
                            tint = Color.White.copy(alpha = 0.5f),
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Tidak ada buku ditemukan.",
                            style = MaterialTheme.typography.bodyLarge,
                            color = LenteraTextSecondary
                        )
                    }
                } else {
                    val context = LocalContext.current
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        contentPadding = PaddingValues(bottom = 16.dp)
                    ) {
                        items(books) { book ->
                            BookItem(book = book, onClick = {
                                if (!book.pdfUrl.isNullOrEmpty()) {
                                    // Handle Google Drive /view links for mobile
                                    var finalUrl = book.pdfUrl
                                    if (finalUrl.contains("drive.google.com") && finalUrl.contains("/view")) {
                                        finalUrl = finalUrl.replace("/view", "/preview")
                                    }
                                    onReadBook(finalUrl, book.displayTitle)
                                } else {
                                    // Fallback if no PDF
                                    Toast.makeText(context, "Buku ini tidak memiliki file PDF digital", Toast.LENGTH_SHORT).show()
                                }
                            })
                        }
                    }
                }
            }
        }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryMyBooksView(onBack: () -> Unit) {
    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            LenteraTopBar(title = "Buku Saya", onBack = onBack)
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .background(LenteraPageBrush)
                .padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            LenteraGlassCard(modifier = Modifier.fillMaxWidth()) {
                Text(
                    "Daftar buku yang sedang dipinjam atau favorit akan muncul di sini.",
                    color = Color.White,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(20.dp)
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryTasksView(
    studentId: String,
    studentName: String,
    studentClass: String,
    studentSchoolId: String,
    viewModel: StudentLibraryViewModel,
    onBack: () -> Unit
) {
    val tasks by viewModel.tasks.collectAsState()
    val allLogs by viewModel.logs.collectAsState()
    
    // Filter logs for current student
    val normalizedStudentId = studentId.trim()
    val normalizedStudentName = studentName.trim()
    val logs = allLogs.filter { log ->
        val logStudentId = log.studentId.trim()
        val idMatch = normalizedStudentId.isNotEmpty() && logStudentId.isNotEmpty() && logStudentId == normalizedStudentId
        if (idMatch) return@filter true

        normalizedStudentName.isNotEmpty() && log.studentName.trim().equals(normalizedStudentName, ignoreCase = true)
    }
    val submittedTaskIds = logs.map { it.taskId }.toSet()
    
    var selectedTab by remember { mutableStateOf(0) } // 0: Tugas Baru, 1: Riwayat
    var selectedTask by remember { mutableStateOf<LiteracyTask?>(null) }
    
    // Task Detail Submission Form State
    var bookTitle by remember { mutableStateOf("") }
    var author by remember { mutableStateOf("") }
    var summary by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    
    val context = LocalContext.current
    
    val currentTask = selectedTask
    if (currentTask != null) {
        // Task Detail / Submission View
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                LenteraTopBar(
                    title = currentTask.title,
                    onBack = { selectedTask = null }
                )
            }
        ) { padding ->
            Column(
                modifier = Modifier
                    .padding(padding)
                    .fillMaxSize()
                    .background(LenteraPageBrush)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp)
            ) {
                // Task Info Card
                LenteraGlassCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Info, contentDescription = null, tint = Color.White)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Instruksi Tugas",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = currentTask.description, style = MaterialTheme.typography.bodyMedium, color = LenteraTextSecondary)
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                            Text(text = "${currentTask.points} Poin", fontWeight = FontWeight.Bold, color = Color.White)
                            Text(text = "${currentTask.durationMinutes} Menit", color = LenteraTextSecondary)
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                Text("Formulir Laporan", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
                Spacer(modifier = Modifier.height(16.dp))
                
                OutlinedTextField(
                    value = bookTitle,
                    onValueChange = { bookTitle = it },
                    label = { Text("Judul Buku") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color.White.copy(alpha = 0.42f),
                        unfocusedBorderColor = LenteraGlassBorder,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedContainerColor = LenteraGlassCard,
                        unfocusedContainerColor = LenteraGlassCard,
                        focusedLabelColor = Color.White,
                        unfocusedLabelColor = LenteraTextSecondary,
                        cursorColor = Color.White
                    )
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = author,
                    onValueChange = { author = it },
                    label = { Text("Penulis") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color.White.copy(alpha = 0.42f),
                        unfocusedBorderColor = LenteraGlassBorder,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedContainerColor = LenteraGlassCard,
                        unfocusedContainerColor = LenteraGlassCard,
                        focusedLabelColor = Color.White,
                        unfocusedLabelColor = LenteraTextSecondary,
                        cursorColor = Color.White
                    )
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = summary,
                    onValueChange = { summary = it },
                    label = { Text("Ringkasan / Hasil Bacaan") },
                    modifier = Modifier.fillMaxWidth().height(150.dp),
                    minLines = 3,
                    maxLines = 10,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color.White.copy(alpha = 0.42f),
                        unfocusedBorderColor = LenteraGlassBorder,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedContainerColor = LenteraGlassCard,
                        unfocusedContainerColor = LenteraGlassCard,
                        focusedLabelColor = Color.White,
                        unfocusedLabelColor = LenteraTextSecondary,
                        cursorColor = Color.White
                    )
                )
                
                Spacer(modifier = Modifier.height(24.dp))
                
                Button(
                    onClick = {
                        if (bookTitle.isNotBlank() && author.isNotBlank() && summary.isNotBlank()) {
                            isSubmitting = true
                            viewModel.submitLiteracyReport(
                                studentId = studentId,
                                studentName = studentName,
                                studentClass = studentClass,
                                schoolId = studentSchoolId,
                                taskId = currentTask.id,
                                taskTitle = currentTask.title,
                                bookTitle = bookTitle,
                                author = author,
                                summary = summary
                            ) { success ->
                                isSubmitting = false
                                if (success) {
                                    Toast.makeText(context, "Laporan berhasil dikirim!", Toast.LENGTH_LONG).show()
                                    selectedTask = null
                                    bookTitle = ""
                                    author = ""
                                    summary = ""
                                    selectedTab = 1 // Switch to history
                                } else {
                                    Toast.makeText(context, "Gagal mengirim laporan.", Toast.LENGTH_SHORT).show()
                                }
                            }
                        } else {
                            Toast.makeText(context, "Mohon lengkapi semua data", Toast.LENGTH_SHORT).show()
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isSubmitting,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White.copy(alpha = 0.16f),
                        contentColor = Color.White
                    )
                ) {
                    if (isSubmitting) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                    } else {
                        Text("Kirim Laporan")
                    }
                }
            }
        }
    } else {
        // Main Tasks List View
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                LenteraTopBar(title = "Tugas Literasi", onBack = onBack)
            }
        ) { padding ->
            Column(
                modifier = Modifier
                    .padding(padding)
                    .fillMaxSize()
                    .background(LenteraPageBrush)
            ) {
                // Tab Row
                TabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = Color.Transparent,
                    contentColor = Color.White,
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
                    Tab(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        selectedContentColor = Color.White,
                        unselectedContentColor = LenteraTextSecondary,
                        text = { Text("Tugas Baru") }
                    )
                    Tab(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        selectedContentColor = Color.White,
                        unselectedContentColor = LenteraTextSecondary,
                        text = { Text("Riwayat") }
                    )
                }

                if (selectedTab == 0) {
                    // Available Tasks List
                    if (tasks.isEmpty()) {
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(64.dp), tint = Color.White.copy(alpha = 0.6f))
                            Spacer(modifier = Modifier.height(16.dp))
                            Text("Belum ada tugas aktif", style = MaterialTheme.typography.bodyLarge, color = LenteraTextSecondary)
                        }
                    } else {
                        LazyColumn(
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(tasks) { task ->
                                val isSubmitted = submittedTaskIds.contains(task.id)
                                Card(
                                    onClick = { 
                                        if (isSubmitted) {
                                            Toast.makeText(context, "Tugas ini sudah dikerjakan.", Toast.LENGTH_SHORT).show()
                                        } else {
                                            selectedTask = task 
                                        }
                                    },
                                    colors = CardDefaults.cardColors(
                                        containerColor = if (isSubmitted) LenteraGlassStrong else LenteraGlassCard
                                    ),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder),
                                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                                ) {
                                    Column(modifier = Modifier.padding(16.dp)) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = task.title, 
                                                style = MaterialTheme.typography.titleMedium, 
                                                fontWeight = FontWeight.Bold,
                                                color = if (isSubmitted) LenteraTextSecondary else Color.White,
                                                modifier = Modifier.weight(1f)
                                            )
                                            Surface(
                                                color = Color.White.copy(alpha = 0.14f),
                                                shape = RoundedCornerShape(16.dp)
                                            ) {
                                                Text(
                                                    text = if (isSubmitted) "Selesai" else "${task.points} Poin",
                                                    color = Color.White,
                                                    style = MaterialTheme.typography.labelSmall,
                                                    fontWeight = FontWeight.Bold,
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                                )
                                            }
                                        }
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Text(
                                            text = task.description, 
                                            style = MaterialTheme.typography.bodyMedium, 
                                            color = LenteraTextSecondary,
                                            maxLines = 3,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Spacer(modifier = Modifier.height(12.dp))
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(Icons.Default.Info, contentDescription = null, tint = LenteraTextSecondary, modifier = Modifier.size(16.dp))
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text(
                                                text = "${task.durationMinutes} Menit", 
                                                style = MaterialTheme.typography.bodySmall, 
                                                color = LenteraTextSecondary
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // History List (Riwayat)
                    if (logs.isEmpty()) {
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Icon(Icons.Default.DateRange, contentDescription = null, modifier = Modifier.size(64.dp), tint = Color.White.copy(alpha = 0.6f))
                            Spacer(modifier = Modifier.height(16.dp))
                            Text("Belum ada riwayat laporan", style = MaterialTheme.typography.bodyLarge, color = LenteraTextSecondary)
                        }
                    } else {
                        LazyColumn(
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(logs) { log ->
                                Card(
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
                                            Text(
                                                text = log.bookTitle,
                                                style = MaterialTheme.typography.titleMedium,
                                                fontWeight = FontWeight.Bold,
                                                color = Color.White,
                                                modifier = Modifier.weight(1f)
                                            )
                                            
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                val statusColor = if (log.status == "reviewed" || log.status == "corrected") LenteraAccentStrong else LenteraAccent
                                                val statusText = if (log.status == "reviewed" || log.status == "corrected") "Dinilai" else "Pending"
                                                
                                                Surface(
                                                    color = statusColor.copy(alpha = 0.1f),
                                                    shape = RoundedCornerShape(16.dp)
                                                ) {
                                                    Text(
                                                        text = statusText,
                                                        color = statusColor,
                                                        style = MaterialTheme.typography.labelSmall,
                                                        fontWeight = FontWeight.Bold,
                                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                                    )
                                                }
                                                
                                                Spacer(modifier = Modifier.width(4.dp))
                                                
                                                IconButton(onClick = {
                                                    viewModel.deleteLiteracyLog(log.id) { success ->
                                                        if (success) {
                                                            Toast.makeText(context, "Riwayat dihapus", Toast.LENGTH_SHORT).show()
                                                        } else {
                                                            Toast.makeText(context, "Gagal menghapus", Toast.LENGTH_SHORT).show()
                                                        }
                                                    }
                                                }) {
                                                    Icon(Icons.Default.Delete, contentDescription = "Hapus", tint = Color(0xFFFFB4A9))
                                                }
                                            }
                                        }
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(text = log.author, style = MaterialTheme.typography.bodySmall, color = LenteraTextSecondary)
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Text(
                                            text = log.summary,
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = Color.White,
                                            maxLines = 2,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        if (log.grade != null && log.grade.isNotEmpty()) {
                                            Spacer(modifier = Modifier.height(8.dp))
                                            HorizontalDivider(color = LenteraGlassBorder)
                                            Spacer(modifier = Modifier.height(8.dp))
                                            Row {
                                                Text("Nilai: ", fontWeight = FontWeight.Bold, color = Color.White)
                                                Text(log.grade, color = LenteraAccent, fontWeight = FontWeight.Bold)
                                            }
                                        }
                                    }
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
fun LibraryProfileView(studentId: String, onBack: () -> Unit) {
    Scaffold(
        containerColor = Color.Transparent,
        topBar = { LenteraTopBar(title = "Profil", onBack = onBack) }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(LenteraPageBrush)
                .padding(padding),
            contentAlignment = Alignment.Center
        ) {
            LenteraGlassCard(modifier = Modifier.padding(16.dp).fillMaxWidth()) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(Icons.Default.Person, contentDescription = null, modifier = Modifier.size(64.dp), tint = Color.White)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Profil Siswa", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = Color.White)
                    Text("NISN: $studentId", color = LenteraTextSecondary)
                }
            }
        }
    }
}

@Composable
fun BookItem(book: Book, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        colors = CardDefaults.cardColors(containerColor = LenteraGlassCard),
        border = androidx.compose.foundation.BorderStroke(1.dp, LenteraGlassBorder),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .background(Color(0xFF0B1F33).copy(alpha = 0.42f))
            ) {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(book.coverUrl)
                        .crossfade(true)
                        .build(),
                    contentDescription = book.displayTitle,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                    error = painterResource(R.drawable.ic_literacy_book)
                )
                if (book.pdfUrl.isNullOrEmpty()) {
                    Surface(
                        color = Color.Black.copy(alpha = 0.6f),
                        modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth()
                    ) {
                        Text(
                            text = "Fisik",
                            color = Color.White,
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(4.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                } else {
                    Surface(
                        color = Color.White.copy(alpha = 0.16f),
                        modifier = Modifier.align(Alignment.TopEnd).padding(8.dp),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = "E-Book",
                            color = Color.White,
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                        )
                    }
                }
            }
            
            Column(modifier = Modifier.padding(12.dp)) {
                Text(
                    text = book.displayTitle,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = book.displayAuthor,
                    style = MaterialTheme.typography.bodySmall,
                    color = LenteraTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = book.displayCategory,
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White,
                    modifier = Modifier
                        .background(Color.White.copy(alpha = 0.14f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
        }
    }
}

