package com.satupintu.mobile.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.airbnb.lottie.compose.*
import com.satupintu.mobile.R
import com.satupintu.mobile.data.model.PetAchievement
import com.satupintu.mobile.data.model.PetQuest
import com.satupintu.mobile.data.model.VirtualPet
import com.satupintu.mobile.ui.viewmodel.VirtualPetViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VirtualPetScreen(
    studentId: String,
    schoolId: String = "",
    onBack: () -> Unit,
    viewModel: VirtualPetViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(studentId, schoolId) {
        viewModel.loadPet(studentId, schoolId)
    }

    LaunchedEffect(uiState.message) {
        uiState.message?.let {
            snackbarHostState.showSnackbar(it, duration = SnackbarDuration.Short)
            viewModel.clearMessage()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
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
                    title = { Text("Sahabat Belajar") },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                        }
                    },
                    actions = {
                        if (uiState.pet != null) {
                            CoinDisplay(coins = uiState.pet!!.coins)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color.Transparent,
                        titleContentColor = Color.White,
                        navigationIconContentColor = Color.White,
                        actionIconContentColor = Color.White
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
            if (uiState.isLoading && uiState.pet == null) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center), color = Color.White)
            } else if (uiState.error != null && uiState.pet == null) {
                Text(
                    text = uiState.error!!,
                    color = Color(0xFFFFB4A9),
                    modifier = Modifier.align(Alignment.Center)
                )
            } else if (uiState.pet != null) {
                CompositionLocalProvider(LocalContentColor provides Color.White) {
                    PetContent(
                        pet = uiState.pet!!,
                        quests = uiState.quests,
                        achievements = uiState.achievements,
                        leaderboard = uiState.leaderboard,
                        onFeed = { viewModel.feedPet(uiState.pet!!) },
                        onPlay = { viewModel.playWithPet(uiState.pet!!) },
                        onSleep = { viewModel.sleepPet(uiState.pet!!) },
                        onStroke = { viewModel.strokePet(uiState.pet!!) },
                        onClaimQuest = { viewModel.claimQuest(it, uiState.pet!!) },
                        onDebugProgress = { viewModel.progressQuest(it) }
                    )
                }
            }
        }
    }
}

@Composable
fun CoinDisplay(coins: Int) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = Color(0xFFFFD700), // Gold
        modifier = Modifier.padding(end = 16.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Star,
                contentDescription = "Coins",
                tint = Color.White,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = "$coins",
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
    }
}

@Composable
fun PetContent(
    pet: VirtualPet,
    quests: List<PetQuest>,
    achievements: List<PetAchievement>,
    leaderboard: List<VirtualPet>,
    onFeed: () -> Unit,
    onPlay: () -> Unit,
    onSleep: () -> Unit,
    onStroke: () -> Unit,
    onClaimQuest: (PetQuest) -> Unit,
    onDebugProgress: (PetQuest) -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("Status", "Misi", "Pencapaian", "Peringkat")

    Column(modifier = Modifier.fillMaxSize()) {
        // Pet Avatar & Main Stats Area
        PetHeader(pet)

        // Tabs
        ScrollableTabRow(
            selectedTabIndex = selectedTab,
            edgePadding = 0.dp,
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

        // Tab Content
        Box(modifier = Modifier.weight(1f)) {
            when (selectedTab) {
                0 -> StatusTab(pet, onFeed, onPlay, onSleep, onStroke)
                1 -> QuestsTab(quests, onClaimQuest, onDebugProgress)
                2 -> AchievementsTab(achievements)
                3 -> LeaderboardTab(leaderboard, pet.id)
            }
        }
    }
}

@Composable
fun PetHeader(pet: VirtualPet) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF0B1F33).copy(alpha = 0.22f))
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Level Bar
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Level ${pet.level}",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Column(modifier = Modifier.weight(1f).padding(horizontal = 12.dp)) {
                val progress = pet.experiencePoints.toFloat() / (pet.level * 100f)
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                )
                Text(
                    text = "${pet.experiencePoints}/${pet.level * 100} XP",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.align(Alignment.End)
                )
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        // Combined Stats and Avatar Area (Overlay)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(260.dp) // Drastically reduced height
        ) {
            // 1. Pet Animation (Background/Center)
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = 100.dp, bottom = 20.dp), // Tighter padding
                contentAlignment = Alignment.Center
            ) {
                PetVisuals(pet = pet)
            }

            // 2. Stats List (Overlay Top)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
                    .padding(horizontal = 16.dp)
            ) {
                PetStatusBar(
                    Icons.Default.ShoppingCart,
                    "Kenyang",
                    (100 - pet.hunger).coerceIn(0, 100),
                    Color(0xFF4CAF50)
                )
                PetStatusBar(Icons.Default.Face, "Kebahagiaan", pet.happiness, Color(0xFFE91E63))
                PetStatusBar(Icons.Default.ThumbUp, "Energi", pet.energy, Color(0xFFFFC107))
                PetStatusBar(Icons.Default.Favorite, "Kesehatan", pet.health, Color(0xFF2196F3))
            }

            // 3. Student Name (Overlay Bottom)
            Text(
                text = pet.petName,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 2.dp)
            )
        }
    }
}

