# CHECKLIST IMPLEMENTASI BACKEND — Cloud Functions & Enforcement Layer

Checklist teknis untuk membangun backend Firebase (Cloud Functions + Auth +
Security Rules) secara bertahap dan aman. Ikuti urutan fase — jangan lompat,
tiap fase adalah fondasi untuk fase berikutnya.

Dibaca bersama: `SITEPLAN_ALUR_KERJA.md` (urutan besar proyek),
`STRUKTUR_FOLDER_WEB.md` (lokasi file), `KONTRAK_API_FUNCTIONS.md` (skema
tiap Function).

---

## FASE 0 — Persiapan

- [ ] Aktifkan Firebase Blaze plan (Cloud Functions butuh billing plan).
- [ ] Buat 2 project Firebase terpisah: `dev` dan `production`. Jangan uji
      coba apa pun langsung di `production`.
- [ ] Setup `functions/` dengan TypeScript (bukan JavaScript) untuk
      konsistensi tipe di seluruh backend.
- [ ] Install Firebase Admin SDK + Firebase Functions SDK di `functions/`.
- [ ] Setup Firebase Emulator Suite untuk testing lokal sebelum deploy.

---

## FASE 1 — Identitas & Sesi (Auth + Custom Claims)

- [ ] Definisikan struktur Custom Claims di Firebase Auth token:
  ```ts
  { role: "super_admin" | "admin" | "guru" | "siswa",
    schoolId: string | null,   // null hanya untuk super_admin
    classId?: string,
    capabilities?: string[] }
  ```
- [ ] Buat Cloud Function `assignRole` — hanya bisa dipanggil oleh
      `super_admin` yang sudah terautentikasi. Ini satu-satunya jalur
      legal untuk set role/schoolId user lain.
- [ ] **Larangan keras**: jangan pernah biarkan client menulis field `role`
      atau `schoolId` langsung ke dokumen Firestore sebagai sumber
      otorisasi. Source of truth role harus di token, bukan di dokumen
      yang bisa diedit user.
- [ ] Buat Function `firstLoginBootstrap` untuk login pertama kali (admin
      sekolah dengan kredensial awal) — verifikasi kredensial → set claims
      → set flag `requiresPasswordChange: true`.
- [ ] Buat Function `changePassword` yang mewajibkan verifikasi password
      lama + reset flag `requiresPasswordChange`.
- [ ] Test: user dengan role `siswa` mencoba memanggil `assignRole` →
      harus ditolak (`permission-denied`).

---

## FASE 2 — Enforcement Layer (Policy & Capability)

- [ ] Buat helper terpusat di `functions/src/lib/policy.ts` — semua
      Function memanggil helper ini untuk cek otorisasi, jangan duplikasi
      logika cek role di tiap Function.
- [ ] Definisikan capability catalog sebagai konstanta:
  ```ts
  export const CAPABILITIES = {
    ATTENDANCE_INPUT_MANUAL: ['super_admin','admin','guru'],
    PET_REWARD_PENALTY: ['super_admin','admin'],
    EDULOCK_CONTROL: ['super_admin','admin'],
    ...
  }
  ```
- [ ] Setiap Function sensitif wajib memanggil `assertCapability(context,
      'NAMA_CAPABILITY')` di baris pertama sebelum eksekusi logika apa pun.
- [ ] Setiap Function tenant-aware wajib memvalidasi `schoolId` dari token,
      bukan dari parameter yang dikirim client.
- [ ] Tulis unit test untuk `assertCapability` dan `assertSchoolScope` —
      kode paling kritis di seluruh sistem, harus 100% dites.

---

## FASE 3 — Absensi Anti-Cheat GPS

- [ ] Buat Cloud Function `submitAttendance(lat, lng, mockLocationFlag)`.
- [ ] Logika yang wajib ada di dalam Function (bukan di client):
  - [ ] Cek `mockLocationFlag` dari device — keputusan blokir/tidak
        dilakukan di server.
  - [ ] Hitung jarak Haversine ke koordinat sekolah (koordinat sekolah
        diambil dari Firestore server-side, bukan dikirim client).
  - [ ] Validasi radius 100 meter — keputusan lolos/tidak di server.
  - [ ] Tentukan status PRESENT/LATE berdasarkan `serverTimestamp()`
        Firebase, bukan timestamp dari device.
  - [ ] Logika override: kalau sudah ada catatan hari ini (misal ALPHA
        manual), update baris yang sama — bukan insert baru (one-ID
        system, cegah data ganda).
- [ ] Hasil akhir ditulis oleh Function dengan Admin SDK, bukan client
      menulis sendiri.
- [ ] Ubah Security Rules: client tidak boleh `create`/`update` langsung
      di collection attendance — hanya `read`.
- [ ] Implementasikan idempotency key sesuai `ARSITEKTUR_KOKOH_MASSAL.md`
      Bagian 3, supaya retry offline tidak menyebabkan submit dobel.
- [ ] Test kasus abuse: kirim koordinat palsu langsung ke Function (bukan
      lewat app) → pastikan tetap tervalidasi karena logika ada di server.

---

## FASE 4 — Auto-Prune Data Bulanan

- [ ] Buat Scheduled Function yang jalan tiap awal bulan (Cloud Scheduler
      + Pub/Sub), bukan trigger saat user buka app.
- [ ] Logika: arsipkan (bukan hard-delete) data attendance bulan
      sebelumnya per `schoolId`, pindah ke collection `attendance_archive`
      untuk kebutuhan rekap tahunan.
