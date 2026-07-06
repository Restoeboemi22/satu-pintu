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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.text.HtmlCompat
import com.satupintu.mobile.data.remote.DictionaryDefinitionResponse
import com.satupintu.mobile.data.remote.DictionaryEntryResponse
import com.satupintu.mobile.data.remote.StudentDictionaryRemote
import com.satupintu.mobile.data.remote.TranslationResponse
import com.satupintu.mobile.util.HanacarakaConverter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import retrofit2.HttpException
import java.util.Locale

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

private data class EnglishMeaningUi(
    val partOfSpeech: String,
    val definitions: List<DictionaryDefinitionResponse>
)

private enum class EnglishDirection(
    val label: String
) {
    ENGLISH_TO_INDONESIA("Inggris -> Indonesia"),
    INDONESIA_TO_ENGLISH("Indonesia -> Inggris")
}

private data class EnglishDictionaryResultUi(
    val direction: EnglishDirection,
    val sourceText: String,
    val word: String,
    val phonetic: String?,
    val translationLabel: String,
    val translation: String?,
    val meanings: List<EnglishMeaningUi>
)

private data class EnglishTranslationCandidate(
    val displayText: String,
    val lookupText: String,
    val sourceSegment: String,
    val providerScore: Double
)

private sealed interface EnglishDictionaryUiState {
    data object Idle : EnglishDictionaryUiState
    data object Loading : EnglishDictionaryUiState
    data class Success(val result: EnglishDictionaryResultUi) : EnglishDictionaryUiState
    data class Error(val message: String) : EnglishDictionaryUiState
}

private enum class JavaneseDirection(
    val label: String,
    val langPair: String
) {
    INDONESIA_TO_JAVA("Indonesia -> Jawa", "id-ID|jv-ID"),
    JAVA_TO_INDONESIA("Jawa -> Indonesia", "jv-ID|id-ID")
}

private data class JavaneseWordBreakdownUi(
    val latinWord: String,
    val aksaraWord: String,
    val note: String
)

private data class JavaneseDictionaryResultUi(
    val direction: JavaneseDirection,
    val sourceText: String,
    val translatedText: String,
    val aksaraText: String,
    val wordBreakdown: List<JavaneseWordBreakdownUi>
)

