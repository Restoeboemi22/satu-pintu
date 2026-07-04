# STRUKTUR FOLDER — APK / Mobile (Expo React Native)

Berlaku untuk Tahap E di `SITEPLAN_ALUR_KERJA.md` — dibuat **setelah** web
(Tahap D) lulus hardening. Prinsip folder ini sama dengan `web/`: backend
(Cloud Functions) sudah ada dan dipakai bersama, mobile hanya jadi klien
tambahan dengan tambahan khusus **offline-first**.

Kalau kamu memakai Turborepo monorepo seperti di `DETAIL_APLIKASI.md`
(`apps/mobile`), struktur ini diletakkan di dalam `apps/mobile/`. Kalau
mobile dibuat sebagai project terpisah (di luar monorepo, sejajar dengan
folder `web/` di `Satu Pintu/`), strukturnya sama saja, hanya root-nya
berbeda.

---

## 1. Struktur Lengkap Target

```text
mobile/                                   ← root Expo project
├── app.json / app.config.ts               ← konfigurasi Expo (nama, ikon, permission GPS, dsb)
├── eas.json                               ← konfigurasi build (EAS Build) untuk hasilkan APK/AAB
├── package.json
├── tsconfig.json
├── .env.example                           ← template, JANGAN commit .env asli
│
├── app/                                    ← Expo Router (file-based routing)
│   ├── _layout.tsx                         ← root layout, auth guard global
│   ├── login.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx                     ← tab navigator
│   │   ├── index.tsx                       ← Beranda (Virtual Pet + ringkasan)
│   │   ├── attendance.tsx                  ← riwayat kehadiran pribadi (read-only)
│   │   └── tasks.tsx                       ← daftar tugas literasi
│   ├── attendance-submit.tsx               ← layar khusus submit absensi (alur kritis)
│   └── +not-found.tsx
│
├── src/
│   ├── features/                           ← dikelompokkan per modul, bukan per tipe file
│   │   ├── auth/
│   │   │   ├── api.ts                      ← panggil Firebase Auth
│   │   │   ├── hooks.ts                    ← useAuth(), useClaims()
│   │   │   └── store.ts                    ← state login lokal
│   │   ├── attendance/
│   │   │   ├── api.ts                      ← panggil Cloud Function submitAttendance
│   │   │   ├── gps.ts                      ← ambil koordinat + deteksi mock-provider
│   │   │   ├── offlineQueue.ts             ← antrian submit saat offline (Bagian 3)
│   │   │   └── hooks.ts
│   │   ├── pet/
│   │   │   ├── api.ts                      ← baca status pet (read-only dari Firestore)
│   │   │   └── hooks.ts
│   │   └── tasks/
│   │       ├── api.ts
│   │       └── hooks.ts
│   │
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── client.ts                   ← init Firebase SDK (Auth, Firestore, Functions)
│   │   │   └── functionsWrapper.ts         ← helper httpsCallable + auto idempotency key
│   │   ├── db/
│   │   │   ├── schema.ts                   ← definisi tabel SQLite lokal
│   │   │   ├── client.ts                   ← init koneksi SQLite (expo-sqlite)
│   │   │   └── migrations/                 ← perubahan skema lokal seiring waktu
│   │   ├── sync/
│   │   │   ├── backgroundSync.ts           ← worker kirim data pending saat online kembali
│   │   │   └── netStatus.ts                ← listener status koneksi
│   │   └── idempotency.ts                  ← generate UUID v4 per submit (Bagian 3 arsitektur kokoh)
│   │
│   ├── components/
│   │   ├── ui/                             ← komponen visual generik
│   │   └── pet/                            ← komponen visual Virtual Pet
│   │
│   ├── store/                              ← state management global (Zustand/Jotai)
│   │   └── appStore.ts
│   │
│   └── types/
│       └── shared.ts                       ← idealnya sinkron dengan functions/src/types di web
│
├── assets/
│   ├── images/
│   └── fonts/
│
└── __tests__/
    ├── attendance.test.ts                  ← test logika idempotency & offline queue
    └── gps.test.ts                         ← test deteksi mock-location
```

---

## 2. Bagian yang Beda dari Web — Kenapa Ada `offlineQueue.ts` dan `db/`

Ini yang membedakan mobile dari web secara struktural, sesuai
`ARSITEKTUR_KOKOH_MASSAL.md` Bagian 3:

```text
Siswa tekan "Absen"
   │
   ▼
1. Ambil GPS + cek mock-provider (src/features/attendance/gps.ts)
   │
   ▼
2. Buat idempotencyKey (src/lib/idempotency.ts)
   │
   ▼
3. Simpan dulu ke SQLite lokal, status: "pending"
   (src/lib/db — bukan langsung ke Firestore)
   │
   ▼
4. Cek koneksi (src/lib/sync/netStatus.ts)
   │
   ├── Online  → panggil Cloud Function submitAttendance langsung,
   │             update status SQLite jadi "synced"
   │
   └── Offline → tetap "pending", background worker
                 (src/lib/sync/backgroundSync.ts) akan retry
                 begitu koneksi kembali
```