@Composable
fun StatusTab(
    pet: VirtualPet,
    onFeed: () -> Unit,
    onPlay: () -> Unit,
    onSleep: () -> Unit,
    onStroke: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Status Badge
        if (pet.status == "DEAD" || pet.health <= 0) {
            Surface(
                color = Color.Black,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.padding(bottom = 8.dp)
            ) {
                Text(
                    text = "MATI",
                    color = Color.White,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                )
            }
        } else if (pet.health < 30 || pet.happiness < 30) {
             Surface(
                color = Color(0xFFE91E63), // Pink/Red
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.padding(bottom = 8.dp)
            ) {
                Text(
                    text = "SAKIT",
                    color = Color.White,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                )
            }
        } else {
             Surface(
                color = Color(0xFF4CAF50), // Green
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.padding(bottom = 8.dp)
            ) {
                Text(
                    text = "SEHAT",
                    color = Color.White,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Action Buttons or Dead Message
        val isDead = pet.status == "DEAD" || pet.health <= 0

        if (isDead) {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = "Dead",
                        tint = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.size(32.dp)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Sahabat Belajarmu Telah Mati",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Hubungi Admin atau Guru Wali Kelas untuk memulihkan (Revive) pet kamu.",
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }
        } else {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                ActionButton("Tidur", Icons.Default.Home, Color(0xFFF44336), "+Kesehatan", onSleep)
                ActionButton("Elus", Icons.Default.FavoriteBorder, Color(0xFFFFEB3B), "+Bahagia", onStroke)
                ActionButton("Main", Icons.Default.Face, Color(0xFF2196F3), "+Energi", onPlay)
                ActionButton("Makan", Icons.Default.ShoppingCart, Color(0xFF4CAF50), "+Kenyang", onFeed)
            }
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        TipsCard()
    }
}

@Composable
fun PetStatusBar(
    icon: ImageVector,
    label: String,
    value: Int,
    color: Color,
    valueText: String = "$value%"
) {
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(14.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text(text = label, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
            }
            Text(text = valueText, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
        }
        Spacer(modifier = Modifier.height(2.dp))
        LinearProgressIndicator(
            progress = { value / 100f },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp)),
            color = color,
            trackColor = color.copy(alpha = 0.2f)
        )
    }
}