private sealed interface JavaneseDictionaryUiState {
    data object Idle : JavaneseDictionaryUiState
    data object Loading : JavaneseDictionaryUiState
    data class Success(val result: JavaneseDictionaryResultUi) : JavaneseDictionaryUiState
    data class Error(val message: String) : JavaneseDictionaryUiState
}

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
                subtitle = "Cari definisi, jenis kata, contoh, dan arti Indonesianya",
                icon = Icons.Default.GTranslate,
                route = ENGLISH_DICTIONARY_ROUTE,
                accent = Color(0xFF2563EB)
            ),
            ToolMenuItem(
                title = "Kamus Bahasa Jawa",
                subtitle = "Terjemahan dua arah Jawa-Indonesia plus aksara Hanacaraka",
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
                        text = "Dua kamus utama sekarang diarahkan untuk pencarian online sesuai referensi pengembangan Android, sehingga siswa bisa mencari kata secara langsung dan tidak lagi bergantung pada daftar kata tetap.",
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
    val scope = rememberCoroutineScope()
    var searchQuery by remember { mutableStateOf("") }
    var direction by remember { mutableStateOf(EnglishDirection.ENGLISH_TO_INDONESIA) }
    var uiState by remember { mutableStateOf<EnglishDictionaryUiState>(EnglishDictionaryUiState.Idle) }

    fun searchEnglishDictionary() {
        val keyword = searchQuery.trim()
        if (keyword.isBlank()) {
            uiState = EnglishDictionaryUiState.Error("Masukkan kata yang ingin dicari.")
            return
        }

        scope.launch {
            uiState = EnglishDictionaryUiState.Loading
            uiState = runCatching {
                when (direction) {
                    EnglishDirection.ENGLISH_TO_INDONESIA -> {
                        val dictionaryEntry = withContext(Dispatchers.IO) {
                            StudentDictionaryRemote.englishDictionaryApi
                                .getDefinition(keyword.lowercase(Locale.ROOT))
                                .firstOrNull()
                        } ?: throw IllegalStateException("Kata tidak ditemukan di kamus bahasa Inggris.")

                        EnglishDictionaryUiState.Success(
                            dictionaryEntry.toEnglishResultUi(
                                sourceKeyword = keyword,
                                direction = direction,
                                translationLabel = "Arti Indonesia",
                                translationOverride = null
                            )
                        )
                    }

                    EnglishDirection.INDONESIA_TO_ENGLISH -> {
                        EnglishDictionaryUiState.Success(resolveIndonesianToEnglishResult(keyword))
                    }
                }
            }.getOrElse { throwable ->
                EnglishDictionaryUiState.Error(throwable.toUserMessage())
            }
        }
    }

    DictionaryScreenFrame(
        title = "Kamus Bahasa Inggris",
        subtitle = "Dua arah: Inggris <-> Indonesia",
        onBack = onBack
    ) {
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp),
            singleLine = true,
            placeholder = {
                Text(
                    if (direction == EnglishDirection.ENGLISH_TO_INDONESIA) {
                        "Masukkan kata bahasa Inggris..."
                    } else {
                        "Masukkan kata bahasa Indonesia..."
                    }
                )
            },
            leadingIcon = {
                Icon(Icons.Default.Search, contentDescription = "Cari")
            },
            trailingIcon = {
                if (searchQuery.isNotBlank()) {
                    IconButton(onClick = {
                        searchQuery = ""
                        uiState = EnglishDictionaryUiState.Idle
                    }) {
                        Icon(Icons.Default.Clear, contentDescription = "Bersihkan")
                    }
                }
            }
        )

        Spacer(modifier = Modifier.height(14.dp))

        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = "Arah Kamus",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF0F172A)
                )
                EnglishDirection.values().forEach { option ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { direction = option }
                            .padding(vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = direction == option,
                            onClick = { direction = option }
                        )
                        Text(
                            text = option.label,
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFF334155)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            DictionaryInfoChip(icon = Icons.Default.MenuBook, text = "Online")
            DictionaryInfoChip(icon = Icons.Default.GTranslate, text = direction.label)
        }

        Spacer(modifier = Modifier.height(14.dp))

        Button(
            onClick = { searchEnglishDictionary() },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(18.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF2563EB),
                contentColor = Color.White
            )
        ) {
            Text("Cari Definisi")
        }

        Spacer(modifier = Modifier.height(16.dp))

        when (val state = uiState) {
            EnglishDictionaryUiState.Idle -> InfoCard(
                title = "Siap mencari kata",
                body = "Pilih arah kamus terlebih dahulu. Mode Inggris ke Indonesia menampilkan definisi lengkap, sedangkan mode Indonesia ke Inggris menerjemahkan dulu ke Inggris lalu menampilkan definisinya jika tersedia."
            )

            EnglishDictionaryUiState.Loading -> LoadingCard("Sedang mengambil definisi dan terjemahan...")

            is EnglishDictionaryUiState.Error -> ErrorCard(state.message)

            is EnglishDictionaryUiState.Success -> EnglishDictionaryResultContent(state.result)
        }
    }
}

