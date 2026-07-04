package com.satupintu.mobile.data.repository

import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.satupintu.mobile.data.model.Book
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class LibraryRepository {
    private val db: FirebaseFirestore
    private val auth: FirebaseAuth

    init {
        // Connect to 'eperpus-sekolah' project where books are stored
        val appName = "eperpus_library"
        val app = try {
            FirebaseApp.getInstance(appName)
        } catch (e: IllegalStateException) {
            // App not initialized, initialize it
            val options = FirebaseOptions.Builder()
                .setApiKey("AIzaSyBvmr1cu8-WnGNiD5M_cla6lxr88QEYu28")
                .setProjectId("eperpus-sekolah")
                .setStorageBucket("eperpus-sekolah.firebasestorage.app")
                .setApplicationId("1:303647816343:web:78ad36d2d1be25930547d2") // Using Web App ID
                .build()
            
            // Use the context from the default app
            val context = FirebaseApp.getInstance().applicationContext
            FirebaseApp.initializeApp(context, options, appName)
        }

        db = FirebaseFirestore.getInstance(app)
        auth = FirebaseAuth.getInstance(app)
    }

    private val booksCollection = db.collection("books")

    fun getBooks(): Flow<List<Book>> = callbackFlow {
        // Ensure user is authenticated (anonymously) for Firestore access in the secondary app
        if (auth.currentUser == null) {
            try {
                auth.signInAnonymously().await()
            } catch (e: Exception) {
                println("Auth failed for library app: ${e.message}, proceeding anyway")
            }
        }


        // We fetch all books and sort client-side to avoid index requirement issues for now
        val listener = booksCollection
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val books = snapshot.documents.mapNotNull { doc ->
                        try {
                            doc.toObject(Book::class.java)
                        } catch (e: Exception) {
                            e.printStackTrace()
                            null
                        }
                    }
                    // Sort by displayTitle
                    val sortedBooks = books.sortedBy { it.displayTitle.lowercase() }
                    trySend(sortedBooks)
                }
            }

        awaitClose { listener.remove() }
    }
}

