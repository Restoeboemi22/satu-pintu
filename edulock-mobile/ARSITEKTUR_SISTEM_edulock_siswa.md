# ARSITEKTUR_SISTEM EduLock (APK Siswa)

Dokumen ini menjelaskan arsitektur teknis EduLock versi siswa (Android) untuk kebutuhan pengembangan dan maintenance.

## 1) Ringkasan Sistem

EduLock siswa adalah aplikasi Android yang:

- Membaca konfigurasi sekolah dari Firebase Realtime Database (RTDB).
- Menentukan kondisi “harus dikunci” berbasis jam sekolah, zona sekolah (geofence), mode sekolah (Mode Acara/Libur, Silent/Proteksi), dan status izin penggunaan HP.
- Menjalankan proteksi berbasis kombinasi:
  - Foreground Service untuk monitoring dan enforcement.
  - Accessibility Service untuk anti-uninstall + whitelist enforcement.
  - Device Admin (bukan Device Owner) untuk hardening (lockNow saat disable admin).
  - LockTask/Screen Pinning (jika diaktifkan user) untuk menahan tombol Home/Recent.
  - Overlay lock (SYSTEM_ALERT_WINDOW) sebagai “lapisan” saat dibutuhkan.

## 2) Komponen Utama

### A. Activities (UI)

- Registrasi siswa: [RegistrationActivity.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/RegistrationActivity.kt)
  - Launcher untuk flavor `student`.
  - Memvalidasi NISN/Nama/Kelas ke RTDB `students/{nisn}`.
  - Mengikat perangkat lewat `students/{nisn}/device_uuid`.
  - Menyimpan `schoolId` untuk mengambil konfigurasi per sekolah.

- Konfigurasi awal (izin wajib): [SetupActivity.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/SetupActivity.kt)
  - Checklist izin: Lokasi, Kamera, Admin Perangkat, Aksesibilitas, Overlay, Battery Optimization.
  - Mengatur `prefs.isSetupCompleted = true` sebelum masuk aplikasi utama.

- Halaman utama + status monitoring: [MainActivity.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/MainActivity.kt)
  - Menampilkan status GPS/zona/internet/jam sekolah.
  - Menampilkan status izin (“Monitoring DI-PAUSE”) + sisa waktu.
  - Jika hari ini libur/tanggal merah: menampilkan “Hari Libur” + keterangan.
  - Tombol:
    - “Minta Izin Penggunaan HP” → membuka pilihan izin (input kode, scan).
    - “Buka Aplikasi Sekolah” → membuka paket yang di-whitelist.

- Input kode izin: [PermissionCodeActivity.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/PermissionCodeActivity.kt)
- Scan barcode/QR izin: [BarcodeScannerActivity.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/BarcodeScannerActivity.kt)
  - Memvalidasi kode izin ke RTDB `active_codes/{CODE}`.
  - Membuat session izin di RTDB `active_sessions/{nisn}` dan `active_sessions_by_school/{schoolId}/{nisn}`.
  - Setelah izin aktif, aplikasi melepas kiosk/lock sehingga siswa bisa keluar sampai sesi berakhir atau dicabut admin.

- Layar kunci: [LockScreenActivity.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/LockScreenActivity.kt)
- Overlay lock activity: [OverlayLockActivity.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/OverlayLockActivity.kt)
  - Dipakai saat perlu menahan interaksi user (contoh: harus aktifkan GPS/Aksesibilitas).

- Password admin/uninstall: [AdminPasswordActivity.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/AdminPasswordActivity.kt)
  - Dipakai untuk verifikasi flow anti-uninstall saat user mencoba menonaktifkan Device Admin dari Settings (bukan dari menu siswa).

### B. Services (Background/Enforcement)

- Monitoring & enforcement service (foreground): [MonitoringService.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/MonitoringService.kt)
  - Interval cek agresif (3 detik).
  - Mengontrol overlay lock, relaunch ke app, dan status monitoring.
  - Listener realtime ke RTDB:
    - `school_config/is_holiday_mode` (Mode Acara/Libur global)
    - `school_config/is_active_protection` (Proteksi sekolah / Silent Mode global)
    - `school_config` (koordinat + radius + fallback start/end)
    - `schools/{schoolId}/schedule/weekdays` (jadwal per hari per sekolah)
    - `schools/{schoolId}/holidays` (hari libur/tanggal merah per sekolah)
    - `students/{nisn}/device_uuid` (binding device)
    - `schools/{schoolId}/uninstallAccess` (kode uninstall sekolah)
  - Saat izin penggunaan HP aktif (`PermissionManager.isPermissionActive()`), enforcement dibypass.

