# Spentgapa Dashboard

Web dashboard Satu Pintu berbasis Next.js 14.

## Struktur Project

Project ini menggunakan Next.js 14 dengan App Router.

- `src/app`: Halaman-halaman aplikasi (Routing)
- `src/components`: Komponen UI reusable
- `src/lib`: Utility, hooks, dan konfigurasi API
- `public`: Aset statis (gambar, icon)

## Cara Menjalankan Lokal Baru

1. Pastikan Node.js 20 sudah terpasang.
2. Salin file `.env.local.example` menjadi `.env.local`.
3. Isi semua variabel Firebase GAS, Firebase EduLock, dan service account admin dengan project baru Anda.
   Arsitektur default sekarang memakai dua console:
   `hosting + GAS = satu-pintu-gas-dev`, `EduLock = satu-pintu-edulock-dev`.
   Jika ingin format production yang tinggal tempel per baris, gunakan `.env.production.checklist-ready.example` sebagai acuan final.
4. Install dependency:

```bash
npm install
```

5. Jalankan development server:

```bash
npm run dev
```

6. Buka `http://localhost:3002` di browser.

## Catatan Penting Lokal Baru

- Aplikasi sekarang fail-fast jika boundary Firebase belum diisi. Ini disengaja agar lokal baru tidak diam-diam memakai akun atau database V1.
- Boundary client dibaca dari `NEXT_PUBLIC_*` di `src/lib/firebaseProjectBoundary.ts`.
- Credential Firebase Admin server dibaca dari `FIREBASE_ADMIN_GAS_SERVICE_ACCOUNT_JSON` dan `FIREBASE_ADMIN_EDULOCK_SERVICE_ACCOUNT_JSON`.
- File `service-account.json` lama tidak lagi dipakai sebagai sumber runtime.
- Deploy web admin hanya ke hosting project utama `satu-pintu-gas-dev`, bukan ke project EduLock.
- Portal web ini memakai App Router + route API Next.js, jadi production default tidak boleh dipaksa `output: "export"`. Static export hanya boleh dipakai jika eksplisit mengisi `WEB_STATIC_EXPORT=1` untuk kebutuhan snapshot statis tertentu.

## Seed Minimum Agar Login Jalan

- Buat data dasar EduLock:
  - `schools/{schoolId}`
  - `npsn_index/{npsn} = {schoolId}`
  - `admin_profiles/{uid}`
- Login admin sekolah pertama masih mengikuti pola bootstrap `NPSN + admin123`, lalu wajib ganti password setelah login pertama.
- Jika project baru masih kosong total, server bisa menyala tetapi login admin belum akan berhasil sampai seed minimum tersedia.

## Checklist Sebelum Deploy

Jika Anda menambah menu baru, route baru, alias route, atau modul baru di portal web, gunakan checklist ini sebelum deploy:

- [REGRESSION_CHECKLIST_MENU_BARU.md](file:///c:/Unified-System/apps/web/REGRESSION_CHECKLIST_MENU_BARU.md)
- [CHECKLIST_DEPLOY_FIREBASE_DUA_CONSOLE.md](file:///d:/Satu%20Pintu/web/docs/CHECKLIST_DEPLOY_FIREBASE_DUA_CONSOLE.md)

Checklist ini dibuat dari insiden `Lentera Digital`, saat menu baru terlihat benar di lokal tetapi perilaku route dan shell-nya berbeda setelah deploy production.

## Fitur Utama

-   **Manajemen Siswa & Guru**: CRUD data siswa dan guru.
-   **E-Library**: Manajemen buku dan peminjaman.
-   **Absensi**: Pencatatan kehadiran siswa.
-   **Kedisiplinan**: Sistem poin pelanggaran dan prestasi.
-   **Virtual Pet**: Gamifikasi untuk siswa.
-   **Anti-Bullying**: Pelaporan dan penanganan kasus.
-   **Notifikasi**: Broadcast pengumuman.
