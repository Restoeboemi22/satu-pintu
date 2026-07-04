package com.satupintu.mobile.data.service

import android.content.Context
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.satupintu.mobile.utils.NotificationHelper

class TeacherNotificationListener(private val context: Context) {

    private val notificationHelper = NotificationHelper(context)
    private var isFirstLoadLiteracy = true
    private var isFirstLoadBullying = true
    private var isFirstLoadAnnouncement = true
    
    // Track known IDs to avoid spamming on restart (simplified approach)
    // Ideally this should be persisted, but for this session memory is okay
    private val knownLiteracyIds = mutableSetOf<String>()
    private val knownBullyingIds = mutableSetOf<String>()
    private var lastAnnouncementId: String? = null
    
    // Listeners references for cleanup
    private var literacyListener: ValueEventListener? = null
    private var bullyingListener: ValueEventListener? = null
    private var teacherAnnouncementListener: ValueEventListener? = null
    private var studentAnnouncementListener: ValueEventListener? = null
    private var studentPetListener: ValueEventListener? = null
    
    private val db = FirebaseDatabase.getInstance()
    
    // State tracking for Pet
    private var lastPetState: String = "HEALTHY" // HEALTHY, SICK, DEAD

    fun startListening(userRole: String, userCredential: String = "", schoolId: String = "") {
        // Stop any existing listeners first to avoid duplicates or wrong role data
        stopListening()
        
        if (userRole == "Guru") {
            listenForTeacherSpecifics(schoolId)
            listenForTeacherAnnouncements()
        } else if (userRole == "Siswa") {
            listenForStudentAnnouncements()
            if (userCredential.isNotEmpty()) {
                listenForStudentPet(userCredential)
            }
        }
    }
    
    fun stopListening() {
        literacyListener?.let { db.getReference("literacy_logs").removeEventListener(it) }
        bullyingListener?.let { db.getReference("bullying_reports").removeEventListener(it) }
        teacherAnnouncementListener?.let { db.getReference("system_announcements/teacher").removeEventListener(it) }
        studentAnnouncementListener?.let { db.getReference("system_announcements/student").removeEventListener(it) }
        
        // Remove Pet Listener
        if (studentPetListener != null && activePetRef != null) {
            activePetRef?.removeEventListener(studentPetListener!!)
        }
        
        literacyListener = null
        bullyingListener = null
        teacherAnnouncementListener = null
        studentAnnouncementListener = null
        studentPetListener = null
        activePetRef = null
    }
    
    // Helper to remove pet listener properly
    private var activePetRef: com.google.firebase.database.DatabaseReference? = null
    
