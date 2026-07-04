# SITEPLAN & ALUR KERJA — Bangun Rumah Dulu (Web) Baru APK

Filosofi: **web dashboard (super admin + admin) adalah "rumah"** — tempat semua
aturan, data master, dan enforcement backend dipastikan benar dulu. **APK
(mobile) menyusul sebagai "penghuni"** yang tinggal terhubung ke rumah yang
sudah kokoh, bukan dibangun paralel sambil rumahnya masih goyang.

Dokumen ini adalah urutan eksekusi, dibaca bersama:
`ARSITEKTUR_LENGKAP_FIREBASE.md`, `ARSITEKTUR_KOKOH_MASSAL.md`,
`CHECKLIST_IMPLEMENTASI_BACKEND.md`.

---

## Prinsip Urutan Kerja

1. **Backend + Auth dulu, tampilan belakangan.** Cloud Function dan Custom
   Claims harus benar sebelum satu pun tombol UI dibuat — karena web dan
   APK nanti sama-sama memanggil Function yang sama.
2. **Super Admin dulu, baru Admin Sekolah.** Super admin adalah akar dari
   semua akses (dia yang membuat admin sekolah) — kalau ini belum stabil,
   semua di bawahnya tidak punya fondasi.
3. **Satu modul selesai penuh (backend + rules + UI + test) sebelum modul
   berikutnya dimulai.** Jangan buka banyak modul setengah jadi bersamaan.
4. **APK tidak dimulai sebelum web mencapai kriteria "maksimal"** yang
   didefinisikan eksplisit di Bagian 4 — bukan perasaan "sudah cukup bagus".

---

## TAHAP A — Fondasi (sebelum UI apa pun dibuat)

Ini padanan langsung Fase 1-2 di `CHECKLIST_IMPLEMENTASI_BACKEND.md`.

- [ ] Firebase project `dev` dan `production` terpisah, siap pakai.
- [ ] Firebase Auth aktif, alur login dasar (email/NPSN + password) berjalan.
- [ ] Struktur Custom Claims (`role`, `schoolId`, `classId`) didefinisikan
      dan Function `assignRole` (khusus super_admin) berfungsi.
- [ ] Struktur Firestore tenant-scoped (`schools/{schoolId}/...`) dibuat.
- [ ] Helper `assertCapability` dan `assertSchoolScope` selesai + unit test.
- [ ] Security Rules dasar (default deny untuk write sensitif) sudah aktif,
      meski modul di atasnya belum ada — supaya tidak ada window "terbuka".
- [ ] `audit_logs` collection + helper `writeAuditLog` siap dipakai semua
      Function berikutnya.

**Kriteria selesai Tahap A**: bisa login sebagai super_admin dummy, claims
terbaca benar di token, dan mencoba operasi tanpa capability yang sesuai
ditolak (`permission-denied`) — dibuktikan lewat test, bukan asumsi.

---

## TAHAP B — Web Super Admin (akar sistem)

Bangun panel super admin dulu, karena dialah yang menciptakan sekolah dan
admin pertama tiap sekolah. Tanpa ini, tidak ada data untuk diuji modul lain.

### B.1 — Manajemen Sekolah & Admin (prioritas pertama)
- [ ] Function `createSchoolAdmin` (buat dokumen `schools/{id}` + akun admin
      pertama + set claims).
- [ ] Function `deactivateSchool` / `reactivateSchool` (untuk sekolah yang
      berhenti berlangganan, dsb).
- [ ] UI: daftar sekolah, form tambah sekolah baru, detail sekolah.
- [ ] Test: super_admin bisa buat sekolah baru; admin/guru/siswa mencoba
      Function ini harus ditolak.

### B.2 — Panel Kendali Sistem (`super/`)
- [ ] Halaman monitoring global: jumlah sekolah aktif, jumlah user per role.
- [ ] Halaman audit log viewer (baca dari `audit_logs`, filter per sekolah/
      per aksi/per tanggal).
- [ ] Halaman pengaturan sistem lintas-tenant (kalau ada konfigurasi global,
      misal radius default absensi, threshold decay pet).