@Composable
fun StudentJavaneseDictionaryScreen(onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    var searchQuery by remember { mutableStateOf("") }
    var direction by remember { mutableStateOf(JavaneseDirection.INDONESIA_TO_JAVA) }
    var uiState by remember { mutableStateOf<JavaneseDictionaryUiState>(JavaneseDictionaryUiState.Idle) }

    fun searchJavaneseDictionary() {
        val keyword = searchQuery.trim()
        if (keyword.isBlank()) {
            uiState = JavaneseDictionaryUiState.Error("Masukkan kata atau frasa yang ingin diterjemahkan.")
            return
        }

        scope.launch {
            uiState = JavaneseDictionaryUiState.Loading
            uiState = runCatching {
                JavaneseDictionaryUiState.Success(
                    resolveJavaneseDictionaryResult(
                        keyword = keyword,
                        direction = direction
                    )
                )
            }.getOrElse { throwable ->
                JavaneseDictionaryUiState.Error(throwable.toUserMessage())
            }
        }
    }

    DictionaryScreenFrame(
        title = "Kamus Bahasa Jawa",
        subtitle = "Terjemahan online + rincian aksara Hanacaraka",
        onBack = onBack
    ) {
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp),
            singleLine = false,
            maxLines = 3,
            placeholder = { Text("Masukkan kata Indonesia atau Jawa...") },
            leadingIcon = {
                Icon(Icons.Default.Search, contentDescription = "Cari")
            },
            trailingIcon = {
                if (searchQuery.isNotBlank()) {
                    IconButton(onClick = {
                        searchQuery = ""
                        uiState = JavaneseDictionaryUiState.Idle
                    }) {
                        Icon(Icons.Default.Clear, contentDescription = "Bersihkan")
                    }
                }
            }
        )

        Spacer(modifier = Modifier.height(14.dp))

        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = "Arah Terjemahan",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF0F172A)
                )
                JavaneseDirection.values().forEach { option ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { direction = option }
                            .padding(vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = direction == option,
                            onClick = { direction = option }
                        )
                        Text(
                            text = option.label,
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFF334155)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            DictionaryInfoChip(icon = Icons.Default.Translate, text = direction.label)
            DictionaryInfoChip(icon = Icons.Default.MenuBook, text = "Hanacaraka")
        }

        Spacer(modifier = Modifier.height(14.dp))

        Button(
            onClick = { searchJavaneseDictionary() },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(18.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF7C3AED),
                contentColor = Color.White
            )
        ) {
            Text("Terjemahkan")
        }

        Spacer(modifier = Modifier.height(16.dp))

        when (val state = uiState) {
            JavaneseDictionaryUiState.Idle -> InfoCard(
                title = "Siap menerjemahkan",
                body = "Pilih arah terjemahan, lalu masukkan kata atau frasa. Hasil akan menampilkan frasa terjemahan yang lebih bersih, aksara Jawa, dan rincian aksara per kata."
            )

            JavaneseDictionaryUiState.Loading -> LoadingCard("Sedang mengambil terjemahan bahasa Jawa...")

            is JavaneseDictionaryUiState.Error -> ErrorCard(state.message)

            is JavaneseDictionaryUiState.Success -> JavaneseDictionaryResultContent(state.result)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DictionaryScreenFrame(
    title: String,
    subtitle: String,
    onBack: () -> Unit,
    content: @Composable () -> Unit
) {
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
                .verticalScroll(rememberScrollState())
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(0.dp)
        ) {
            content()
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun EnglishDictionaryResultContent(result: EnglishDictionaryResultUi) {
    Card(
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = result.direction.label,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF2563EB)
            )
            Text(
                text = "Input: ${result.sourceText}",
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF64748B)
            )
            Text(
                text = result.word,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF0F172A)
            )
            result.phonetic?.takeIf { it.isNotBlank() }?.let { phonetic ->
                Text(
                    text = "Pelafalan: $phonetic",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFF475569)
                )
            }
            result.translation?.takeIf { it.isNotBlank() }?.let { translation ->
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Color(0xFFDBEAFE)
                ) {
                    Text(
                        text = "${result.translationLabel}: $translation",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                        color = Color(0xFF1D4ED8),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }

    Spacer(modifier = Modifier.height(14.dp))

    if (result.meanings.isEmpty()) {
        InfoCard(
            title = "Definisi belum tersedia",
            body = "Terjemahan Inggris sudah ditemukan, tetapi `dictionaryapi.dev` belum menyediakan definisi rinci untuk hasil ini."
        )
    } else {
        result.meanings.forEach { meaning ->
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = meaning.partOfSpeech,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF2563EB)
                    )

                    meaning.definitions.forEachIndexed { index, definition ->
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = "${index + 1}. ${definition.definition.orEmpty()}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color(0xFF334155)
                            )
                            definition.example?.takeIf { it.isNotBlank() }?.let { example ->
                                Text(
                                    text = "Contoh: $example",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFF64748B)
                                )
                            }
                        }

                        if (index != meaning.definitions.lastIndex) {
                            HorizontalDivider(color = Color(0xFFE2E8F0))
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
        }
    }

    InfoCard(
        title = "Catatan",
        body = "Kamus Bahasa Inggris ini memerlukan internet. Mode Inggris ke Indonesia mengambil definisi dari dictionaryapi.dev dan arti dari MyMemory. Mode Indonesia ke Inggris menerjemahkan dulu lewat MyMemory, lalu mencoba mengambil definisi Inggrisnya dari dictionaryapi.dev."
    )
}