    private fun listenForStudentPet(nisn: String) {
        // 1. Find Student ID from NISN
        val studentsRef = db.getReference("students")
        studentsRef.orderByChild("nisn").equalTo(nisn).addListenerForSingleValueEvent(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                if (snapshot.exists()) {
                    val studentNode = snapshot.children.first()
                    val studentId = studentNode.key ?: return
                    
                    // 2. Listen to Virtual Pet
                    val petRef = db.getReference("virtual_pets").child(studentId)
                    activePetRef = petRef
                    
                    val pListener = object : ValueEventListener {
                        override fun onDataChange(petSnapshot: DataSnapshot) {
                            if (!petSnapshot.exists()) return
                            
                            val status = petSnapshot.child("status").getValue(String::class.java) ?: "HAPPY"
                            val health = petSnapshot.child("health").getValue(Int::class.java) ?: 100
                            val happiness = petSnapshot.child("happiness").getValue(Int::class.java) ?: 100
                            
                            // Determine State
                            val isDead = status == "DEAD" || health <= 0
                            val isSick = !isDead && (health < 30 || happiness < 30)
                            
                            val currentState = when {
                                isDead -> "DEAD"
                                isSick -> "SICK"
                                else -> "HEALTHY"
                            }
                            
                            // Notify on state change or if critical state persists (with some throttling in real app, but here simple)
                            // We only notify if state CHANGES to SICK or DEAD, or if it IS SICK/DEAD and this is the first check?
                            // Let's notify on transition.
                            
                            if (currentState != lastPetState) {
                                if (currentState == "DEAD") {
                                    notificationHelper.showNotification(
                                        "ðŸš¨ Pet Anda MATI!",
                                        "Sayang sekali, Pet Anda telah mati. Hubungi Admin untuk pemulihan."
                                    )
                                } else if (currentState == "SICK") {
                                    notificationHelper.showNotification(
                                        "âš ï¸ Pet Anda SAKIT!",
                                        "Kesehatan Pet menurun drastis. Segera cek dan rawat Pet Anda!"
                                    )
                                }
                                lastPetState = currentState
                            }
                        }
                        override fun onCancelled(error: DatabaseError) {}
                    }
                    
                    petRef.addValueEventListener(pListener)
                    studentPetListener = pListener
                }
            }
            override fun onCancelled(error: DatabaseError) {}
        })
    }
    
    private fun listenForTeacherSpecifics(schoolId: String) {
        val normalizedSchoolId = normalizeSchoolScope(schoolId)

        // Listen for Literacy Logs
        val lListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                var newItemsCount = 0
                
                for (child in snapshot.children) {
                    val id = child.key ?: continue
                    val logSchoolId = normalizeSchoolScope(child.child("schoolId").getValue(String::class.java))
                    if (normalizedSchoolId.isNotEmpty() && logSchoolId.isNotEmpty() && logSchoolId != normalizedSchoolId) {
                        continue
                    }
                    val status = child.child("status").getValue(String::class.java)
                    
                    if (status == "pending") {
                        if (!knownLiteracyIds.contains(id)) {
                            knownLiteracyIds.add(id)
                            if (!isFirstLoadLiteracy) {
                                newItemsCount++
                            }
                        }
                    }
                }

                if (newItemsCount > 0) {
                    notificationHelper.showNotification(
                        "Tugas Literasi Baru",
                        "Ada $newItemsCount tugas literasi baru yang perlu dinilai."
                    )
                }
                isFirstLoadLiteracy = false
            }

            override fun onCancelled(error: DatabaseError) {}
        }
        db.getReference("literacy_logs").addValueEventListener(lListener)
        literacyListener = lListener

        // Listen for Bullying Reports
        val bListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                var newItemsCount = 0
                
                for (child in snapshot.children) {
                    val id = child.key ?: continue
                    val logSchoolId = normalizeSchoolScope(child.child("schoolId").getValue(String::class.java))
                    if (normalizedSchoolId.isNotEmpty() && logSchoolId.isNotEmpty() && logSchoolId != normalizedSchoolId) {
                        continue
                    }
                    val status = child.child("status").getValue(String::class.java)
                    
                    if (status == "Unhandled" || status == "Belum Ditangani") { // Handle both just in case
                        if (!knownBullyingIds.contains(id)) {
                            knownBullyingIds.add(id)
                            if (!isFirstLoadBullying) {
                                newItemsCount++
                            }
                        }
                    }
                }

                if (newItemsCount > 0) {
                    notificationHelper.showNotification(
                        "Laporan Bullying Baru",
                        "Ada $newItemsCount laporan bullying baru yang masuk."
                    )
                }
                isFirstLoadBullying = false
            }

            override fun onCancelled(error: DatabaseError) {}
        }
        db.getReference("bullying_reports").addValueEventListener(bListener)
        bullyingListener = bListener
    }
    
    private fun listenForTeacherAnnouncements() {
        val tListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                if (!snapshot.exists()) return
                
                // Get latest announcement
                val lastChild = snapshot.children.lastOrNull()
                val id = lastChild?.key ?: return
                val content = lastChild.child("content").value?.toString() ?: "Pengumuman Baru"
                
                if (lastAnnouncementId != null && lastAnnouncementId != id) {
                     notificationHelper.showNotification(
                        "Pengumuman Guru",
                        content
                    )
                }
                lastAnnouncementId = id
            }
             override fun onCancelled(error: DatabaseError) {}
        }
        db.getReference("system_announcements/teacher").limitToLast(1).addValueEventListener(tListener)
        teacherAnnouncementListener = tListener
    }

    private fun listenForStudentAnnouncements() {
        val sListener = object : ValueEventListener {
             override fun onDataChange(snapshot: DataSnapshot) {
                if (!snapshot.exists()) return
                
                // Get latest announcement
                val lastChild = snapshot.children.lastOrNull()
                val id = lastChild?.key ?: return
                val content = lastChild.child("content").value?.toString() ?: "Pengumuman Baru"
                
                if (lastAnnouncementId != null && lastAnnouncementId != id) {
                     notificationHelper.showNotification(
                        "Pengumuman Siswa",
                        content
                    )
                }
                lastAnnouncementId = id
            }
             override fun onCancelled(error: DatabaseError) {}
        }
        db.getReference("system_announcements/student").limitToLast(1).addValueEventListener(sListener)
        studentAnnouncementListener = sListener
    }

    private fun normalizeSchoolScope(value: String?): String {
        return value?.trim()?.lowercase().orEmpty()
    }
}