### B.3 — EduLock Control (level super admin)
- [ ] Function `toggleEduLockAccess` dengan assert capability.
- [ ] UI: daftar device per sekolah, tombol lock/unlock, riwayat aksi.

**Kriteria selesai Tahap B**: super admin bisa, dari nol, membuat sekolah
baru + admin pertamanya, dan admin tersebut bisa login — seluruhnya lewat
UI, tanpa manual insert data di Firebase Console.

---

## TAHAP C — Web Admin Sekolah (operasional harian)

Dikerjakan modul demi modul, urutan berdasarkan ketergantungan data
(master data dulu, baru data transaksional yang bergantung padanya).

### C.1 — Master Data (fondasi modul lain)
- [ ] Function `createSchoolUser` (guru & siswa), dengan assert schoolId
      sama dengan admin yang membuat.
- [ ] UI `students/`: CRUD siswa, assign kelas.
- [ ] UI `teachers/`: CRUD guru, assign sebagai wali kelas.
- [ ] Test: admin sekolah A tidak bisa membuat/lihat siswa sekolah B.

### C.2 — Presensi (bergantung pada C.1)
- [ ] Function `submitAttendance` (server-side GPS + waktu, sesuai
      `ARSITEKTUR_KOKOH_MASSAL.md` Bagian 2-3: transaction + idempotency).
- [ ] Function `manualAttendanceInput` (guru input manual untuk kelasnya).
- [ ] UI `attendance/`: monitor realtime, input manual per kelas.
- [ ] UI `attendance-report/`: rekap bulanan, export.
- [ ] Scheduled Function `pruneOldAttendance` (Fase 4 checklist).
- [ ] Load test skenario jam 07:00 (Bagian 8 `ARSITEKTUR_KOKOH_MASSAL.md`)
      — **wajib lulus sebelum lanjut ke modul berikut**, karena ini modul
      dengan beban tertinggi di seluruh sistem.

### C.3 — Kedisiplinan
- [ ] Function `recordViolation` (guru/tatib input pelanggaran, otomatis
      trigger pengurangan Happiness pet).
- [ ] UI `discipline/`: pencatatan, papan peringkat, aturan poin.

### C.4 — Virtual Pet (bergantung pada C.2 & C.3)
- [ ] Scheduled Function `calculatePetDecay` (per-sekolah fan-out, sesuai
      Bagian 4 `ARSITEKTUR_KOKOH_MASSAL.md`).
- [ ] Function `revivePet`, `rewardPenaltyBulk`.
- [ ] UI `virtual-pet/`: dashboard monitoring, tombol reward/penalty massal.

### C.5 — Literasi (Lentera Digital) & E-Perpustakaan
- [ ] Function validasi tugas literasi oleh guru.
- [ ] UI `library/`: manajemen inventaris, validasi tugas.

### C.6 — HALO Spentgapa
- [ ] Rules khusus privasi pelapor (Bagian 6 `ARSITEKTUR_LENGKAP_FIREBASE.md`).
- [ ] UI: daftar laporan (guru lihat kelasnya, admin lihat semua sekolahnya).

### C.7 — 7 KAIH (Karakter)
- [ ] Function input nilai oleh guru dengan assert kelas yang diampu.
- [ ] UI `seven-habits/`: input dan monitoring.

**Kriteria selesai Tahap C**: seluruh alur operasional harian sekolah bisa
dijalankan penuh dari web — dari input siswa baru sampai rekap bulanan —
tanpa satu pun operasi sensitif yang masih ditulis langsung dari client.

---

## TAHAP D — Hardening Sebelum Dianggap "Maksimal"

Ini gerbang wajib sebelum boleh mulai APK. Merujuk langsung ke
`ARSITEKTUR_KOKOH_MASSAL.md` Bagian 11 (Definition of Done), plus tambahan
khusus web:

- [ ] Semua checklist Bagian 11 `ARSITEKTUR_KOKOH_MASSAL.md` tercentang.
- [ ] Rollout Tahap 1 (1 sekolah pilot) sudah berjalan web-only minimal
      2-4 minggu tanpa insiden data.
