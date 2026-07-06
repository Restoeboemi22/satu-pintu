# ARSITEKTUR_SISTEM EduLock (Dashboard Admin Sekolah)

Dokumen ini menjelaskan arsitektur teknis Dashboard EduLock untuk peran Admin Sekolah (web) yang digunakan untuk operasional (siswa, monitoring, izin, konfigurasi).

## 1) Ringkasan Sistem

Dashboard EduLock (Admin Sekolah) adalah modul web yang:

- Menyediakan UI operasional untuk admin sekolah (CRUD siswa, monitoring realtime, manajemen kode izin, cabut izin, konfigurasi sekolah).
- Menggunakan Firebase Authentication untuk login.
- Menggunakan Firebase Realtime Database (RTDB) sebagai sumber data realtime untuk siswa/sesi izin/status perangkat.

## 2) Struktur Aplikasi Web

Codebase web berada di:
- `c:\Unified-System\apps\web`

Halaman utama Admin Sekolah EduLock:
- [page.tsx](file:///c:/Unified-System/apps/web/src/app/edulock/admin/page.tsx)

Gate/role routing untuk modul EduLock:
- [layout.tsx](file:///c:/Unified-System/apps/web/src/app/edulock/layout.tsx)
- [page.tsx](file:///c:/Unified-System/apps/web/src/app/edulock/page.tsx)

Login EduLock:
- [page.tsx](file:///c:/Unified-System/apps/web/src/app/edulock/login/page.tsx)

## 3) Firebase Layer

Inisialisasi Firebase (khusus EduLock):
- [edulockFirebase.ts](file:///c:/Unified-System/apps/web/src/lib/edulockFirebase.ts)
  - `edulockDb`: RTDB instance (region asia-southeast1).
  - `edulockAuth`: Auth instance + persistence local.

Hook auth + profile EduLock:
- [useEduLockAuth.ts](file:///c:/Unified-System/apps/web/src/lib/useEduLockAuth.ts)
  - Membaca `admin_profiles/{uid}` untuk role + `schoolId`.
  - Menyediakan `edulockUser`, `profile`, `role`, dan fungsi `logout`.

## 4) Model Data RTDB (yang dipakai dashboard admin sekolah)

RTDB: `https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app`

### A. Identitas & binding siswa

- `students/{nisn}`
  - `name`, `class`, `schoolId`, `schoolName`, `npsn`
  - `device_uuid`
  - status monitoring (contoh): `deviceStatus`, `lastUpdated`, `latitude`, `longitude`, `trustScore`, dll

- `students_by_school/{schoolId}/{nisn}`
  - index untuk mempercepat listing per sekolah (jika dipakai).

### B. Kelas (klasifikasi)

- `schools/{schoolId}/classes/{classKey}`
  - `name` (contoh: `VII-A`)
  - `createdAt`, `updatedAt`

Dashboard:
- menyediakan UI tambah/hapus kelas,
- dipakai untuk filter Data Siswa dan Realtime Monitoring.

### C. Jadwal & hari libur (per sekolah)

- `schools/{schoolId}/schedule/weekdays/{mon|tue|wed|thu|fri|sat|sun}`
  - `enabled` (boolean)
  - `start` (string `HH:mm`)
  - `end` (string `HH:mm`)

- `schools/{schoolId}/holidays/{yyyy-mm-dd}`
  - `date` (string)
  - `note` (string)
  - `createdAt`, `updatedAt` (timestamp ms)

### D. Konfigurasi global (deployment)

- `school_config`
  - `latitude`, `longitude`, `radius`
  - `is_holiday_mode` (Mode Acara/Libur global)
  - `is_active_protection` (master proteksi global)
  - `startTime`, `endTime` (fallback jam sekolah)

### E. Izin penggunaan HP

- `active_codes/{CODE}`
  - `expiresAt` (timestamp ms)
  - `duration` (menit)

- `active_sessions/{nisn}`
- `active_sessions_by_school/{schoolId}/{nisn}`
  - sesi aktif yang bisa dicabut admin kapan saja (delete node).

### F. Uninstall authorization (per sekolah)

- `schools/{schoolId}/uninstallAccess`
  - `code`
  - `expiresAt`

## 5) Fitur Utama (admin sekolah)

Implementasi detail ada di [page.tsx](file:///c:/Unified-System/apps/web/src/app/edulock/admin/page.tsx).

- Realtime Monitoring siswa (status online, lokasi, trust score, last update).
- Cabut izin penggunaan HP per siswa + massal (berdasarkan kelas).
- Kelola data siswa (tambah, hapus, import excel, reset device binding).
- Kelola kode izin (generate/tampilkan QR).
- Pengaturan sistem:
  - master proteksi
  - mode acara/libur global
  - geofencing (lat/lon/radius)
  - jadwal per hari + hari libur/tanggal merah per sekolah
- Akses kode uninstall sekolah (hanya baca, berasal dari super admin).

## 6) Integrasi dengan APK Siswa

Hubungan utama dashboard ↔ APK siswa:

- Dashboard menulis:
  - konfigurasi `school_config` (global)
  - jadwal & libur `schools/{schoolId}/schedule` dan `schools/{schoolId}/holidays`
  - revoke izin dengan menghapus `active_sessions/{nisn}` (dan mirror `active_sessions_by_school/{schoolId}/{nisn}`)
- APK siswa membaca realtime dan menegakkan enforcement sesuai status terbaru.

## 7) Deployment

- Hosting Firebase project: `sc-app-bk-2025`
- URL: https://sc-app-bk-2025.web.app/edulock/admin