- Setup overlay service: [SetupProtectionService.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/SetupProtectionService.kt)
  - Overlay ringan selama proses konfigurasi awal agar navigasi setup lebih aman.

- Accessibility anti-uninstall + whitelist: [AntiUninstallService.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/AntiUninstallService.kt)
  - Memblok halaman uninstall / device admin apps / package installer tertentu.
  - Whitelist enforcement dibypass saat izin penggunaan HP aktif.

### C. Receivers

- Auto start service saat boot/update: [BootReceiver.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/BootReceiver.kt)
- Restart service saat unlock: [ScreenReceiver.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/ScreenReceiver.kt)
- Restart service saat dibunuh: [ServiceRestarter.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/ServiceRestarter.kt)

### D. Local Storage

- Preferences (state runtime): [PreferencesManager.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/PreferencesManager.kt)
  - Identitas: NISN/nama/kelas, deviceId, schoolId.
  - Konfigurasi: koordinat/radius, flags (holiday mode, protection, uninstall authorized, dll).
  - Jadwal per-hari: `weekdayScheduleJson`.
  - Hari libur/tanggal merah: `holidayListJson`.
  - UI-foreground tracking: `isUiForeground` + `uiForegroundAt` (anti false-positive saat perpindahan activity).

- SQLite untuk log offline: [DatabaseHelper.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/DatabaseHelper.kt)
  - Tabel `students`, `location_logs`, `violations`.

### E. Schedule Engine

- Penentu “jam sekolah / di luar jam”: [SchoolScheduleManager.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/SchoolScheduleManager.kt)
  - Support jadwal per hari (Senin–Minggu) dari `weekdayScheduleJson`.
  - Support hari libur/tanggal merah dari `holidayListJson`.
  - Fallback ke `prefs.schoolStartHour/schoolEndHour` jika jadwal per-hari belum ada.
  - Jika hari ini libur, `isSchoolTime()` selalu false.

## 3) Data Model di Firebase RTDB (ringkas)

RTDB yang dipakai: `https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app`

### A. Data siswa

- `students/{nisn}`
  - `name`, `class`, `schoolId`
  - `device_uuid` (binding 1 akun = 1 perangkat)

### B. Konfigurasi global (berlaku untuk seluruh deployment)

- `school_config`
  - `startTime` / `endTime` (fallback, format string `"HH:mm"`)
  - `latitude`, `longitude`, `radius` (string/number, diparse toleran koma)
  - `is_holiday_mode` (Mode Acara/Libur)
  - `is_active_protection` (Proteksi sekolah / Silent Mode)

### C. Konfigurasi per sekolah (baru)

- `schools/{schoolId}/schedule/weekdays/{mon|tue|wed|thu|fri|sat|sun}`
  - `enabled` (boolean)
  - `start` (string `"HH:mm"`)
  - `end` (string `"HH:mm"`)
- `schools/{schoolId}/holidays/{yyyy-mm-dd}`
  - `date` (string, sama dengan key)
  - `note` (string keterangan)
  - `createdAt`, `updatedAt` (timestamp ms)

### D. Izin penggunaan HP (permission session)

- `active_codes/{CODE}`
  - `expiresAt` (timestamp ms)
  - `duration` (menit)
- `active_sessions/{nisn}`
- `active_sessions_by_school/{schoolId}/{nisn}`

### E. Uninstall authorization

- `schools/{schoolId}/uninstallAccess`
  - `code` (string)
  - `expiresAt` (timestamp ms)
  - Catatan: selain kode sekolah, jalur uninstall juga bisa diaktifkan per-siswa via remote authorization, yang menyebabkan Device Admin dilepas otomatis dan siswa bisa uninstall tanpa input kode.

### F. Policy (per sekolah)

- `schools/{schoolId}/policy/gps_off_warn_ms`
- `schools/{schoolId}/policy/gps_off_lock_ms`
  - Dipakai untuk menentukan warning/lockdown saat GPS dimatikan pada jam sekolah (di zona sekolah).

## 4) Status/State Machine (ringkas)

Keputusan “kunci/bebas” berbasis kombinasi status berikut:

