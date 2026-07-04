package com.satupintu.mobile.ui.screens.student

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.BuildCircle
import androidx.compose.material.icons.filled.Calculate
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.GTranslate
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

const val TOOLS_ROUTE = "tools"
const val ENGLISH_DICTIONARY_ROUTE = "tools_english_dictionary"
const val JAVANESE_DICTIONARY_ROUTE = "tools_javanese_dictionary"

private data class ToolMenuItem(
    val title: String,
    val subtitle: String,
    val icon: ImageVector,
    val route: String,
    val accent: Color,
    val isAvailable: Boolean = true,
    val badge: String = if (isAvailable) "Tersedia" else "Coming Soon"
)

private data class ToolDictionaryEntry(
    val term: String,
    val meaning: String,
    val example: String = ""
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StudentToolsScreen(
    onBack: () -> Unit,
    onNavigate: (String) -> Unit
) {
    val tools = remember {
        listOf(
            ToolMenuItem(
                title = "Kamus Bahasa Inggris",
                subtitle = "Cari arti kata dan contoh singkat bahasa Inggris",
                icon = Icons.Default.GTranslate,
                route = ENGLISH_DICTIONARY_ROUTE,
                accent = Color(0xFF2563EB)
            ),
            ToolMenuItem(
                title = "Kamus Bahasa Jawa",
                subtitle = "Bantu memahami kosakata Jawa sehari-hari",
                icon = Icons.Default.Translate,
                route = JAVANESE_DICTIONARY_ROUTE,
                accent = Color(0xFF7C3AED)
            ),
            ToolMenuItem(
                title = "Coming Soon",
                subtitle = "Slot kosong untuk tool belajar berikutnya",
                icon = Icons.Default.Calculate,
                route = "",
                accent = Color(0xFFEA580C),
                isAvailable = false
            ),
            ToolMenuItem(
                title = "Coming Soon",
                subtitle = "Slot kosong untuk tool belajar berikutnya",
                icon = Icons.Default.Calculate,
                route = "",
                accent = Color(0xFF0891B2),
                isAvailable = false
            ),
            ToolMenuItem(
                title = "Coming Soon",
                subtitle = "Slot kosong untuk tool belajar berikutnya",
                icon = Icons.Default.MenuBook,
                route = "",
                accent = Color(0xFF16A34A),
                isAvailable = false
            ),
            ToolMenuItem(
                title = "Coming Soon",
                subtitle = "Slot kosong untuk tool belajar berikutnya",
                icon = Icons.Default.BuildCircle,
                route = "",
                accent = Color(0xFF9333EA),
                isAvailable = false
            )
        )
    }

    Scaffold(
        containerColor = Color(0xFFF4F7FB),
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Tools Belajar", fontWeight = FontWeight.Bold)
                        Text(
                            "Kumpulan alat bantu ringan untuk siswa",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.White,
                    titleContentColor = Color(0xFF0F172A),
                    navigationIconContentColor = Color(0xFF0F172A)
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color(0xFFF8FBFF), Color(0xFFEAF3FF))
                    )
                )
                .verticalScroll(rememberScrollState())
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A))
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Belajar Lebih Praktis",
                        color = Color.White,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Mulai dari kamus bahasa Inggris dan bahasa Jawa. Slot tools lain sudah disiapkan agar nanti saat Anda menambah item baru, menunya langsung muncul di APK siswa.",
                        color = Color.White.copy(alpha = 0.88f),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            tools.forEach { tool ->
                ToolMenuCard(
                    tool = tool,
                    onClick = {
                        if (tool.isAvailable && tool.route.isNotBlank()) {
                            onNavigate(tool.route)
                        }
                    }
                )
            }

            Card(
                shape = RoundedCornerShape(22.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFBEB))
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.BuildCircle, contentDescription = null, tint = Color(0xFFD97706))
                        Text(
                            text = "Segera Hadir",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF92400E)
                        )
                    }
                    Text(
                        text = "Struktur katalog tools sudah siap. Nanti cukup tambahkan item baru di daftar tools, lalu menu baru akan otomatis tampil di halaman ini.",
                        color = Color(0xFF92400E),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}