@Composable
fun StatItem(icon: ImageVector, label: String, value: Int, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(24.dp))
        Spacer(modifier = Modifier.height(4.dp))
        Text(text = "$value%", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Text(text = label, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
fun ActionButton(label: String, icon: ImageVector, color: Color, effect: String, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Button(
            onClick = onClick,
            colors = ButtonDefaults.buttonColors(containerColor = color),
            shape = CircleShape,
            contentPadding = PaddingValues(0.dp),
            modifier = Modifier.size(56.dp)
        ) {
            Icon(icon, contentDescription = label, tint = Color.White)
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(text = label, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
        Text(text = effect, style = MaterialTheme.typography.labelSmall, color = Color.Gray)
    }
}

@Composable
fun TipsCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Tips Sahabat Belajar:",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(8.dp))
            InfoBox(
                icon = Icons.Default.Info,
                title = "Cara Merawat Pet:",
                content = """
                    - Kenyang: Baca buku di E-Library (>1 jam)
                    - Kebahagiaan: Absensi Datang & Pulang Tepat Waktu
                    - Energi: Lakukan kebiasaan 7 KAIH
                    - Kesehatan: Kerjakan Tugas Literasi
                """.trimIndent(),
                backgroundColor = Color(0xFF2196F3).copy(alpha = 0.2f),
                borderColor = Color(0xFF2196F3),
                iconColor = Color(0xFF2196F3)
            )
            Spacer(modifier = Modifier.height(16.dp))
            InfoBox(
                icon = Icons.Default.Star,
                title = "Pro Tip:",
                content = "Konsistensi adalah kunci! Lakukan semua aktivitas di atas setiap hari agar Pet kamu selalu SEHAT dan mencapai Level maksimal! â­",
                backgroundColor = Color(0xFFFFC107).copy(alpha = 0.2f),
                borderColor = Color(0xFFFFC107),
                iconColor = Color(0xFFFFC107)
            )
        }
    }
}

@Composable
fun InfoBox(icon: ImageVector, title: String, content: String, backgroundColor: Color, borderColor: Color, iconColor: Color) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(backgroundColor, RoundedCornerShape(8.dp))
            .border(1.dp, borderColor, RoundedCornerShape(8.dp))
            .padding(12.dp)
    ) {
        Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(24.dp))
        Spacer(modifier = Modifier.width(12.dp))
        Column {
            Text(text = title, fontWeight = FontWeight.Bold, color = iconColor)
            Text(text = content, style = MaterialTheme.typography.bodySmall)
        }
    }
}

// --- STATE MACHINE PATTERN (Game Engine Logic) ---
// Pola ini meniru cara kerja game engine seperti Unity/Godot
// Setiap kondisi Pet dipisahkan menjadi "State" yang jelas.

sealed class PetState {
    object Dead : PetState()
    object Sick : PetState()
    object Healthy : PetState()
    object Sleeping : PetState() // Persiapan untuk fitur masa depan
    object Eating : PetState()   // Persiapan untuk fitur masa depan
}

fun determinePetState(pet: VirtualPet): PetState {
    return when {
        pet.status == "DEAD" || pet.health <= 0 -> PetState.Dead
        pet.health < 30 || pet.happiness < 30 -> PetState.Sick
        // Nanti bisa ditambahkan logika: if (isSleeping) PetState.Sleeping
        else -> PetState.Healthy
    }
}

