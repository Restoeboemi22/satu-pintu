# Checklist Deploy Firebase Dua Console

Dokumen ini menjadi acuan deploy untuk arsitektur:

- Hosting web admin / PortalKita: `satu-pintu-gas-dev`
- Backend GAS / PortalKita: `satu-pintu-gas-dev`
- Backend EduLock: `satu-pintu-edulock-dev`

## 1. Mapping Environment

### Hosting utama

- `NEXT_PUBLIC_HOSTING_ACTIVE_HOST`
  - isi domain aktif web admin, misalnya `https://portalkita-sekolah.web.app`
- `NEXT_PUBLIC_HOSTING_RETIRED_HOSTS`
  - opsional, isi domain lama jika ada
- `NEXT_PUBLIC_HOSTING_PROJECT_ID`
  - wajib `satu-pintu-gas-dev`

### Boundary client GAS

- `NEXT_PUBLIC_FIREBASE_GAS_API_KEY`
- `NEXT_PUBLIC_FIREBASE_GAS_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_GAS_DATABASE_URL`
- `NEXT_PUBLIC_FIREBASE_GAS_PROJECT_ID`
  - wajib `satu-pintu-gas-dev`
- `NEXT_PUBLIC_FIREBASE_GAS_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_GAS_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_GAS_APP_ID`

### Boundary client EduLock

- `NEXT_PUBLIC_FIREBASE_EDULOCK_APP_NAME`
  - gunakan `edulock`
- `NEXT_PUBLIC_FIREBASE_EDULOCK_API_KEY`
- `NEXT_PUBLIC_FIREBASE_EDULOCK_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_EDULOCK_DATABASE_URL`
- `NEXT_PUBLIC_FIREBASE_EDULOCK_PROJECT_ID`
  - wajib `satu-pintu-edulock-dev`
- `NEXT_PUBLIC_FIREBASE_EDULOCK_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_EDULOCK_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_EDULOCK_APP_ID`

### Boundary server

- `PORTAL_SESSION_SECRET`
  - wajib secret acak panjang, jangan memakai private key Firebase
- `FIREBASE_ADMIN_GAS_SERVICE_ACCOUNT_JSON`
  - service account milik `satu-pintu-gas-dev`
- `FIREBASE_ADMIN_EDULOCK_SERVICE_ACCOUNT_JSON`
  - service account milik `satu-pintu-edulock-dev`

## 2. Konfigurasi File Lokal

- `.firebaserc`
  - `default` harus `satu-pintu-gas-dev`
  - alias `gas` harus `satu-pintu-gas-dev`
  - alias `edulock` harus `satu-pintu-edulock-dev`
- `firebase.json`
  - jika memakai hosting statis murni, `public` boleh menunjuk folder export statis
  - untuk portal web Next.js yang memakai route API/server runtime, jangan deploy hanya dari folder `out`
- `.env.production.checklist-ready.example`
  - gunakan sebagai sumber tempel final saat menyiapkan `.env.local` production
- `.env.local`
  - isi dengan gabungan boundary GAS + EduLock sesuai template `.env.local.example`

## 3. Checklist Console GAS

- Firebase Hosting aktif
- Realtime Database GAS aktif
- Authentication GAS aktif
- Provider `Anonymous` aktif untuk kebutuhan boundary GAS client
- Web App GAS sudah dibuat dan nilai config sudah disalin ke env
- Service account GAS tersedia untuk runtime server

## 4. Checklist Console EduLock

- Realtime Database EduLock aktif
- Authentication EduLock aktif
- Provider `Email/Password` aktif
- Web App EduLock sudah dibuat dan nilai config sudah disalin ke env
- Service account EduLock tersedia untuk runtime server

## 5. Checklist Data Sebelum Deploy

- Node `schools/{schoolId}` tersedia di EduLock
- Node `npsn_index/{npsn}` tersedia di EduLock
- Node `admin_profiles/{uid}` tersedia di EduLock
- Data induk `master_students` dan `master_teachers` tersedia di GAS
- Seed EduLock dan bootstrap admin sekolah sudah dijalankan jika project masih baru

## 6. Verifikasi Lokal

Jalankan dari folder `web`:

```bash
npm install
npm run build
```

Pastikan:

- build selesai tanpa error runtime env
- jika memakai static export khusus, folder `out` terbentuk
- jika memakai runtime Next.js, pastikan route API seperti `/api/admin/edulock/auth` benar-benar hidup setelah deploy
- login admin web bisa membaca boundary GAS + EduLock
- halaman `DATABASE`, `GAS`, dan `EduLock` terbuka dengan data tenant yang benar

## 7. Deploy Hosting

Deploy web hanya ke project hosting utama:

```bash
firebase use satu-pintu-gas-dev
firebase deploy --only hosting
```

Atau bila memakai alias default dari `.firebaserc`:

```bash
firebase deploy --only hosting
```

Catatan penting:

- PortalKita yang memakai App Router dan route API Next.js tidak boleh dianggap sebagai situs statis murni.
- Jika login/admin route bergantung pada `/api/*`, maka deploy harus memakai runtime Next.js yang benar (misalnya App Hosting atau jalur runtime setara), bukan export statis biasa.

## 8. Prinsip Operasional Setelah Deploy

- Jangan deploy web yang sama ke `satu-pintu-edulock-dev`
- Jangan tukar env GAS dan EduLock
- Jangan membuat jalur CRUD siswa paralel di workspace EduLock yang membypass `DATABASE/master_students`
- Semua pembacaan sensitif harus scoped sejak query berdasarkan `schoolId`

## 9. Jika Nanti Pindah Domain

- ubah `NEXT_PUBLIC_HOSTING_ACTIVE_HOST`
- jika ada domain lama, pindahkan ke `NEXT_PUBLIC_HOSTING_RETIRED_HOSTS`
- deploy ulang hosting ke `satu-pintu-gas-dev`