- [ ] Pecah proses per-sekolah lewat Pub/Sub fan-out (bukan satu proses
      panjang untuk semua sekolah) supaya tidak kena timeout Function.
- [ ] Test di project `dev` dengan data dummy sebelum aktifkan di
      production.

---

## FASE 5 — Gamifikasi Virtual Pet

- [ ] Buat Scheduled Function harian `calculatePetDecay` — hitung ulang
      health/happiness/energy/hunger berdasarkan data hari itu (absensi
      telat/bolos, poin pelanggaran, tugas literasi, aktivitas
      perpustakaan). Fan-out per-sekolah.
- [ ] Aturan yang wajib dihitung di server:
  - [ ] Happiness -10% telat, -25% bolos, dikurangi sesuai poin
        pelanggaran.
  - [ ] Reset level ke 1 + XP ke 0 kalau rata-rata status < 40%.
  - [ ] Status DEAD kalau menyentuh 0%.
- [ ] Buat Function `revivePet(studentId)` — assert capability, dengan
      audit log otomatis (siapa revive, kapan, siswa mana).
- [ ] Buat Function `rewardPenaltyBulk(studentIds[], type, amount)` untuk
      aksi massal admin, pakai `BulkWriter`, bukan loop `update()` satu-satu.
- [ ] Semua operasi inkremental (`health`, `happiness`, dst) wajib pakai
      `FieldValue.increment()` atau `runTransaction()` — tidak boleh pola
      read-modify-write biasa (lihat `ARSITEKTUR_KOKOH_MASSAL.md` Bagian 2).
- [ ] Ubah Security Rules: field skor pet read-only dari client. Hanya
      Function yang boleh menulis field-field ini.

---

## FASE 6 — EduLock Control & Operasi Sensitif Lain

- [ ] Buat Function `toggleEduLockAccess(schoolId, enabled)` — assert
      capability `EDULOCK_CONTROL`.
- [ ] Buat Function `forceUnlockDevice(deviceId)` untuk kondisi darurat,
      dengan audit log wajib.
- [ ] Review modul pengaduan (HALO Spentgapa) — pastikan siswa hanya bisa
      `create` laporan miliknya sendiri, tidak bisa baca laporan siswa
      lain.

---

## FASE 7 — Audit Log Terpusat

- [ ] Buat collection `audit_logs` yang hanya bisa ditulis oleh Cloud
      Functions (Admin SDK), tidak bisa oleh client.
- [ ] Setiap Function sensitif di Fase 1–6 wajib menulis entry log:
      `{ actorUid, actorRole, action, targetSchoolId, targetId, timestamp, result }`.
- [ ] Buat halaman khusus `super_admin` untuk browse audit log — berguna
      untuk investigasi kalau ada laporan penyalahgunaan dari salah satu
      sekolah.

---

## FASE 8 — Security Rules

- [ ] Pastikan struktur path Firestore tenant-scoped:
      `schools/{schoolId}/...` supaya Rules bisa pakai
      `request.auth.token.schoolId` secara konsisten.
- [ ] Pola dasar Rules per collection sensitif:
  ```
  allow read: if request.auth.token.role in ['super_admin','admin','guru']
              && (request.auth.token.role == 'super_admin'
                  || request.auth.token.schoolId == resource.data.schoolId);
  allow write: if false; // semua tulis wajib lewat Cloud Function
  ```
- [ ] Untuk collection yang boleh ditulis langsung client (chat, interaksi
      ringan), tetap validasi `schoolId` + ownership secara eksplisit.
- [ ] Tulis Firestore Rules Unit Test untuk skenario: siswa sekolah A coba
      baca data sekolah B → ditolak; guru coba baca data kelas lain →
      ditolak; dst.

---

## FASE 9 — Testing & Staging

- [ ] Jalankan seluruh Function di Firebase Emulator Suite sebelum deploy
      ke project `dev`.
- [ ] Uji beban ringan: simulasikan beberapa sekolah submit absensi
      bersamaan (jam 07:00 biasanya serentak) — cek cold start &
      concurrency Cloud Functions.
- [ ] Rollout bertahap: mulai 1-2 sekolah pilot sebelum rollout penuh,
      supaya kalau ada bug enforcement, dampaknya terbatas (lihat
      `SITEPLAN_ALUR_KERJA.md` Tahap F).

---

## FASE 10 — Redeploy Workflow

- [ ] Setup `firebase deploy --only functions:<namaFunction>` untuk
      deploy granular per-function.
- [ ] Setup CI/CD (GitHub Actions) untuk auto-deploy ke `dev` saat push ke
      branch `develop`, dan manual-approve ke `production` saat merge ke
      `main`.
- [ ] Dokumentasikan cara rollback: `firebase functions:log` untuk cek
      error, redeploy versi commit sebelumnya kalau perlu.

---

## Prioritas Kalau Waktu Terbatas

Kalau tidak bisa kerjakan semua fase sekaligus, urutan prioritas
berdasarkan risiko keamanan tertinggi lebih dulu:

1. **Fase 1–2** (Auth Custom Claims + Policy helper) — fondasi semuanya,
   tanpa ini semua fase lain rapuh.
2. **Fase 3** (Absensi GPS) — paling gampang dimanipulasi kalau logikanya
   ada di client.
3. **Fase 8** (Security Rules) — tutup celah baca/tulis lintas sekolah,
   dampaknya langsung ke privasi data semua sekolah.
4. **Fase 5** (Virtual Pet) — motivasi manipulasi tinggi dari siswa tapi
   dampak keamanan data relatif rendah.
5. Fase lainnya menyusul.
