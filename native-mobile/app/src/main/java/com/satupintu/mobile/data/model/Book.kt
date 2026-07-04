package com.satupintu.mobile.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName

@IgnoreExtraProperties
data class Book(
    @DocumentId
    val id: String = "",
    
    val title: String? = null,
    val judul: String? = null,
    
    val author: String? = null,
    val penulis: String? = null,
    
    val category: String? = null,
    val kategori: String? = null,
    val mainCategory: String? = null, // Added field to match web dashboard
    
    val coverUrl: String? = null,
    val pdfUrl: String? = null,
    val stock: Int = 0,
    val description: String? = null
) {
    val displayTitle: String
        get() = title ?: judul ?: "Tanpa Judul"
        
    val displayAuthor: String
        get() = author ?: penulis ?: "-"
        
    val displayCategory: String
        get() = mainCategory ?: category ?: kategori ?: "Umum"
}

