# Setup Firebase Dev Baru

Dokumen ini menyiapkan instance lokal baru tanpa memakai akun atau boundary V1.

## Nama Project Rekomendasi

- GAS: `satu-pintu-gas-dev`
- EduLock: `satu-pintu-edulock-dev`

## Arsitektur Dua Console Yang Dipakai

- Hosting web admin / PortalKita: `satu-pintu-gas-dev`
- Realtime Database + Auth GAS: `satu-pintu-gas-dev`
- Realtime Database + Auth EduLock: `satu-pintu-edulock-dev`
- Rule utama: web hanya punya satu rumah deploy, tetapi runtime tetap membaca dua boundary Firebase yang terpisah.

## Yang Harus Dibuat di Firebase Console

### Project GAS
- Aktifkan `Realtime Database`
- Aktifkan `Authentication`
- Aktifkan provider `Anonymous`
- Tambahkan `Web App`

### Project EduLock
- Aktifkan `Realtime Database`
- Aktifkan `Authentication`
- Aktifkan provider `Email/Password`
- Tambahkan `Web App`

## File Lokal Yang Dipakai

- Template env dev: `.env.local.dev.template`
- Template env umum: `.env.local.example`
- Template env production checklist-ready: `.env.production.checklist-ready.example`
- Template env boundary GAS: `.env.local.gas`
- Template env boundary EduLock: `.env.local.edulock`
- Template data sekolah: `scripts/data/schools.bootstrap.template.csv`
- Generator seed sekolah: `scripts/generate-edulock-bootstrap.js`
- Konverter service account ke env: `scripts/print-service-account-env.js`
- Bootstrap 42 admin sekolah: `scripts/bootstrap-edulock-admins.js`
- Checklist deploy dua console: `docs/CHECKLIST_DEPLOY_FIREBASE_DUA_CONSOLE.md`

## Langkah Kerja

1. Untuk lokal/dev, salin `.env.local.dev.template` menjadi `.env.local`
2. Untuk staging/production checklist-ready, gunakan `.env.production.checklist-ready.example` lalu salin isinya ke `.env.local`
3. Isi semua `NEXT_PUBLIC_FIREBASE_*` dari dua Firebase Console sesuai boundary masing-masing
4. Download service account JSON dari project GAS dan EduLock
5. Ubah keduanya menjadi env satu baris:

```bash
node scripts/print-service-account-env.js GAS path/to/gas-service-account.json
node scripts/print-service-account-env.js EDULOCK path/to/edulock-service-account.json
```

6. Tempel hasilnya ke `.env.local`
7. Isi `PORTAL_SESSION_SECRET` dengan secret acak panjang buatan sendiri
8. Pastikan `.firebaserc` menunjuk `default = satu-pintu-gas-dev` karena hosting web hanya dideploy ke console GAS
9. Gunakan `scripts/data/schools.bootstrap.template.csv` yang sudah terisi 42 sekolah default dari referensi V1 `E:\Aplikasi Android\Portal Sekolah`
10. Jika perlu, edit nama/email aktif per sekolah
11. Generate seed RTDB dan daftar bootstrap admin:

```bash
node scripts/generate-edulock-bootstrap.js
```

12. Import isi `scripts/data/edulock_seed.generated.json` ke RTDB EduLock baru
13. Jalankan bootstrap otomatis untuk membuat user Auth dan `admin_profiles`:

```bash
node scripts/bootstrap-edulock-admins.js
```

14. Cek laporan hasil bootstrap di `scripts/data/admin_bootstrap.report.json`

## Hasil Generator

### `edulock_seed.generated.json`
- berisi node:
  - `schools`
  - `npsn_index`

### `admin_bootstrap.generated.csv`
- berisi daftar:
  - `schoolId`
  - `schoolName`
  - `npsn`
  - `systemEmail`
  - `defaultPassword`
  - `role`
  - `isActive`

File CSV ini dipakai sebagai daftar kerja saat membuat akun admin bootstrap satu per satu.

### `admin_bootstrap.report.json`
- berisi hasil akhir bootstrap:
  - `email`
  - `uid`
  - `created`
  - `schoolId`
  - `schoolName`
  - `npsn`

## Catatan

- Runtime sekarang fail-fast. Jika `.env.local` belum lengkap, server tidak akan start.
- Ini sengaja untuk mencegah lokal baru kembali tersambung ke Firebase lama.
- CSV default sudah saya isi dari referensi V1 pada `E:\Aplikasi Android\Portal Sekolah\apps\EduLock\web-dashboard\src\pages\SuperDashboard.jsx`.
- Jika nanti daftar sekolah berubah, generator ini tetap bisa dipakai untuk membangun seed baru dari CSV hasil revisi Anda.
