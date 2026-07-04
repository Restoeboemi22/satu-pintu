package com.satupintu.mobile.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.satupintu.mobile.data.repository.BullyingRepository
import com.satupintu.mobile.data.repository.StudentRepository
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

enum class StudentNotificationType {
    ANNOUNCEMENT,
    REPORT_UPDATE
}

data class StudentNotificationItem(
    val id: String,
    val title: String,
    val message: String,
    val date: Long,
    val type: StudentNotificationType,
    val relatedId: String? = null
)

class StudentNotificationViewModel : ViewModel() {
    private val db = FirebaseDatabase.getInstance().reference
    private val bullyingRepository = BullyingRepository()
    private val studentRepository = StudentRepository()

    private val _notifications = MutableStateFlow<List<StudentNotificationItem>>(emptyList())
    val notifications: StateFlow<List<StudentNotificationItem>> = _notifications

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    fun loadNotifications(
        studentCredential: String,
        studentId: String,
        studentClass: String,
        schoolId: String
    ) {
        _isLoading.value = true
        viewModelScope.launch {
            try {
                val students = try {
                    studentRepository.getStudents(schoolId).first()
                } catch (e: Exception) {
                    emptyList()
                }

                val identityCandidates = linkedSetOf(
                    normalizeIdentity(studentCredential),
                    normalizeIdentity(studentId)
                ).filter { it.isNotBlank() }.toMutableSet()

                val resolvedStudent = students.firstOrNull { student ->
                    identityCandidates.contains(normalizeIdentity(student.id)) ||
                        identityCandidates.contains(normalizeIdentity(student.nisn))
                }

                resolvedStudent?.let { student ->
                    identityCandidates += normalizeIdentity(student.id)
                    identityCandidates += normalizeIdentity(student.nisn)
                }

                val resolvedClass = studentClass.ifBlank { resolvedStudent?.className.orEmpty() }
                val resolvedSchoolId = schoolId.ifBlank { resolvedStudent?.schoolId.orEmpty() }

                // 2. Define Flows
                val announcementsFlow = getAnnouncementsFlow(
                    studentIdentityCandidates = identityCandidates,
                    studentClass = resolvedClass,
                    schoolId = resolvedSchoolId
                )
                val reportsFlow = bullyingRepository.getAllReports(resolvedSchoolId).map { reports ->
                    reports
                        .filter { report ->
                            identityCandidates.contains(normalizeIdentity(report.reporterId))
                        }
                        .sortedByDescending { it.createdAt }
                }

                // 3. Combine Flows
                combine(announcementsFlow, reportsFlow) { announcements, reports ->
                    val reportNotifs = reports.filter { it.status != "PENDING" }.map { report ->
                        val statusText = when(report.status) {
                            "INVESTIGATING" -> "sedang diproses"
                            "RESOLVED" -> "telah ditindaklanjuti"
                            "CLOSED" -> "telah selesai"
                            else -> "diupdate"
                        }
                        
                        // Use updatedAt as the notification date
                        val date = report.updatedAt.takeIf { it > 0 } ?: report.createdAt

                        StudentNotificationItem(
                            id = "notif_${report.id}",
                            title = "Status Laporan",
                            message = "Laporan ${if(report.category == "INCIDENT") "Peristiwa" else "Bullying"} Anda sekarang statusnya: ${statusText}.",
                            date = date,
                            type = StudentNotificationType.REPORT_UPDATE,
                            relatedId = report.id
                        )
                    }
                    
                    (announcements + reportNotifs).sortedByDescending { it.date }
                }.collect { combinedList ->
                    _notifications.value = combinedList
                    _isLoading.value = false
                }

            } catch (e: Exception) {
                _isLoading.value = false
            }
        }
    }

    private fun getAnnouncementsFlow(
        studentIdentityCandidates: Set<String>,
        studentClass: String,
        schoolId: String
    ): Flow<List<StudentNotificationItem>> = callbackFlow {
        val ref = db.child("system_announcements").child("student")
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val list = mutableListOf<StudentNotificationItem>()
                val normalizedClass = normalizeIdentity(studentClass)
                val normalizedSchoolId = normalizeScope(schoolId)
                for (child in snapshot.children) {
                    // If the node is a direct value (string), handle it (legacy)
                    // If it's an object {title, content, date}, handle it
                    val value = child.getValue()
                    
                    if (value is String) {
                        if (normalizedSchoolId.isNotBlank()) {
                            continue
                        }
                        // Legacy: single announcement string
                        list.add(StudentNotificationItem(
                            id = child.key ?: "",
                            title = "Pengumuman",
                            message = value,
                            date = System.currentTimeMillis(), // No date in legacy
                            type = StudentNotificationType.ANNOUNCEMENT
                        ))
                    } else {
                        // Object structure
                        val title = child.child("title").getValue(String::class.java) ?: "Pengumuman"
                        val content = child.child("content").getValue(String::class.java) ?: ""
                        val date = child.child("date").getValue(Long::class.java) ?: System.currentTimeMillis()
                        val targetType = child.child("targetType").getValue(String::class.java)?.trim().orEmpty()
                        val targetValue = child.child("targetValue").getValue(String::class.java)?.trim().orEmpty()
                        val itemSchoolId = normalizeScope(child.child("schoolId").getValue(String::class.java))

                        val matchesSchool = if (normalizedSchoolId.isBlank()) {
                            true
                        } else {
                            itemSchoolId == normalizedSchoolId
                        }
                        val matchesTarget = when (targetType) {
                            "", "STUDENTS", "ALL_CLASSES" -> true
                            "CLASS" -> normalizeIdentity(targetValue) == normalizedClass
                            "SPECIFIC_STUDENT" -> studentIdentityCandidates.contains(normalizeIdentity(targetValue))
                            else -> false
                        }
                        
                        // Filter out empty content
                        if (content.isNotEmpty() && matchesSchool && matchesTarget) {
                            list.add(StudentNotificationItem(
                                id = child.key ?: "",
                                title = title,
                                message = content,
                                date = date,
                                type = StudentNotificationType.ANNOUNCEMENT
                            ))
                        }
                    }
                }
                
                // If list is empty but parent value is a string (legacy single announcement)
                if (list.isEmpty() && snapshot.value is String) {
                     if (normalizedSchoolId.isNotBlank()) {
                         trySend(list)
                         return
                     }
                     val content = snapshot.getValue(String::class.java) ?: ""
                     if (content.isNotEmpty()) {
                         list.add(StudentNotificationItem(
                            id = "legacy_announcement",
                            title = "Pengumuman Sekolah",
                            message = content,
                            date = System.currentTimeMillis(),
                            type = StudentNotificationType.ANNOUNCEMENT
                        ))
                     }
                }

                trySend(list)
            }
            override fun onCancelled(error: DatabaseError) {
                close(error.toException())
            }
        }
        ref.addValueEventListener(listener)
        awaitClose { ref.removeEventListener(listener) }
    }

    private fun normalizeIdentity(value: String?): String {
        return value?.trim().orEmpty()
    }

    private fun normalizeScope(value: String?): String {
        return value?.trim()?.lowercase().orEmpty()
    }
}

