# ARSITEKTUR_SISTEM EduLock (APK Admin)

Dokumen ini menjelaskan arsitektur teknis EduLock versi admin (Android) untuk kebutuhan pengembangan dan maintenance.

## 1) Ringkasan Sistem

EduLock Admin adalah APK Android flavor `admin` yang fungsinya utama sebagai:

- Wrapper WebView menuju Dashboard Admin EduLock (web).
- Menyediakan “portal” yang lebih mudah diakses di perangkat guru/admin tanpa perlu browser manual.

APK admin tidak menjalankan mesin proteksi (kiosk/enforcement) seperti APK siswa; proteksi dan monitoring berada di APK siswa dan Dashboard web.

## 2) Struktur Build (Flavor)

Flavors ditentukan di: [build.gradle.kts](file:///c:/Unified-System/apps/EduLock/app/build.gradle.kts)

- `student`: aplikasi siswa (enforcement + monitoring).
- `admin`: aplikasi admin (WebView).

Perilaku launcher dibedakan lewat pengecekan `BuildConfig.FLAVOR` di:
- [RegistrationActivity.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/RegistrationActivity.kt)
  - Jika flavor `admin` → langsung membuka `AdminWebActivity` lalu `finish()`.

## 3) Komponen Utama

### A. Activity

- WebView shell: [AdminWebActivity.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/AdminWebActivity.kt)
  - Membuat `WebView` full-screen.
  - Mengaktifkan:
    - JavaScript
    - DOM storage
    - Cookie (termasuk third-party cookies)
  - Memuat URL dashboard dari konstanta:
    - `ADMIN_URL` (hardcoded di file tersebut), saat ini: `https://edulock-4b7fc.web.app/admin`.
  - Proteksi navigasi:
    - URL dengan host yang tidak ada di allowlist akan dibuka via browser eksternal (Intent.ACTION_VIEW).
  - Catatan: APK admin ini fokus ke dashboard Admin Sekolah. Halaman Super Admin berjalan di web terpisah.

## 4) Integrasi & Dependensi

- Dashboard Web (Next.js) menjalankan autentikasi & operasi RTDB.
- APK admin hanya “render” web dan mengikuti mekanisme login web.

## 5) Catatan Operasional

- Jika URL dashboard berubah (mis. dari `/admin` ke `/edulock/admin`), pembaruan dilakukan dengan mengubah `ADMIN_URL` di [AdminWebActivity.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/AdminWebActivity.kt) lalu rebuild flavor `admin`.

## 6) Output Build

- APK admin release: `app/build/outputs/apk/admin/release/EduLock-adminRelease.apk`