@Composable
private fun JavaneseDictionaryResultContent(result: JavaneseDictionaryResultUi) {
    Card(
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = result.direction.label,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF7C3AED)
            )
            Text(
                text = "Input: ${result.sourceText}",
                style = MaterialTheme.typography.bodyMedium,
                color = Color(0xFF334155)
            )
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = Color(0xFFF3E8FF)
            ) {
                Text(
                    text = "Hasil: ${result.translatedText}",
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                    color = Color(0xFF6D28D9),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC))
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "Aksara Jawa",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF0F172A)
                    )
                    Text(
                        text = if (result.aksaraText.isBlank()) "-" else result.aksaraText,
                        style = MaterialTheme.typography.headlineSmall,
                        color = Color(0xFF1E293B),
                        textAlign = TextAlign.Start
                    )
                }
            }
        }
    }

    Spacer(modifier = Modifier.height(14.dp))

    if (result.wordBreakdown.isNotEmpty()) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Rincian Aksara per Kata",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF0F172A)
                )

                result.wordBreakdown.forEachIndexed { index, word ->
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = "${index + 1}. ${word.latinWord}",
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF334155)
                        )
                        Text(
                            text = word.aksaraWord,
                            style = MaterialTheme.typography.headlineSmall,
                            color = Color(0xFF1E293B)
                        )
                        Text(
                            text = word.note,
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF64748B)
                        )
                    }

                    if (index != result.wordBreakdown.lastIndex) {
                        HorizontalDivider(color = Color(0xFFE2E8F0))
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))
    }

    InfoCard(
        title = "Catatan",
        body = "Terjemahan bahasa Jawa memakai mode online dengan kode bahasa `jv-ID`, lalu aksara ditampilkan lewat transliterasi otomatis Hanacaraka. Hasil frasa sekarang lebih mendekati penggunaan nyata untuk contoh pendek, tetapi tetap belum setara model AI generatif penuh untuk kalimat panjang atau tingkat tutur yang rumit."
    )
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

@Composable
private fun InfoCard(
    title: String,
    body: String
) {
    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF0F172A)
            )
            Text(
                text = body,
                style = MaterialTheme.typography.bodyMedium,
                color = Color(0xFF475569)
            )
        }
    }
}

@Composable
private fun LoadingCard(message: String) {
    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            CircularProgressIndicator(color = Color(0xFF2563EB))
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = Color(0xFF475569),
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun ErrorCard(message: String) {
    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF1F2))
    ) {
        Text(
            text = message,
            modifier = Modifier.padding(18.dp),
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFFBE123C)
        )
    }
}