**Aturan wajib**: `offlineQueue.ts` dan `functionsWrapper.ts` harus selalu
menyertakan `idempotencyKey` yang sama untuk request yang sama, walau
di-retry berkali-kali — supaya sisi server (Cloud Function) bisa menolak
duplikasi dengan aman (lihat `ARSITEKTUR_KOKOH_MASSAL.md` Bagian 3).

---

## 3. Kenapa Struktur `features/` Bukan Struktur "per Tipe File"

Hindari pola lama seperti:
```text
src/
├── screens/
├── components/
├── services/
├── hooks/
```
karena satu fitur (misal absensi) jadi tersebar di 4 folder berbeda dan
susah dilacak. Struktur `features/attendance/` di atas mengelompokkan
semua yang berhubungan dengan satu domain jadi satu tempat — lebih mudah
saat modul absensi (paling kritis) perlu direview/diaudit terpisah dari
modul lain.

---

## 4. Konfigurasi Sensitif — Jangan Ulangi Insiden `service-account.json`

Mobile app **tidak pernah** butuh service account Firebase (itu hanya
untuk Admin SDK sisi server). Yang dipakai mobile adalah Firebase **client
config** (`apiKey`, `projectId`, dst) — ini memang publik by design (aman
dibaca siapa pun karena keamanan sebenarnya ada di Security Rules dan
Cloud Functions, bukan di kerahasiaan config ini). Jadi:

- [ ] `google-services.json` (Android) — boleh commit, tapi baiknya tetap
      dipisah per environment (`dev`/`production`) dan tidak disamakan
      dengan project Firebase yang dipakai untuk testing.
- [ ] `.env` untuk konfigurasi non-Firebase (misalnya feature flag) —
      tetap ikuti pola `.env.example` di-commit, `.env` asli tidak.
- [ ] Pastikan App Check (`ARSITEKTUR_KOKOH_MASSAL.md` Bagian 5) sudah
      diaktifkan di sisi mobile sebelum rilis ke sekolah pilot — ini
      pertahanan utama supaya API tidak dipanggil dari luar aplikasi resmi.

---

## 5. Struktur untuk Native Kotlin (`native-mobile`) — Ringkas

Kalau nanti lanjut ke varian native Kotlin (setelah Expo stabil, sesuai
Tahap F `SITEPLAN_ALUR_KERJA.md`), pola foldernya beda platform tapi
prinsip sama — dikelompokkan per fitur, bukan per tipe file:

```text
native-mobile/
├── app/
│   └── src/main/java/com/unifiedsystem/
│       ├── core/
│       │   ├── auth/                 ← wrapper Firebase Auth Kotlin
│       │   ├── network/              ← wrapper Cloud Functions call
│       │   └── db/                   ← Room database (padanan SQLite)
│       ├── feature/
│       │   ├── attendance/
│       │   │   ├── data/             ← repository, idempotency key
│       │   │   ├── domain/           ← use case (Haversine dihitung ulang lokal hanya untuk UX preview, keputusan tetap di server)
│       │   │   └── ui/               ← Compose screen
│       │   ├── discipline/           ← untuk petugas tatib
│       │   └── pet/
│       └── MainActivity.kt
└── build.gradle.kts
```

Prinsip yang tidak berubah lintas platform: **keputusan (GPS validity,
skor pet, status kehadiran) tetap dihitung di Cloud Functions**, native
Kotlin hanya boleh menghitung ulang secara lokal untuk keperluan **preview
UI** (misal tampilkan estimasi jarak ke siswa sebelum submit), bukan
sebagai keputusan final yang ditulis ke database.

---

## 6. Urutan Membuat Folder (Ikuti Tahap E Siteplan)

1. `src/lib/firebase/` — koneksi ke project Firebase yang **sama** dengan
   web (pakai config `dev` dulu, jangan langsung `production`).
2. `src/lib/db/` — schema SQLite lokal.
3. `src/lib/idempotency.ts` + `src/lib/sync/` — fondasi offline-first,
   selesai dan diuji **sebelum** UI absensi dibuat.
4. `app/login.tsx` + `src/features/auth/` — reuse Auth flow yang sama
   persis dengan web.
5. `app/attendance-submit.tsx` + `src/features/attendance/` — modul
   paling kritis, uji idempotency dan offline queue secara nyata
   (matikan wifi di tengah submit) sebelum modul lain dikerjakan.
6. Modul lain (`pet`, `tasks`) menyusul, sesuai urutan E.2 di siteplan.
