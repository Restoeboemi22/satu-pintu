import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.google.services)
}

val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
}
val mobileBoundary = providers.gradleProperty("satupintu.mobileBoundary").orElse("gas").get()
val allowedFirebaseProjectIds = providers.gradleProperty("satupintu.allowedFirebaseProjectIds").orElse("").get()

android {
    namespace = "com.satupintu.mobile"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.satupintu.mobile"
        minSdk = 26
        targetSdk = 35
        versionCode = 1006
        versionName = "1.0.5"
        buildConfigField("String", "MOBILE_BOUNDARY", "\"${mobileBoundary}\"")
        buildConfigField("String", "ALLOWED_FIREBASE_PROJECT_IDS", "\"${allowedFirebaseProjectIds}\"")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    flavorDimensions += "audience"
    productFlavors {
        create("siswa") {
            dimension = "audience"
            resValue("string", "app_name", "GAS Siswa")
            versionNameSuffix = "-siswa"
        }
        create("guru") {
            dimension = "audience"
            resValue("string", "app_name", "GAS Guru")
            versionNameSuffix = "-guru"
        }
        create("kepala") {
            dimension = "audience"
            resValue("string", "app_name", "GAS Kepala Sekolah")
            versionNameSuffix = "-kepala"
        }

        create("legacySiswa") {
            dimension = "audience"
            minSdk = 23
            versionCode = 3
            resValue("string", "app_name", "GAS Siswa")
            versionNameSuffix = "-siswa-legacy"
        }
        create("legacyGuru") {
            dimension = "audience"
            minSdk = 23
            versionCode = 3
            resValue("string", "app_name", "GAS Guru")
            versionNameSuffix = "-guru-legacy"
        }
        create("legacyKepala") {
            dimension = "audience"
            minSdk = 23
            versionCode = 3
            resValue("string", "app_name", "GAS Kepala Sekolah")
            versionNameSuffix = "-kepala-legacy"
        }
    }

    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                storeFile = rootProject.file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
            }
        }
    }
    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        create("legacyRelease") {
            initWith(getByName("release"))
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    
    // Navigation & Icons
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.material.icons.extended)
    
    // Firebase
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)
    implementation(libs.firebase.database)
    implementation(libs.firebase.firestore)
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    
    // Location
    implementation(libs.play.services.location)
    implementation("org.osmdroid:osmdroid-android:6.1.18")
    
    // Image Loading
    implementation(libs.coil.compose)

    // Lottie Animation
    implementation("com.airbnb.android:lottie-compose:6.4.0")

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.ui.test.junit4)
    debugImplementation(libs.androidx.ui.tooling)
    debugImplementation(libs.androidx.ui.test.manifest)
}
