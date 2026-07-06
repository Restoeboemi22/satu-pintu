plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.sekolah.edulock"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.sekolah.edulock"
        minSdk = 26
        targetSdk = 34
        versionCode = 9
        versionName = "1.1.5"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    flavorDimensions += "mode"
    productFlavors {
        create("student") {
            dimension = "mode"
            resValue("string", "app_name", "EduLock")
        }
        create("admin") {
            dimension = "mode"
            resValue("string", "app_name", "EduLock Admin")
        }
        create("legacyStudent") {
            dimension = "mode"
            minSdk = 23
            versionCode = 6
            versionNameSuffix = "-legacy"
            resValue("string", "app_name", "EduLock")
        }
        create("legacyAdmin") {
            dimension = "mode"
            minSdk = 23
            versionCode = 6
            versionNameSuffix = "-legacy"
            resValue("string", "app_name", "EduLock Admin")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.getByName("debug")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        create("legacyRelease") {
            initWith(getByName("release"))
            isMinifyEnabled = false
            isShrinkResources = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
        // PERBAIKAN: Pastikan dataBinding diset ke false untuk menghentikan error mutasi dependensi
        dataBinding = false
    }

    applicationVariants.all {
        val variant = this
        variant.outputs.all {
            val output = this as? com.android.build.gradle.internal.api.BaseVariantOutputImpl
            output?.outputFileName = "EduLock-${variant.name}.apk"
        }
    }
}

dependencies {
    // AndroidX & UI
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.cardview:cardview:1.0.0")

    // Location & Play Services
    implementation("com.google.android.gms:play-services-location:21.1.0")

    // Lifecycle (Ditingkatkan ke 2.7.0 agar stabil dengan Java 17)
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // WorkManager
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // ZXing Barcode Scanner
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    implementation("com.google.zxing:core:3.5.3") // Update tipis ke 3.5.3

    // Firebase (Pastikan BOM sesuai dengan Google Services Plugin 4.4.2 yang kita pasang tadi)
    implementation(platform("com.google.firebase:firebase-bom:32.7.2"))
    implementation("com.google.firebase:firebase-database-ktx")
    implementation("com.google.firebase:firebase-auth-ktx")

    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}