private suspend fun DictionaryEntryResponse.toEnglishResultUi(
    sourceKeyword: String,
    direction: EnglishDirection,
    translationLabel: String,
    translationOverride: String?
): EnglishDictionaryResultUi {
    val translatedWord = translationOverride ?: runCatching {
        val langPair = when (direction) {
            EnglishDirection.ENGLISH_TO_INDONESIA -> "en|id"
            EnglishDirection.INDONESIA_TO_ENGLISH -> "id|en"
        }
        withContext(Dispatchers.IO) {
            StudentDictionaryRemote.translationApi
                .translate(sourceKeyword, langPair)
                .responseData
                ?.translatedText
        }.decodeHtmlText()
    }.getOrNull()

    val normalizedMeanings = meanings
        .filter { meaning -> !meaning.partOfSpeech.isNullOrBlank() && meaning.definitions.isNotEmpty() }
        .map { meaning ->
            EnglishMeaningUi(
                partOfSpeech = meaning.partOfSpeech.orEmpty(),
                definitions = meaning.definitions.filter { !it.definition.isNullOrBlank() }
            )
        }
        .filter { it.definitions.isNotEmpty() }

    val resolvedPhonetic = phonetic
        ?.takeIf { it.isNotBlank() }
        ?: phonetics.firstOrNull { !it.text.isNullOrBlank() }?.text

    return EnglishDictionaryResultUi(
        direction = direction,
        sourceText = sourceKeyword,
        word = word?.takeIf { it.isNotBlank() } ?: sourceKeyword,
        phonetic = resolvedPhonetic,
        translationLabel = translationLabel,
        translation = translatedWord,
        meanings = normalizedMeanings
    )
}

private suspend fun resolveIndonesianToEnglishResult(keyword: String): EnglishDictionaryResultUi {
    val translationResponse = withContext(Dispatchers.IO) {
        StudentDictionaryRemote.translationApi.translate(keyword, "id|en")
    }

    val candidates = translationResponse.toEnglishCandidates(keyword)
    if (candidates.isEmpty()) {
        throw IllegalStateException("Terjemahan Inggris tidak ditemukan untuk kata tersebut.")
    }

    val sourceNormalized = keyword.normalizeLookupText()
    val rankedCandidates = candidates.take(4).map { candidate ->
        val reverseTranslation = runCatching {
            withContext(Dispatchers.IO) {
                StudentDictionaryRemote.translationApi
                    .translate(candidate.lookupText, "en|id")
                    .responseData
                    ?.translatedText
            }.decodeHtmlText()
        }.getOrNull()

        val dictionaryEntry = runCatching {
            withContext(Dispatchers.IO) {
                StudentDictionaryRemote.englishDictionaryApi
                    .getDefinition(candidate.lookupText.lowercase(Locale.ROOT))
                    .firstOrNull()
            }
        }.getOrNull()

        RankedEnglishCandidate(
            candidate = candidate,
            reverseTranslation = reverseTranslation,
            dictionaryEntry = dictionaryEntry,
            score = candidate.computeCandidateScore(
                sourceNormalized = sourceNormalized,
                reverseTranslation = reverseTranslation,
                hasDictionaryEntry = dictionaryEntry != null
            )
        )
    }.sortedByDescending { it.score }

    val bestCandidate = rankedCandidates.firstOrNull()
        ?: throw IllegalStateException("Terjemahan Inggris tidak ditemukan untuk kata tersebut.")

    return if (bestCandidate.dictionaryEntry != null) {
        bestCandidate.dictionaryEntry.toEnglishResultUi(
            sourceKeyword = keyword,
            direction = EnglishDirection.INDONESIA_TO_ENGLISH,
            translationLabel = "Input Indonesia",
            translationOverride = keyword
        )
    } else {
        EnglishDictionaryResultUi(
            direction = EnglishDirection.INDONESIA_TO_ENGLISH,
            sourceText = keyword,
            word = bestCandidate.candidate.displayText,
            phonetic = null,
            translationLabel = "Input Indonesia",
            translation = keyword,
            meanings = emptyList()
        )
    }
}

private data class RankedEnglishCandidate(
    val candidate: EnglishTranslationCandidate,
    val reverseTranslation: String?,
    val dictionaryEntry: DictionaryEntryResponse?,
    val score: Int
)