- `isSetupCompleted` (setup awal selesai)
- `isProtectionActive` (Proteksi sekolah ON/OFF)
- `isHolidayMode` (Mode Acara/Libur ON/OFF)
- `PermissionManager.isPermissionActive()` (izin penggunaan HP aktif)
- `SchoolScheduleManager.isSchoolTime()` (jam sekolah per hari + hari libur)
- `isInsideSchoolZone` (geofence berdasarkan koordinat + radius)
- `isSettingsOpen/settingsGraceUntil` (grace period saat konfigurasi)
- `isUninstallAuthorized` (izin uninstall aktif sementara)

Aturan ringkas:

- Jika `isHolidayMode == true` → mode bebas (enforcement dibypass).
- Jika `isProtectionActive == false` → silent (enforcement dibypass).
- Jika `isPermissionActive == true` → enforcement dibypass, kiosk/lock dilepas sampai sesi berakhir/cabut.
- Jika proteksi aktif + bukan holiday + bukan izin + (jam sekolah atau di zona) → enforce (kiosk/lockscreen/overlay).
- Jika jam sekolah + (di zona sekolah) dan GPS mati → warning/lockdown mengikuti policy `gps_off_*` per sekolah.

## 5) Mekanisme Proteksi (tanpa Device Owner)

Karena mayoritas perangkat siswa bukan Device Owner (tidak factory reset), proteksi mengandalkan kombinasi berikut:

- LockTask/Screen Pinning (opsional, user harus mengaktifkan di OS).
- MonitoringService:
  - Deteksi app “kabur” dan pull-back (relaunch) saat enforcement aktif.
  - Grace period UI-foreground untuk menghindari false-positive saat perpindahan antar activity internal.
  - Overlay lock untuk mencegah interaksi di luar konteks.
- AntiUninstallService:
  - Blocking uninstall path + whitelist enforcement (kecuali saat izin penggunaan HP aktif).
- DeviceAdminReceiver:
  - Hardening device admin + `lockNow()` pada kondisi tertentu.

## 6) Alur Operasional Utama

### A. Registrasi & Setup

1. User membuka EduLock → [RegistrationActivity.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/RegistrationActivity.kt)
2. Validasi ke RTDB `students/{nisn}` (nama & kelas harus match).
3. Binding device lewat `device_uuid`.
4. Setup izin → [SetupActivity.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/SetupActivity.kt)
5. Masuk UI utama → [MainActivity.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/MainActivity.kt)

### B. Monitoring & Reporting

- MonitoringService menjalankan:
  - cek lokasi/zona (LocationMonitor)
  - cek internet (OfflineMonitor)
  - kirim status ke dashboard (FirebaseReporter)
- Reporter: [FirebaseReporter.kt](file:///c:/Unified-System/apps/EduLock/app/src/main/java/com/sekolah/edulock/FirebaseReporter.kt)

### C. Mode Acara/Libur

- Toggle ON (global): `school_config/is_holiday_mode = true` → enforcement dibypass.
- Toggle OFF → enforcement kembali aktif dengan staged re-lock.

### D. Izin Penggunaan HP

- Input kode / scan QR.
- Session dicatat di RTDB `active_sessions/**`.
- Enforcement dibypass sampai:
  - `endTime` lewat (durasi habis), atau
  - admin mencabut sesi (hapus node `active_sessions/{nisn}`).

### E. Hari Libur / Tanggal Merah (per sekolah)

- Admin menambah libur di web → `schools/{schoolId}/holidays/{yyyy-mm-dd}`.
- Aplikasi siswa:
  - menampilkan “Hari Libur” di UI,
  - memperlakukan hari tersebut sebagai non-efektif (`isSchoolTime()` false).

## 7) Build & Flavor

- Flavors ada di [build.gradle.kts](file:///c:/Unified-System/apps/EduLock/app/build.gradle.kts):
  - `student`: EduLock siswa (dokumen ini).
  - `admin`: EduLock Admin (wrapper WebView), lihat dokumen admin terpisah.

## 8) Batasan (penting untuk ekspektasi)

- Tanpa Device Owner, Android tidak menjamin blocking Home/Recent 100% tanpa UI sistem (mis. “Aplikasi disematkan” saat screen pinning).
- Karena itu strategi EduLock siswa mengutamakan “prevent + detect + pull back” (relaunch/overlay) ketimbang mematikan tombol sistem sepenuhnya.
