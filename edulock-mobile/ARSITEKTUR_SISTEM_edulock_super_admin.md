# ARSITEKTUR_SISTEM EduLock (Super Admin)

Dokumen ini menjelaskan arsitektur teknis Dashboard EduLock untuk peran Super Admin (web) yang mengelola banyak sekolah (tenant), monitoring lintas sekolah, serta command/policy tingkat pusat.

## 1) Ringkasan Sistem

Dashboard Super Admin adalah aplikasi web (Next.js) yang:

- Autentikasi menggunakan Firebase Auth.
- Membaca/menulis data lintas sekolah di Firebase Realtime Database (RTDB).
- Menyediakan operasi tingkat pusat (tenant management, audit lintas sekolah, command center).

Implementasi utama halaman Super Admin berada di: [page.tsx](file:///c:/Unified-System/apps/web/src/app/edulock/super/page.tsx)

## 2) Komponen Utama (Web)

### A. Halaman Super Admin

- UI + state management: [page.tsx](file:///c:/Unified-System/apps/web/src/app/edulock/super/page.tsx)
  - Section utama (menu kiri) menggunakan `activeSection` (dashboard, monitoring, tenants, command_center, audit, dll).
  - Role gate: jika role bukan `super_admin` diarahkan ke `/edulock/admin`.

### B. Integrasi Firebase

- Konfigurasi Firebase (Auth + RTDB): [edulockFirebase.ts](file:///c:/Unified-System/apps/web/src/lib/edulockFirebase.ts)
- Guard/role: [useEduLockAuth](file:///c:/Unified-System/apps/web/src/lib/useEduLockAuth.ts)

## 3) Model Data RTDB (yang dipakai Super Admin)

RTDB yang dipakai oleh web dan APK: `https://edulock-4b7fc-default-rtdb.asia-southeast1.firebasedatabase.app`

### A. Admin profiles (akun admin sekolah + super admin)

- `admin_profiles/{uid}`
  - `email`
  - `role` (`admin` | `super_admin`)
  - `schoolId` (untuk admin sekolah)
  - `isActive`
  - `lastLoginAt`
  - `mustChangePassword`

### B. Tenants / Sekolah

- `schools/{schoolId}`
  - metadata sekolah (`name`, `district`, `npsn`, dll)
  - `isActive`
  - `createdAt`, `updatedAt`

### C. Monitoring lintas sekolah

Super Admin membaca agregasi status siswa lintas sekolah yang juga digunakan oleh dashboard Admin Sekolah, misalnya:

- `active_sessions/**` (izin penggunaan HP yang sedang aktif)
- `presence/**` atau node status realtime (tergantung implementasi reporting pada APK siswa)

## 4) Command Center (Super Admin)

Tujuan Command Center adalah menjalankan perintah sensitif yang tidak semestinya dimiliki admin sekolah.

### A. Kode Uninstall (Sekolah)

Alur:

1. Super Admin memilih `schoolId` + durasi, lalu klik “Buat Kode”.
2. Dashboard menulis node RTDB:
   - `schools/{schoolId}/uninstallAccess`
     - `code`
     - `expiresAt`
     - `createdAt`
     - `createdBy`
3. Admin sekolah melihat kode tersebut di dashboard Admin Sekolah pada menu Pengaturan Sistem, dan kode dipakai pada proses disable Device Admin di perangkat siswa (fallback) atau saat troubleshooting.

Implementasi UI + write/delete node ini ada di: [page.tsx](file:///c:/Unified-System/apps/web/src/app/edulock/super/page.tsx)

## 5) Hubungan dengan Dashboard Admin Sekolah

Dashboard Admin Sekolah berada di halaman web terpisah:

- [Admin page.tsx](file:///c:/Unified-System/apps/web/src/app/edulock/admin/page.tsx)

Korelasi konsep:

- Super Admin mengelola `schools/**` dan `admin_profiles/**`.
- Admin Sekolah mengelola data operasional sekolahnya (siswa, kelas, jadwal, zona, izin, dll) yang dibaca oleh APK siswa.

## 6) Deployment (Ringkas)

- Aplikasi web dibangun dan dideploy via Firebase Hosting dari project web.
- URL operasional saat ini mengikuti hosting yang digunakan untuk portal Anda (mis. `.../edulock/super`).