private fun TranslationResponse.toEnglishCandidates(sourceKeyword: String): List<EnglishTranslationCandidate> {
    val candidates = buildList {
        responseData?.translatedText
            .decodeHtmlText()
            .takeIf { it.isNotBlank() }
            ?.let { translatedText ->
                add(
                    EnglishTranslationCandidate(
                        displayText = translatedText.toEnglishDisplayText(),
                        lookupText = translatedText.toEnglishLookupText(),
                        sourceSegment = sourceKeyword,
                        providerScore = responseData?.match ?: 0.0
                    )
                )
            }

        matches.forEach { match ->
            val translatedText = match.translation.decodeHtmlText()
            val lookupText = translatedText.toEnglishLookupText()
            if (translatedText.isBlank() || lookupText.isBlank()) return@forEach

            add(
                EnglishTranslationCandidate(
                    displayText = translatedText.toEnglishDisplayText(),
                    lookupText = lookupText,
                    sourceSegment = match.segment.decodeHtmlText().ifBlank { sourceKeyword },
                    providerScore = match.match ?: 0.0
                )
            )
        }
    }

    return candidates
        .filter { it.lookupText.isNotBlank() }
        .distinctBy { it.lookupText.lowercase(Locale.ROOT) }
}

private fun EnglishTranslationCandidate.computeCandidateScore(
    sourceNormalized: String,
    reverseTranslation: String?,
    hasDictionaryEntry: Boolean
): Int {
    val reverseNormalized = reverseTranslation.normalizeLookupText()
    val sourceSegmentNormalized = sourceSegment.normalizeLookupText()
    val lookupNormalized = lookupText.normalizeLookupText()
    var score = (providerScore * 100).toInt()

    if (lookupText == displayText) score += 8
    if (lookupText.split(' ').size == 1) score += 12
    if (sourceSegmentNormalized == sourceNormalized) score += 10
    if (reverseNormalized == sourceNormalized) score += 80
    else if (reverseNormalized.contains(sourceNormalized) || sourceNormalized.contains(reverseNormalized)) score += 35
    if (hasDictionaryEntry) score += 25
    score -= (lookupNormalized.length - 5).coerceAtLeast(0)

    return score
}

private fun String?.toEnglishLookupText(): String {
    if (this.isNullOrBlank()) return ""
    return this
        .lowercase(Locale.ROOT)
        .substringBefore(',')
        .substringBefore(';')
        .substringBefore('/')
        .replace(Regex("[^a-z\\s-]"), " ")
        .replace(Regex("\\s+"), " ")
        .trim()
}

private fun String?.toEnglishDisplayText(): String {
    val lookupText = this.toEnglishLookupText()
    return if (lookupText.isBlank()) "" else lookupText
        .split(" ")
        .joinToString(" ") { part ->
            part.replaceFirstChar { char ->
                if (char.isLowerCase()) char.titlecase(Locale.ROOT) else char.toString()
            }
        }
}

private fun String?.normalizeLookupText(): String {
    if (this.isNullOrBlank()) return ""
    return this
        .lowercase(Locale.ROOT)
        .replace(Regex("[^a-zA-Z\\s]"), " ")
        .replace(Regex("\\s+"), " ")
        .trim()
}

private suspend fun resolveJavaneseDictionaryResult(
    keyword: String,
    direction: JavaneseDirection
): JavaneseDictionaryResultUi {
    val response = withContext(Dispatchers.IO) {
        StudentDictionaryRemote.translationApi.translate(keyword, direction.langPair)
    }

    if ((response.responseStatus ?: 200) >= 400) {
        throw IllegalStateException(
            response.responseDetails
                .decodeHtmlText()
                .ifBlank { "Layanan terjemahan bahasa Jawa sedang menolak permintaan." }
        )
    }

    val translatedText = response.bestJavaneseTranslation(keyword)
    if (translatedText.isBlank()) {
        throw IllegalStateException("Terjemahan bahasa Jawa tidak ditemukan untuk kata tersebut.")
    }

    val javaneseWord = if (direction == JavaneseDirection.INDONESIA_TO_JAVA) {
        translatedText
    } else {
        keyword
    }

    return JavaneseDictionaryResultUi(
        direction = direction,
        sourceText = keyword,
        translatedText = translatedText,
        aksaraText = HanacarakaConverter.convert(javaneseWord),
        wordBreakdown = buildJavaneseWordBreakdown(javaneseWord)
    )
}