@Composable
private fun ToolMenuCard(
    tool: ToolMenuItem,
    onClick: () -> Unit
) {
    val isEnabled = tool.isAvailable && tool.route.isNotBlank()
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = isEnabled) { onClick() },
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (tool.isAvailable) Color.White else Color(0xFFF8FAFC)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Surface(
                modifier = Modifier.size(58.dp),
                shape = RoundedCornerShape(18.dp),
                color = tool.accent.copy(alpha = if (tool.isAvailable) 0.14f else 0.10f)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = tool.icon,
                        contentDescription = tool.title,
                        tint = if (tool.isAvailable) tool.accent else Color(0xFF94A3B8),
                        modifier = Modifier.size(28.dp)
                    )
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = tool.title,
                    color = if (tool.isAvailable) Color(0xFF0F172A) else Color(0xFF475569),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = tool.subtitle,
                    color = Color(0xFF475569),
                    style = MaterialTheme.typography.bodySmall
                )
            }
            Surface(
                shape = RoundedCornerShape(999.dp),
                color = if (tool.isAvailable) tool.accent.copy(alpha = 0.12f) else Color(0xFFE2E8F0)
            ) {
                Text(
                    text = tool.badge,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    color = if (tool.isAvailable) tool.accent else Color(0xFF64748B),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
fun StudentEnglishDictionaryScreen(onBack: () -> Unit) {
    DictionaryScreen(
        title = "Kamus Bahasa Inggris",
        subtitle = "Cari kata bahasa Inggris atau artinya dalam bahasa Indonesia",
        entries = EnglishDictionaryEntries,
        onBack = onBack
    )
}

@Composable
fun StudentJavaneseDictionaryScreen(onBack: () -> Unit) {
    DictionaryScreen(
        title = "Kamus Bahasa Jawa",
        subtitle = "Cari kosakata Jawa atau arti Indonesianya",
        entries = JavaneseDictionaryEntries,
        onBack = onBack
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DictionaryScreen(
    title: String,
    subtitle: String,
    entries: List<ToolDictionaryEntry>,
    onBack: () -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    val normalizedQuery = searchQuery.trim()
    val filteredEntries = remember(normalizedQuery, entries) {
        if (normalizedQuery.isBlank()) {
            entries
        } else {
            val q = normalizedQuery.lowercase()
            entries.filter { entry ->
                entry.term.lowercase().contains(q) ||
                    entry.meaning.lowercase().contains(q) ||
                    entry.example.lowercase().contains(q)
            }
        }
    }

    Scaffold(
        containerColor = Color(0xFFF4F7FB),
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(title, fontWeight = FontWeight.Bold)
                        Text(subtitle, style = MaterialTheme.typography.bodySmall)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.White,
                    titleContentColor = Color(0xFF0F172A),
                    navigationIconContentColor = Color(0xFF0F172A)
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                singleLine = true,
                placeholder = { Text("Cari kata atau arti...") },
                leadingIcon = {
                    Icon(Icons.Default.Search, contentDescription = "Cari")
                },
                trailingIcon = {
                    if (searchQuery.isNotBlank()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Clear, contentDescription = "Bersihkan")
                        }
                    }
                }
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                DictionaryInfoChip(
                    icon = Icons.Default.MenuBook,
                    text = "${filteredEntries.size} entri"
                )
                DictionaryInfoChip(
                    icon = Icons.Default.Calculate,
                    text = "Versi awal ringan"
                )
            }

            if (filteredEntries.isEmpty()) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "Kata tidak ditemukan",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0F172A)
                        )
                        Text(
                            text = "Coba gunakan kata yang lebih pendek atau cari berdasarkan arti.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFF475569)
                        )
                    }
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(filteredEntries) { entry ->
                        Card(
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = entry.term,
                                    style = MaterialTheme.typography.titleMedium,
                                    color = Color(0xFF0F172A),
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = entry.meaning,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Color(0xFF334155)
                                )
                                if (entry.example.isNotBlank()) {
                                    HorizontalDivider(color = Color(0xFFE2E8F0))
                                    Text(
                                        text = "Contoh: ${entry.example}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Color(0xFF64748B)
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
private fun DictionaryInfoChip(
    icon: ImageVector,
    text: String
) {
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = Color.White
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = Color(0xFF2563EB),
                modifier = Modifier.size(18.dp)
            )
            Text(
                text = text,
                style = MaterialTheme.typography.labelMedium,
                color = Color(0xFF0F172A)
            )
        }
    }
}

