// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    // Menggunakan versi 8.2.2 agar sesuai dengan Android Studio terbaru
    id("com.android.application") version "8.2.2" apply false

    // Menggunakan Kotlin versi 1.9.22
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false

    // INI KUNCINYA: Kita set versi Google Services ke 4.4.2 di sini
    // Versi ini memperbaiki error "Cannot mutate dependencies"
    id("com.google.gms.google-services") version "4.4.2" apply false
}

tasks.register("clean", Delete::class) {
    delete(rootProject.layout.buildDirectory)
}