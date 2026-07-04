package com.satupintu.mobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.satupintu.mobile.data.model.HabitLog
import com.satupintu.mobile.data.repository.SevenHabitsRepository
import com.satupintu.mobile.data.repository.VirtualPetRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

data class SevenHabitsState(
    val isLoading: Boolean = true,
    val logs: Map<String, HabitLog> = emptyMap(),
    val selectedYear: Int = Calendar.getInstance().get(Calendar.YEAR),
    val selectedMonth: Int = Calendar.getInstance().get(Calendar.MONTH) + 1, // 1-12
    val selectedWeek: Int = (Calendar.getInstance().get(Calendar.DAY_OF_MONTH) - 1) / 7 + 1, // 1-5
    val error: String? = null
)

class SevenHabitsViewModel : ViewModel() {
    private val repository = SevenHabitsRepository()
    private val petRepository = VirtualPetRepository()
    private val _uiState = MutableStateFlow(SevenHabitsState())
    val uiState: StateFlow<SevenHabitsState> = _uiState.asStateFlow()

    private var currentStudentId: String = ""

    fun loadData(studentId: String) {
        currentStudentId = studentId
        viewModelScope.launch {
            repository.getStudentLogs(studentId).collect { logs ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    logs = logs
                )
            }
        }
    }

    fun setYear(year: Int) {
        _uiState.value = _uiState.value.copy(selectedYear = year)
    }

    fun setMonth(month: Int) {
        _uiState.value = _uiState.value.copy(selectedMonth = month)
    }

    fun setWeek(week: Int) {
        _uiState.value = _uiState.value.copy(selectedWeek = week)
    }

    fun toggleHabit(date: String, habitKey: String, isChecked: Boolean) {
        val currentLogs = _uiState.value.logs.toMutableMap()
        val existingLog = currentLogs[date] ?: HabitLog(
            id = UUID.randomUUID().toString(),
            studentId = currentStudentId,
            date = date
        )

        val updatedHabits = existingLog.habits.toMutableMap()
        val wasChecked = updatedHabits[habitKey] ?: false
        updatedHabits[habitKey] = isChecked

        val updatedLog = existingLog.copy(
            habits = updatedHabits,
            timestamp = System.currentTimeMillis()
        )

        // Optimistic update
        currentLogs[date] = updatedLog
        _uiState.value = _uiState.value.copy(logs = currentLogs)

        repository.saveLog(updatedLog) { success ->
            if (success) {
                if (isChecked && !wasChecked) {
                    applyPetReward(habitKey)
                }
            }
        }
    }

    private fun applyPetReward(habitKey: String) {
        viewModelScope.launch {
            try {
                val pet = petRepository.getVirtualPetByStudentId(currentStudentId).first()
                if (pet != null) {
                    var updatedPet = pet
                    var hasUpdate = false
                    
                    when (habitKey) {
                        "habit3" -> { // Olahraga
                            updatedPet = updatedPet.copy(health = (pet.health + 5).coerceAtMost(100))
                            hasUpdate = true
                        }
                        "habit4" -> { // Makan Sehat
                            updatedPet = updatedPet.copy(health = (pet.health + 5).coerceAtMost(100))
                            hasUpdate = true
                        }
                        "habit5" -> { // Gemar Belajar
                            updatedPet = updatedPet.copy(intelligence = (pet.intelligence + 5).coerceAtMost(100))
                            hasUpdate = true
                        }
                        "habit6" -> { // Bermasyarakat
                            updatedPet = updatedPet.copy(social = (pet.social + 5).coerceAtMost(100))
                            hasUpdate = true
                        }
                        "habit7" -> { // Tidur Lebih Awal
                            updatedPet = updatedPet.copy(
                                health = (pet.health + 5).coerceAtMost(100),
                                energy = (pet.energy + 10).coerceAtMost(100)
                            )
                            hasUpdate = true
                        }
                    }
                    
                    if (hasUpdate) {
                        petRepository.updateVirtualPet(updatedPet)
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun saveWeeklyLogs(weekDates: List<String>, onResult: (Boolean) -> Unit) {
        viewModelScope.launch {
            var allSuccess = true
            val logsToSave = _uiState.value.logs.filterKeys { it in weekDates }
            
            if (logsToSave.isEmpty()) {
                onResult(true) // Nothing to save is technically a success
                return@launch
            }

            var savedCount = 0
            logsToSave.values.forEach { log ->
                repository.saveLog(log) { success ->
                    if (!success) allSuccess = false
                    savedCount++
                    if (savedCount == logsToSave.size) {
                        onResult(allSuccess)
                    }
                }
            }
        }
    }
}