private fun TranslationResponse.bestJavaneseTranslation(sourceKeyword: String): String {
    val exactSegment = sourceKeyword.normalizeGeneralText()
    val candidates = buildList {
        responseData?.translatedText
            .decodeHtmlText()
            .takeIf { it.isNotBlank() }
            ?.let { add(it) }

        matches.forEach { match ->
            val translated = match.translation.decodeHtmlText()
            if (translated.isBlank()) return@forEach

            val segment = match.segment.decodeHtmlText().normalizeGeneralText()
            val score = (match.match ?: 0.0) + if (segment == exactSegment) 0.2 else 0.0
            add("$score|||$translated")
        }
    }

    return candidates
        .mapNotNull { raw ->
            if ("|||" in raw) {
                val parts = raw.split("|||", limit = 2)
                val score = parts.firstOrNull()?.toDoubleOrNull() ?: return@mapNotNull null
                score to parts.getOrElse(1) { "" }
            } else {
                0.5 to raw
            }
        }
        .sortedByDescending { it.first }
        .map { it.second.cleanTranslationSentence() }
        .firstOrNull { it.isNotBlank() && !it.looksLikeTranslationError() }
        .orEmpty()
}

private fun buildJavaneseWordBreakdown(javaneseText: String): List<JavaneseWordBreakdownUi> {
    return javaneseText
        .split(Regex("\\s+"))
        .map { it.cleanTranslationSentence() }
        .filter { it.isNotBlank() }
        .map { word ->
            JavaneseWordBreakdownUi(
                latinWord = word,
                aksaraWord = HanacarakaConverter.convert(word),
                note = buildJavaneseWordNote(word)
            )
        }
}

private fun buildJavaneseWordNote(word: String): String {
    return when {
        word.startsWithVowelSound() ->
            "Diawali vokal, jadi aksara dibuka dengan aksara swara/ha sesuai pola transliterasi Hanacaraka di aplikasi."
        word.endsWith("ng", ignoreCase = true) ->
            "Akhiran `ng` dipertahankan sebagai bunyi sengau akhir agar bacaan kata tetap mendekati pelafalan Jawa."
        word.endsWith("n", ignoreCase = true) ->
            "Akhiran `n` ditutup dengan konsonan akhir agar bunyinya tetap mati sesuai ejaan kata."
        else ->
            "Ditulis otomatis dari bentuk latin ke Hanacaraka berdasarkan aturan transliterasi sederhana yang dipakai aplikasi."
    }
}

private fun String.cleanTranslationSentence(): String {
    return this
        .replace('\n', ' ')
        .replace(Regex("\\s+"), " ")
        .replace(Regex("[`\"“”]"), "")
        .trim()
        .trimEnd('.', '!', '?', ';', ':')
}

private fun String.looksLikeTranslationError(): Boolean {
    val upper = uppercase(Locale.ROOT)
    return upper.contains("INVALID TARGET LANGUAGE") ||
        upper.contains("ALMOST ALL LANGUAGES SUPPORTED") ||
        upper.contains("EXAMPLE: LANGPAIR")
}

private fun String.normalizeGeneralText(): String {
    return lowercase(Locale.ROOT)
        .replace(Regex("\\s+"), " ")
        .trim()
}

private fun String.startsWithVowelSound(): Boolean {
    val normalized = lowercase(Locale.ROOT)
    return normalized.startsWith("a") ||
        normalized.startsWith("i") ||
        normalized.startsWith("u") ||
        normalized.startsWith("e") ||
        normalized.startsWith("o")
}

private fun String?.decodeHtmlText(): String {
    if (this.isNullOrBlank()) return ""
    return HtmlCompat.fromHtml(this, HtmlCompat.FROM_HTML_MODE_LEGACY).toString().trim()
}

private fun Throwable.toUserMessage(): String {
    return when (this) {
        is HttpException -> {
            if (code() == 404) {
                "Kata yang dicari tidak ditemukan."
            } else {
                "Server kamus sedang merespons dengan error ${code()}."
            }
        }

        is IllegalStateException -> message ?: "Data kamus tidak tersedia."
        else -> "Gagal terhubung ke layanan kamus. Periksa koneksi internet lalu coba lagi."
    }
}