private val EnglishDictionaryEntries = listOf(
    ToolDictionaryEntry("abandon", "meninggalkan", "Do not abandon your homework halfway."),
    ToolDictionaryEntry("achieve", "mencapai", "We can achieve better results by studying consistently."),
    ToolDictionaryEntry("brave", "berani", "Be brave to speak English in class."),
    ToolDictionaryEntry("borrow", "meminjam", "I borrow a book from the school library."),
    ToolDictionaryEntry("careful", "hati-hati", "Be careful when reading instructions."),
    ToolDictionaryEntry("choose", "memilih", "Choose the best answer."),
    ToolDictionaryEntry("diligent", "rajin", "A diligent student reviews lessons every day."),
    ToolDictionaryEntry("environment", "lingkungan", "We must keep the school environment clean."),
    ToolDictionaryEntry("honest", "jujur", "An honest student tells the truth."),
    ToolDictionaryEntry("improve", "meningkatkan", "Practice every day to improve your vocabulary."),
    ToolDictionaryEntry("library", "perpustakaan", "The library is open after school."),
    ToolDictionaryEntry("respect", "menghormati", "Respect your teachers and friends."),
    ToolDictionaryEntry("schedule", "jadwal", "Check your study schedule tonight."),
    ToolDictionaryEntry("solution", "solusi", "Discuss the solution with your group."),
    ToolDictionaryEntry("subject", "mata pelajaran", "Math is my favorite subject.")
)

private val JavaneseDictionaryEntries = listOf(
    ToolDictionaryEntry("monggo", "silakan", "Monggo pinarak rumiyin."),
    ToolDictionaryEntry("nuwun sewu", "permisi", "Nuwun sewu, kula bade langkung."),
    ToolDictionaryEntry("maturnuwun", "terima kasih", "Maturnuwun sampun dipun bantu."),
    ToolDictionaryEntry("nggih", "iya", "Nggih, Bu Guru."),
    ToolDictionaryEntry("mboten", "tidak", "Mboten, kula dereng paham."),
    ToolDictionaryEntry("saget", "bisa", "Kula saget nyobi malih."),
    ToolDictionaryEntry("sinau", "belajar", "Siswa kedah sregep sinau."),
    ToolDictionaryEntry("sekolah", "sekolah", "Adik tindak sekolah saben enjing."),
    ToolDictionaryEntry("kanca", "teman", "Kanca ing kelas kedah rukun."),
    ToolDictionaryEntry("pinter", "pandai", "Bocah punika pinter matematika."),
    ToolDictionaryEntry("ati-ati", "hati-hati", "Ati-ati nalika mlampah wonten dalan."),
    ToolDictionaryEntry("resik", "bersih", "Kelas ingkang resik ndadosaken betah sinau."),
    ToolDictionaryEntry("cepet", "cepat", "Rampungna tugas kanthi cepet lan bener."),
    ToolDictionaryEntry("alon-alon", "pelan-pelan", "Yen angel, diwaca alon-alon mawon."),
    ToolDictionaryEntry("guyub", "rukun/kompak", "Kelas kedah guyub supados sinau luwih nyenengake.")
)

