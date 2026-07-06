package com.satupintu.mobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.satupintu.mobile.data.model.PetAchievement
import com.satupintu.mobile.data.model.PetQuest
import com.satupintu.mobile.data.model.VirtualPet
import com.satupintu.mobile.data.repository.StudentRepository
import com.satupintu.mobile.data.repository.VirtualPetRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import java.util.Calendar

data class VirtualPetUiState(
    val pet: VirtualPet? = null,
    val quests: List<PetQuest> = emptyList(),
    val achievements: List<PetAchievement> = emptyList(),
    val leaderboard: List<VirtualPet> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val message: String? = null
)

class VirtualPetViewModel : ViewModel() {
    private val repository = VirtualPetRepository()
    private val studentRepository = StudentRepository()
    private val _uiState = MutableStateFlow(VirtualPetUiState(isLoading = true))
    val uiState: StateFlow<VirtualPetUiState> = _uiState.asStateFlow()

    fun clearMessage() {
        _uiState.update { it.copy(message = null) }
    }

    private var petJob: Job? = null
    private var leaderboardJob: Job? = null

    fun loadLeaderboard(schoolId: String) {
        leaderboardJob?.cancel()
        val normalizedSchoolId = schoolId.trim().lowercase()
        leaderboardJob = viewModelScope.launch {
            combine(
                repository.getAllPets(normalizedSchoolId),
                studentRepository.getStudents(normalizedSchoolId)
            ) { pets, students ->
                val scopedStudents = if (normalizedSchoolId.isBlank()) {
                    students
                } else {
                    students.filter { it.schoolId.trim().lowercase() == normalizedSchoolId }
                }

                val studentMap = buildMap {
                    scopedStudents.forEach { student ->
                        val stableId = student.id.trim()
                        val nisn = student.nisn.trim()
                        if (stableId.isNotEmpty()) put(stableId, student)
                        if (nisn.isNotEmpty()) put(nisn, student)
                    }
                }

                pets.mapNotNull { pet ->
                    val student = studentMap[pet.studentId.trim()] ?: return@mapNotNull null
                    pet.copy(
                        petName = student.name.ifBlank { pet.petName }
                    )
                }.sortedWith(
                    compareByDescending<VirtualPet> { it.level }
                        .thenByDescending { it.experiencePoints }
                )
            }.collect { sortedPets ->
                _uiState.update { it.copy(leaderboard = sortedPets) }
            }
        }
    }