- [ ] Semua modul C.1–C.7 sudah dipakai nyata oleh sekolah pilot (bukan
      cuma diuji developer) minimal 1 siklus penuh (misal 1 bulan
      akademik) supaya pola pemakaian nyata ketahuan.
- [ ] Tidak ada bug kategori "data salah/hilang/korup" terbuka.
- [ ] Response time halaman-halaman kunci (attendance, dashboard) sudah
      diukur dan wajar untuk koneksi sekolah pilot.

---

## TAHAP E — Baru Mulai APK (Mobile)

Setelah Tahap D lulus, APK dibangun **sebagai klien tambahan** dari backend
yang sudah teruji, bukan membangun backend baru untuk mobile.

### E.1 — Prinsip Integrasi
- APK memakai **Cloud Function yang sama persis** dengan web (`submitAttendance`,
  dll) — tidak ada logic bisnis baru khusus mobile.
- APK memakai **Firebase Auth yang sama**, custom claims yang sama.
- Perbedaan APK vs web hanya di lapisan presentasi + kebutuhan offline-first
  (SQLite lokal + idempotency key saat sync, sesuai
  `ARSITEKTUR_KOKOH_MASSAL.md` Bagian 3).

### E.2 — Urutan Modul APK (ikuti urutan kebutuhan siswa harian)
1. [ ] Login siswa (reuse Auth flow yang sama).
2. [ ] Absensi mandiri (`submitAttendance` — modul paling kritis, harus
       paling matang duluan karena beban tertinggi).
3. [ ] Beranda (Virtual Pet + rangkuman aktivitas) — read-only dari
       Firestore, sesuai Rules yang sudah ada.
4. [ ] Riwayat kehadiran pribadi — read-only.
5. [ ] Tugas literasi — create tugas (Rules sudah ada dari C.5).

### E.3 — Testing Sebelum Rilis APK
- [ ] Uji offline-first: matikan koneksi saat submit, nyalakan lagi,
      pastikan idempotency key mencegah double-submit (skenario nyata,
      bukan simulasi).
- [ ] Uji dengan device asli di lokasi sekolah pilot (GPS anti-cheat harus
      diuji dengan kondisi sinyal sekolah yang sebenarnya, bukan emulator).
- [ ] Rilis internal (APK sideload) ke sekolah pilot dulu, sebelum ke Play
      Store / rollout 50 sekolah.

---

## TAHAP F — Rollout Bertahap Gabungan (Web + APK)

Menyambung Bagian 9 `ARSITEKTUR_KOKOH_MASSAL.md`, sekarang dengan APK
sudah masuk:

```text
Tahap F1: 1 sekolah pilot — web + APK bersamaan, 2-4 minggu
Tahap F2: 5 sekolah — validasi beban gabungan web+mobile
Tahap F3: 15 sekolah
Tahap F4: sisa 50 sekolah, bertahap per gelombang
```

Native Kotlin (`native-mobile`) dan EduLock menyusul setelah APK Expo utama
stabil di Tahap F2 — jangan dikerjakan paralel dengan APK utama, supaya
fokus tim tidak pecah di fase kritis ini.

---

## Ringkasan Urutan Besar

```text
TAHAP A  Fondasi Auth + Backend inti
   ↓
TAHAP B  Web Super Admin (akar sistem)
   ↓
TAHAP C  Web Admin Sekolah (modul demi modul, C.1 → C.7)
   ↓
TAHAP D  Hardening & pembuktian nyata (gerbang wajib)
   ↓
TAHAP E  APK (reuse backend, offline-first, testing device asli)
   ↓
TAHAP F  Rollout bertahap ke 50 sekolah (web+APK bersamaan)
```

Aturan paling penting dari siteplan ini: **jangan mulai Tahap E sebelum
Tahap D benar-benar lulus.** Godaan terbesar biasanya "APK-nya dikerjakan
paralel saja biar cepat" — itu justru yang bikin fondasi retak, karena
tim jadi terbagi fokus antara memperbaiki bug web dan mengejar fitur APK
di saat bersamaan.