@Composable
fun PetVisuals(
    pet: VirtualPet // Pass full object to determine state
) {
    val currentState = remember(pet.status, pet.health, pet.happiness) {
        determinePetState(pet)
    }

    // Game Logic: Mapping State -> Animation Resource & Speed
    val (animRes, animSpeed) = when (currentState) {
        is PetState.Dead -> Pair(R.raw.pet_dead, 1.0f)
        is PetState.Sick -> Pair(R.raw.cute_cat, 0.5f) // Slow motion effect for sick
        is PetState.Healthy -> Pair(R.raw.cute_cat, 1.0f)
        is PetState.Sleeping -> Pair(R.raw.cute_cat, 0.0f) // Placeholder
        is PetState.Eating -> Pair(R.raw.cute_cat, 1.0f)   // Placeholder
    }

    val composition by rememberLottieComposition(LottieCompositionSpec.RawRes(animRes))
    val progress by animateLottieCompositionAsState(
        composition = composition,
        iterations = LottieConstants.IterateForever,
        speed = animSpeed
    )

    Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
        if (composition == null) {
            CircularProgressIndicator()
        } else {
            LottieAnimation(
                composition = composition,
                progress = { progress },
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}



@Composable
fun QuestsTab(
    quests: List<PetQuest>,
    onClaim: (PetQuest) -> Unit,
    onDebugProgress: (PetQuest) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(quests) { quest ->
            QuestItem(quest, onClaim, onDebugProgress)
        }
    }
}

@Composable
fun QuestItem(
    quest: PetQuest,
    onClaim: (PetQuest) -> Unit,
    onDebugProgress: (PetQuest) -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (quest.isCompleted) MaterialTheme.colorScheme.surfaceVariant.copy(alpha=0.5f) else MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(modifier = Modifier.padding(16.dp).clickable { onDebugProgress(quest) }) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(quest.title, fontWeight = FontWeight.Bold)
                    Text(quest.description, style = MaterialTheme.typography.bodySmall)
                }
                if (quest.isCompleted) {
                    Icon(Icons.Default.Check, "Selesai", tint = Color.Green)
                } else {
                    Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            "${quest.reward} XP",
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                LinearProgressIndicator(
                    progress = { quest.progress.toFloat() / quest.target.toFloat() },
                    modifier = Modifier.weight(1f).height(8.dp).clip(RoundedCornerShape(4.dp))
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text("${quest.progress}/${quest.target}")
            }
            if (!quest.isCompleted && quest.progress >= quest.target) {
                Spacer(modifier = Modifier.height(12.dp))
                Button(
                    onClick = { onClaim(quest) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Klaim Hadiah")
                }
            }
        }
    }
}

@Composable
fun AchievementsTab(achievements: List<PetAchievement>) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(3),
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(achievements) { achievement ->
            AchievementItem(achievement)
        }
    }
}

@Composable
fun AchievementItem(achievement: PetAchievement) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (achievement.unlocked) Color(0xFFFFD700) else MaterialTheme.colorScheme.surfaceVariant
        ),
        modifier = Modifier.aspectRatio(1f)
    ) {
        Column(
            modifier = Modifier.padding(8.dp).fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = if (achievement.unlocked) Icons.Default.Star else Icons.Default.Lock,
                contentDescription = null,
                tint = if (achievement.unlocked) Color.White else Color.Gray,
                modifier = Modifier.size(32.dp)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = achievement.title,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Text(
                text = achievement.description,
                style = MaterialTheme.typography.labelSmall,
                textAlign = TextAlign.Center,
                minLines = 2,
                maxLines = 2
            )
        }
    }
}

@Composable
fun LeaderboardTab(leaderboard: List<VirtualPet>, currentPetId: String) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            Text(
                text = "Peringkat Global",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 8.dp)
            )
        }

        items(leaderboard.size) { index ->
            val item = leaderboard[index]
            val isCurrentUser = item.id == currentPetId
            val rank = index + 1

            Card(
                colors = CardDefaults.cardColors(
                    containerColor = if (isCurrentUser)
                        MaterialTheme.colorScheme.primaryContainer
                    else
                        MaterialTheme.colorScheme.surfaceVariant
                ),
                elevation = CardDefaults.cardElevation(if (isCurrentUser) 4.dp else 1.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Rank Badge
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .background(
                                color = when (rank) {
                                    1 -> Color(0xFFFFD700) // Gold
                                    2 -> Color(0xFFC0C0C0) // Silver
                                    3 -> Color(0xFFCD7F32) // Bronze
                                    else -> MaterialTheme.colorScheme.secondaryContainer
                                },
                                shape = CircleShape
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "#$rank",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                            color = if (rank <= 3) Color.White else MaterialTheme.colorScheme.onSecondaryContainer
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    // Name & Stats
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = item.petName,
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1
                        )
                        Text(
                            text = "Level ${item.level} | ${item.experiencePoints} XP",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    // Crown Icon for Top 1
                    if (rank == 1) {
                        Icon(
                            imageVector = Icons.Default.Star, // Placeholder for Crown
                            contentDescription = "Champion",
                            tint = Color(0xFFFFD700),
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }
        }

        if (leaderboard.isEmpty()) {
            item {
                Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text("Belum ada data peringkat.", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

