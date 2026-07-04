package com.satupintu.mobile.utils

import android.content.Context
import com.satupintu.mobile.data.model.User
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase
import com.satupintu.mobile.util.SecurityUtils

class SharedPreferencesManager(private val context: Context) {
    private val prefs = SecurePreferences.getSessionPrefs(context)
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseDatabase.getInstance()

    fun saveUser(user: User) {
        // Implement save logic if needed, currently we mostly read
    }

    // Since retrieving full user object might be async due to Firebase, 
    // for this simple implementation we might just return basic info 
    // or rely on a callback. 
    // However, ProfileScreen expects a synchronous getUser().
    // We can return a basic User object from SharedPreferences if available,
    // or return null and let the UI fetch it.
    
    // For now, let's implement a simple version that reads from SharedPrefs
    // assuming we stored it there on Login (which we haven't fully implemented yet in LoginScreen probably).
    
    // BUT, HomeScreen fetches from Firebase. 
    // To make ProfileScreen work immediately without complex async refactoring:
    // We will return a placeholder or cached data if available.
    
    fun getUser(): User? {
        val loginKey = SecurityUtils.getStoredLoginKey(prefs)
        val studentId = SecurityUtils.getStoredStudentId(prefs)
        val displayName = prefs.getString("user_display_name", "").orEmpty()
        val studentName = prefs.getString("user_student_name", "").orEmpty().ifBlank { displayName }
        val studentClass = prefs.getString("user_student_class", "").orEmpty()
        val role = SecurityUtils.getStoredRole(prefs)
        val schoolName = prefs.getString("user_school_name", "").orEmpty()
        val email = auth.currentUser?.email ?: "-"

        val username = studentId.ifBlank { loginKey }
        val fullName = studentName.ifBlank {
            if (loginKey.isNotBlank()) "Memuat..." else (auth.currentUser?.displayName ?: "Siswa")
        }

        return if (loginKey.isNotBlank() || studentId.isNotBlank()) {
            User(
                fullName = fullName,
                username = username,
                email = email,
                role = role,
                className = studentClass,
                schoolName = schoolName
            )
        } else {
            User(
                fullName = auth.currentUser?.displayName ?: "Siswa",
                username = "-",
                email = email,
                role = role,
                className = studentClass,
                schoolName = schoolName
            )
        }
    }
    
    fun clearSession() {
        prefs.edit().clear().apply()
        auth.signOut()
    }
}