    fun loadPet(credential: String, sessionSchoolId: String = "") {
        petJob?.cancel()
        petJob = viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                // Resolve Student Key from Credential (NISN/Username)
                val resolution = resolveStudentIdentity(credential)
                if (resolution == null) {
                    _uiState.update { it.copy(error = "Siswa tidak ditemukan", isLoading = false) }
                    return@launch
                }

                val effectiveSchoolId = sessionSchoolId.trim().ifBlank { resolution.schoolId }
                loadLeaderboard(effectiveSchoolId)

                repository.getVirtualPetByStudentId(resolution.studentKey, effectiveSchoolId).flatMapLatest { pet ->
                    if (pet == null) {
                        flow {
                            createPet(resolution.studentKey, resolution.studentName, effectiveSchoolId)
                        }
                    } else {
                        // Sync name if different
                        if (pet.petName != resolution.studentName || pet.schoolId.trim().lowercase() != effectiveSchoolId.trim().lowercase()) {
                            val updatedPet = pet.copy(
                                petName = resolution.studentName,
                                schoolId = effectiveSchoolId
                            )
                            repository.updateVirtualPet(updatedPet)
                        }

                        // Combine quests and achievements with Realtime Data
                        combine(
                            repository.getPetQuests(pet.id),
                            repository.getPetAchievements(pet.id),
                            combine(
                                repository.getRealtimeReadingDuration(resolution.studentKey),
                                repository.getRealtimeHabits(resolution.studentKey),
                                repository.getRealtimeAttendance(resolution.studentKey),
                                repository.getRealtimeLiteracyCount(resolution.studentKey, resolution.studentName, effectiveSchoolId)
                            ) { r, h, a, l -> RealtimeStats(r, h, a, l) }
                        ) { quests, achievements, stats ->
                            // Check for daily reset
                            checkDailyReset(pet, quests)
                            
                            // Check for Quest Migration (Belajar Fokus -> Membaca Buku)
                            checkQuestMigration(pet, quests)

                            // --- REALTIME SYNC LOGIC ---
                            // 1. Hunger (Reading): 60 mins (3.6M ms) = 100% Full (0 Hunger)
                            val targetMillis = 60 * 60 * 1000f
                            val saturationPct = (stats.readingDuration / targetMillis * 100).coerceAtMost(100f).toInt()
                            val calculatedHunger = 100 - saturationPct
                            
                            // 2. Energy (Habits): 7 habits = 100% Energy
                            val calculatedEnergy = ((stats.habitsCount / 7f) * 100).coerceAtMost(100f).toInt()
                            
                            // 3. Happiness (Attendance Rules)
                            // Rules:
                            // 1. On Time + Check Out = 100%
                            // 2. Late + Check Out = -10% (90%)
                            // 3. On Time + Early Leave (Bolos) = -25% (75%)
                            // 4. Late + Early Leave (Bolos) = -10% + -25% (65%)
                            
                            val statusStr = stats.attendanceData["status"] as? String
                            val checkOutTime = stats.attendanceData["checkOutTime"] as? String ?: ""
                            
                            var happinessScore = 100
                            
                            if (statusStr != null) {
                                // Check Arrival Status
                                val isLate = statusStr.equals("TERLAMBAT", ignoreCase = true) || statusStr.equals("LATE", ignoreCase = true)
                                val isAbsent = statusStr.equals("ABSENT", ignoreCase = true) || statusStr.equals("ALPA", ignoreCase = true)
                                val isPermit = statusStr.equals("IZIN", ignoreCase = true) || statusStr.equals("SAKIT", ignoreCase = true) || statusStr.equals("PERMIT", ignoreCase = true) || statusStr.equals("SICK", ignoreCase = true)
                                
                                if (isAbsent) {
                                    happinessScore = 0
                                } else if (isPermit) {
                                    happinessScore = 50 // Permit/Sick fallback
                                } else {
                                    // Present or Late
                                    if (isLate) {
                                        happinessScore -= 10 // Rule 2 & 4
                                    }
                                    
                                    // Check Departure Status
                                    val calendar = Calendar.getInstance()
                                    val currentHour = calendar.get(Calendar.HOUR_OF_DAY)
                                    val isFriday = calendar.get(Calendar.DAY_OF_WEEK) == Calendar.FRIDAY
                                    val dismissalHour = if (isFriday) 11 else 14 // Fri: 11:00, Mon-Thu: 14:00
                                    
                                    if (checkOutTime.isNotEmpty()) {
                                        // Parse CheckOut Time (HH:mm or Timestamp)
                                        val checkOutHour = try {
                                            if (checkOutTime.contains(":")) {
                                                checkOutTime.split(":")[0].toInt()
                                            } else {
                                                val millis = checkOutTime.toLong()
                                                val c = Calendar.getInstance()
                                                c.timeInMillis = millis
                                                c.get(Calendar.HOUR_OF_DAY)
                                            }
                                        } catch (e: Exception) {
                                            dismissalHour // Fail safe
                                        }
                                        
                                        if (checkOutHour < dismissalHour) {
                                            happinessScore -= 25 // Rule 3 & 4 (Early Leave)
                                        }
                                    } else {
                                        // No CheckOut yet
                                        if (currentHour >= dismissalHour) {
                                            // School over, but no checkout -> Treat as Early Leave/Bolos
                                            happinessScore -= 25
                                            _uiState.update { it.copy(message = "Jangan lupa Check-Out sebelum pulang! Kebahagiaan berkurang.") }
                                        }
                                    }
                                }
                            }
                            
                            var attendanceBaseline = happinessScore.coerceIn(0, 100)
                            
                            // Apply Penalty from Discipline (Firebase Value)
                            // We compare the Calculated Attendance Baseline (which includes Late/Early Departure logic)
                            // with the Firebase Happiness (which includes Discipline Penalties).
                            // We take the LOWER value to ensure all penalties are respected.
                            
                            var calculatedHappiness = attendanceBaseline
                            if (pet.happiness < attendanceBaseline) {
                                calculatedHappiness = pet.happiness
                            }
                            
                            // 4. Health (Literacy): Submission in last 7 days = 100, else 20
                            val calculatedHealth = if (stats.literacyCount > 0) 100 else 20
                            
                            // --- GRACE PERIOD LOGIC ---
                            // If Pet was updated/revived in the last 1 hour, respect the Firebase values 
                            // if they are higher than calculated values. This prevents immediate death loop after Admin Revive.
                            val isRecentlyUpdated = (System.currentTimeMillis() - pet.updatedAt) < (60 * 60 * 1000) // 1 Hour Grace Period

                            val newHealth = if (isRecentlyUpdated && pet.health > calculatedHealth) pet.health else calculatedHealth
                            val newHappiness = if (isRecentlyUpdated && pet.happiness > calculatedHappiness) pet.happiness else calculatedHappiness
                            val newEnergy = if (isRecentlyUpdated && pet.energy > calculatedEnergy) pet.energy else calculatedEnergy
                            // Hunger is inverse (Lower is better/fuller? No, in DB 0=Hungry? Wait. 
                            // Previous logic: newHunger = 100 - saturationPct. High Hunger = Bad.
                            // If Admin sets Hunger=50 (Medium), and Calculated=100 (Starving).
                            // We want to keep 50. So if calculated > pet.hunger (Worse), keep pet.hunger.
                            val newHunger = if (isRecentlyUpdated && pet.hunger < calculatedHunger) pet.hunger else calculatedHunger

                            // Determine Pet Status
                            val averageStats = (newHealth + newHappiness + newEnergy + (100 - newHunger)) / 4
                            var newStatus = when {
                                averageStats < 20 -> "DEAD" // < 20% = DEAD
                                newHealth < 30 || newHappiness < 30 -> "SICK"
                                newHappiness < 50 -> "SAD"
                                else -> "HAPPY"
                            }
                            
                            // If already DEAD, keep it DEAD until Admin revives (status changed in DB)
                            // But here we are calculating "newStatus" from stats.
                            // If stats are still < 20, it stays DEAD.
                            // If stats > 20 but it WAS dead, does it revive? 
                            // User request: "siswa bisa meminta admin untuk menghidupkannya" -> Implies manual revival.
                            // So if pet.status is DEAD, we force it to stay DEAD unless stats are > 20 AND Admin flipped it?
                            // No, simpler: If stats < 20, it dies. If stats > 20, it CAN be alive.
                            // But the penalty (denda) implies a lock.
                            // Let's implement: If pet.status is DEAD, it stays DEAD.
                            // Only if Admin manually sets it to HAPPY (and stats are > 20) will it survive.
                            if (pet.status == "DEAD") {
                                newStatus = "DEAD"
                            }

                            // Level Reset Logic (If average < 40 and Level > 1)
                            var newLevel = pet.level
                            var newXp = pet.experiencePoints
                            
                            if (averageStats < 40 && pet.level > 1 && newStatus != "DEAD") {
                                newLevel = 1
                                newXp = 0
                                _uiState.update { it.copy(message = "Level Reset ke 1 karena nilai keaktifan rendah!") }
                            }

                            // --- QUEST PROGRESS SYNC ---
                            val updatedQuests = quests.map { quest ->
                                var newProgress = quest.progress
                                when (quest.title) {
                                    "Hadir Hari Ini" -> {
                                        val status = stats.attendanceData["status"] as? String
                                        if (status == "PRESENT" || status == "HADIR" || 
                                            status == "TEPAT WAKTU" || status == "ON TIME") {
                                            newProgress = 1
                                        }
                                    }
                                    "Praktik 3 Kebiasaan" -> {
                                        newProgress = stats.habitsCount
                                    }
                                    "Membaca Buku" -> {
                                        // Target is 1, reached if reading >= 1 hour (3.6M ms)
                                        if (stats.readingDuration >= 60 * 60 * 1000) {
                                            newProgress = 1
                                        }
                                    }
                                }
                                quest.copy(progress = newProgress)
                            }
                            
                            var finalPet = pet.copy(
                                hunger = newHunger,
                                energy = newEnergy,
                                happiness = newHappiness,
                                health = newHealth,
                                status = newStatus,
                                level = newLevel,
                                experiencePoints = newXp
                            )

                            // Sync to Firebase if stats changed significantly
                            if (kotlin.math.abs(pet.hunger - newHunger) > 1 || 
                                kotlin.math.abs(pet.energy - newEnergy) > 1 ||
                                kotlin.math.abs(pet.happiness - newHappiness) > 1 ||
                                kotlin.math.abs(pet.health - newHealth) > 1 ||
                                pet.status != newStatus ||
                                pet.level != newLevel) {
                                
                                finalPet = finalPet.copy(updatedAt = System.currentTimeMillis())
                                repository.updateVirtualPet(finalPet)
                            } else {
                                finalPet = pet // Prevent loop jitter
                            }

                            Triple(finalPet, updatedQuests, achievements)
                        }
                    }
                }.collect { (currentPet, quests, achievements) ->
                    _uiState.update { 
                        it.copy(
                            pet = currentPet,
                            quests = quests,
                            achievements = achievements,
                            isLoading = false
                        ) 
                    }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Failed to load pet", isLoading = false) }
            }
        }
    }

    data class RealtimeStats(
        val readingDuration: Long,
        val habitsCount: Int,
        val attendanceData: Map<String, Any?>,
        val literacyCount: Int
    )

    private data class StudentIdentity(
        val studentKey: String,
        val studentName: String,
        val schoolId: String
    )

    private suspend fun resolveStudentIdentity(credential: String): StudentIdentity? {
        // Try to find by NISN first, then Username
        val studentsRef = com.google.firebase.database.FirebaseDatabase.getInstance().getReference("students")
        
        return kotlinx.coroutines.suspendCancellableCoroutine { continuation ->
            val query = if (credential.all { it.isDigit() }) {
                studentsRef.orderByChild("nisn").equalTo(credential)
            } else {
                studentsRef.orderByChild("username").equalTo(credential)
            }

            query.addListenerForSingleValueEvent(object : com.google.firebase.database.ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    if (snapshot.exists()) {
                        val studentSnapshot = snapshot.children.first()
                        val nisn = studentSnapshot.child("nisn").getValue(String::class.java)
                        val username = studentSnapshot.child("username").getValue(String::class.java)
                        
                        // Use NISN as the stable ID (to match Web Dashboard), fallback to Username, then RTDB Key
                        val key = if (!nisn.isNullOrEmpty()) nisn else if (!username.isNullOrEmpty()) username else studentSnapshot.key

                        val name = (studentSnapshot.child("name").getValue(String::class.java) 
                            ?: studentSnapshot.child("nama").getValue(String::class.java) 
                            ?: studentSnapshot.child("nama_lengkap").getValue(String::class.java)
                            ?: "Siswa").trim()
                        val schoolId = studentSnapshot.child("schoolId").getValue(String::class.java).orEmpty().trim().lowercase()
                        
                        if (key != null) {
                            continuation.resume(StudentIdentity(key, name, schoolId)) { }
                        } else {
                            continuation.resume(null) { }
                        }
                    } else {
                        continuation.resume(null) { }
                    }
                }

                override fun onCancelled(error: DatabaseError) {
                    continuation.resumeWithException(error.toException())
                }
            })
        }
    }

    private suspend fun createPet(studentId: String, studentName: String, schoolId: String) {
        val newPet = VirtualPet(
            studentId = studentId,
            schoolId = schoolId,
            petName = studentName,
            petType = "CAT",
            status = "HAPPY",
            lastFed = System.currentTimeMillis(),
            lastPlayed = System.currentTimeMillis(),
            accessories = null,
            intelligence = 50,
            energy = 80,
            social = 60,
            coins = 100,
            lastQuestReset = System.currentTimeMillis()
        )
        val petId = repository.insertVirtualPet(newPet)

        // Initial Quests
        createDailyQuests(petId)

        // Initial Achievements
        val achievements = listOf(
            PetAchievement(petId = petId, title = "Pemula", description = "Mulai perjalananmu", icon = "star", unlocked = true, unlockedAt = System.currentTimeMillis()),
            PetAchievement(petId = petId, title = "Rajin", description = "Hadir 7 hari berturut-turut", icon = "calendar"),
            PetAchievement(petId = petId, title = "Cerdas", description = "Capai Intelligence 80", icon = "brain"),
            PetAchievement(petId = petId, title = "Sultan", description = "Kumpulkan 1000 Koin", icon = "coin")
        )
        achievements.forEach { repository.insertPetAchievement(it) }
    }
    
    private suspend fun createDailyQuests(petId: String) {
        val quests = listOf(
            PetQuest(petId = petId, title = "Hadir Hari Ini", description = "Masuk sekolah dan tercatat hadir", target = 1, reward = 30),
            PetQuest(petId = petId, title = "Praktik 3 Kebiasaan", description = "Lakukan 3 dari 7 kebiasaan", target = 3, reward = 50),
            PetQuest(petId = petId, title = "Membaca Buku", description = "Baca buku di e-perpus min. 1 jam", target = 1, reward = 40)
        )
        quests.forEach { repository.insertPetQuest(it) }
    }

    private fun checkDailyReset(pet: VirtualPet, quests: List<PetQuest>) {
        val lastReset = pet.lastQuestReset
        val calendar = Calendar.getInstance()
        val currentDay = calendar.get(Calendar.DAY_OF_YEAR)
        
        calendar.timeInMillis = lastReset
        val lastResetDay = calendar.get(Calendar.DAY_OF_YEAR)
        
        if (currentDay != lastResetDay) {
            viewModelScope.launch {
                // Reset quests
                repository.deletePetQuests(pet.id)
                createDailyQuests(pet.id)
                
                // Update pet last reset
                repository.updateVirtualPet(pet.copy(lastQuestReset = System.currentTimeMillis()))
            }
        }
    }

    private fun checkQuestMigration(pet: VirtualPet, quests: List<PetQuest>) {
        val oldQuest = quests.find { it.title == "Belajar Fokus" }
        if (oldQuest != null) {
            viewModelScope.launch {
                // Remove old quest
                repository.deletePetQuest(oldQuest.id)
                
                // Add new quest if not already present
                if (quests.none { it.title == "Membaca Buku" }) {
                    repository.insertPetQuest(
                        PetQuest(
                            petId = pet.id, 
                            title = "Membaca Buku", 
                            description = "Baca buku di e-perpus min. 1 jam", 
                            target = 1, 
                            reward = 40
                        )
                    )
                }
            }
        }
    }

    fun feedPet(pet: VirtualPet) {
        viewModelScope.launch {
             val updatedPet = pet.copy(
                experiencePoints = pet.experiencePoints + 5,
                updatedAt = System.currentTimeMillis()
             )
             val finalPet = checkLevelUp(updatedPet)
             repository.updateVirtualPet(finalPet)
             _uiState.update { it.copy(message = "Lapar berkurang jika rajin membaca di E-Perpus! (+5 XP)") }
        }
    }

    fun playWithPet(pet: VirtualPet) {
        viewModelScope.launch {
             val updatedPet = pet.copy(
                experiencePoints = pet.experiencePoints + 5,
                updatedAt = System.currentTimeMillis()
             )
             val finalPet = checkLevelUp(updatedPet)
             repository.updateVirtualPet(finalPet)
             _uiState.update { it.copy(message = "Energi bertambah jika mengerjakan 7 KAIH! (+5 XP)") }
        }
    }

    fun strokePet(pet: VirtualPet) {
        viewModelScope.launch {
             val updatedPet = pet.copy(
                experiencePoints = pet.experiencePoints + 5,
                updatedAt = System.currentTimeMillis()
             )
             val finalPet = checkLevelUp(updatedPet)
             repository.updateVirtualPet(finalPet)
             _uiState.update { it.copy(message = "Kebahagiaan bertambah jika Hadir Tepat Waktu! (+5 XP)") }
        }
    }

    // Legacy support
    fun studyWithPet(pet: VirtualPet) {
         // No-op or redirect to stroke logic if called
         strokePet(pet)
    }

    fun sleepPet(pet: VirtualPet) {
        viewModelScope.launch {
            val updatedPet = pet.copy(
                experiencePoints = pet.experiencePoints + 5,
                updatedAt = System.currentTimeMillis()
            )
            val finalPet = checkLevelUp(updatedPet)
            repository.updateVirtualPet(finalPet)
            _uiState.update { it.copy(message = "Kesehatan bertambah jika mengerjakan Tugas Literasi! (+5 XP)") }
        }
    }

    fun claimQuest(quest: PetQuest, pet: VirtualPet) {
        viewModelScope.launch {
            if (!quest.isCompleted && quest.progress >= quest.target) {
                val updatedQuest = quest.copy(isCompleted = true)
                repository.updatePetQuest(updatedQuest)
                
                val updatedPet = pet.copy(
                    coins = pet.coins + quest.reward,
                    experiencePoints = pet.experiencePoints + (quest.reward / 2)
                )
                repository.updateVirtualPet(checkLevelUp(updatedPet))
            }
        }
    }
    
    // Debug function to simulate quest progress
    fun progressQuest(quest: PetQuest) {
        viewModelScope.launch {
            if (!quest.isCompleted && quest.progress < quest.target) {
                repository.updatePetQuest(quest.copy(progress = quest.progress + 1))
            }
        }
    }

    private fun checkLevelUp(pet: VirtualPet): VirtualPet {
        val xpThreshold = pet.level * 100
        return if (pet.experiencePoints >= xpThreshold) {
            pet.copy(
                level = pet.level + 1,
                experiencePoints = pet.experiencePoints - xpThreshold,
                happiness = 100,
                intelligence = (pet.intelligence + 2).coerceAtMost(100),
                energy = 100
            )
        } else {
            pet
        }
    }
}

