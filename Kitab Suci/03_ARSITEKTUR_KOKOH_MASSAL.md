# ARSITEKTUR KOKOH — Firebase untuk Penggunaan Massal (50 Sekolah)

Dokumen ini adalah versi **hardened** dari `ARSITEKTUR_LENGKAP_FIREBASE.md`.
Fokusnya bukan lagi "bagaimana strukturnya", tapi **"bagaimana sistem ini tetap
benar dan tidak korup saat dipakai ribuan user bersamaan"** — dokumen ini
menutup celah supaya arsitektur benar-benar tahan beban nyata, bukan cuma
rapi di atas kertas.

Dibaca berurutan setelah: `ARSITEKTUR_LENGKAP_FIREBASE.md` → dokumen ini.

---

## 1. Skenario Beban Nyata yang Harus Diasumsikan

Sebelum bicara solusi, definisikan dulu beban yang harus tahan:

| Skenario | Perkiraan Beban | Titik Rawan |
|---|---|---|
| Jam masuk sekolah (06:45–07:15) | 50 sekolah × rata-rata 300–800 siswa submit absensi dalam window 30 menit | Cold start Function, write burst Firestore, kuota per-detik |
| Reward/penalty massal oleh admin | 1 admin memicu update ratusan dokumen pet sekaligus | Batch write limit (500/batch), timeout Function |
| Scheduled decay pet harian | 50 sekolah × ribuan siswa dihitung ulang tiap malam | Function timeout (default 60 detik, max 540 detik/9 menit) |
| Guru input nilai 7 KAIH massal per kelas | Puluhan write bersamaan dari 1 sesi guru | Race condition kalau ada trigger lanjutan |
| EduLock saat CBT nasional | Ratusan device polling status lock bersamaan | RTDB connection limit, listener storm |

Setiap solusi di bawah ini merujuk balik ke skenario ini.

---

## 2. Concurrency & Transaction Safety

**Masalah**: dua operasi menyentuh dokumen yang sama secara bersamaan bisa saling
menimpa (lost update), terutama pada skor Virtual Pet dan poin kedisiplinan yang
sifatnya inkremental.

**Solusi wajib**:

- Semua operasi yang **menambah/mengurangi** nilai (bukan overwrite) wajib pakai
  `runTransaction()` atau `FieldValue.increment()`, tidak boleh pola
  `read → hitung di kode → write`.

  ```ts
  // SALAH — race condition
  const pet = await petRef.get();
  const newHealth = pet.data().health + 10;
  await petRef.update({ health: newHealth });

  // BENAR — atomic, aman untuk concurrent write
  await petRef.update({ health: FieldValue.increment(10) });
  ```

- Untuk logika yang butuh baca-kondisi-lalu-tulis (misal: cek dulu apakah
  sudah DEAD sebelum apply decay lagi), wajib `runTransaction()`:

  ```ts
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(petRef);
    if (snap.data().status === 'DEAD') return; // guard di dalam transaksi
    tx.update(petRef, { health: FieldValue.increment(-delta) });
  });
  ```

- **Reward/penalty massal**: gunakan `BulkWriter` (Admin SDK), bukan loop
  `await update()` satu-satu — `BulkWriter` otomatis batching, retry, dan
  rate-limiting internal, jauh lebih tahan terhadap beban ratusan dokumen.

- Batas keras Firestore: **500 operasi per batch**. Kalau reward massal >500
  siswa (mungkin terjadi untuk aksi lintas sekolah oleh super admin), wajib
  dipecah jadi beberapa batch berurutan atau pakai `BulkWriter` yang otomatis
  menangani ini.

---

## 3. Idempotency (Kunci untuk Offline-First Mobile)

**Masalah**: mobile app offline-first bisa retry kirim data yang sama (koneksi
putus-nyambung saat submit absensi), berisiko double-write.

**Solusi wajib**:

- Setiap submit dari client wajib menyertakan **idempotency key** yang dibuat
  di device (UUID v4), disimpan di SQLite lokal bersama data pending.
  ```ts
  { idempotencyKey: "device-generated-uuid",
    studentId, lat, lng, mockLocationFlag, clientTimestamp }
  ```
- Cloud Function `submitAttendance` cek dulu: apakah `idempotencyKey` ini
  sudah pernah diproses (simpan di collection kecil `processed_requests`
  dengan TTL 24 jam)? Kalau sudah, kembalikan hasil yang sama tanpa
  eksekusi ulang — bukan error, bukan proses dobel.
  ```ts
  const existing = await db.doc(`processed_requests/${idempotencyKey}`).get();
  if (existing.exists) return existing.data().result; // idempotent short-circuit
  ```
- TTL policy di Firestore (`processed_requests`) diset otomatis-hapus
  setelah 24-48 jam lewat Firestore TTL feature, supaya collection ini
  tidak membengkak.

---

## 4. Batasan & Skalabilitas Cloud Functions

**Masalah**: default limit Cloud Functions bisa jadi bottleneck saat 50
sekolah aktif bersamaan.

**Solusi wajib**:

- Set **minimum instances** (`minInstances`) untuk Function kritis jam sibuk
  (`submitAttendance`) supaya tidak kena cold start tiap kali — trade-off
  biaya idle vs latency, worth it untuk window 06:45–07:15.
  ```ts
  export const submitAttendance = onCall(
    { minInstances: 2, concurrency: 80, memory: '256MiB' },
    async (request) => { ... }
  );
  ```
- Function scheduled berat (`calculatePetDecay` untuk ribuan siswa lintas
  50 sekolah) **jangan** diproses dalam satu invocation panjang — pecah
  jadi batch per-sekolah lewat Pub/Sub fan-out, supaya tidak kena timeout
  9 menit:
  ```text
  Scheduler (00:00) → publish 1 pesan Pub/Sub per schoolId (50 pesan)
    → tiap pesan trigger Function terpisah, proses 1 sekolah saja
  ```
- Set **timeout** eksplisit dan **retry policy** untuk scheduled Function
  (`retry: true` di Pub/Sub trigger) supaya kegagalan sementara (network
  blip) tidak berarti kehilangan proses hari itu.

---

## 5. Rate Limiting & Abuse Protection

**Masalah**: Cloud Function `onCall` yang dipanggil client bisa disalahgunakan
(spam submit absensi, brute-force GPS spoofing).

**Solusi wajib**:

- App Check (Firebase App Check) diaktifkan di semua aplikasi client —
  memastikan request datang dari aplikasi resmi, bukan script/curl luar.
- Rate limit per-user di level Function: simpan `lastAttemptAt` di
  dokumen kecil, tolak kalau ada percobaan submit berulang dalam
  interval sangat pendek (misal <5 detik) — indikasi spam/otomatisasi.
- Firestore Security Rules tetap jadi lapisan kedua: field-field sensitif
  tetap `allow write: if false` meskipun App Check aktif — pertahanan
  berlapis, bukan mengandalkan satu mekanisme saja.

---

## 6. Biaya & Kuota — Perhitungan Kasar untuk 50 Sekolah

Supaya tidak kaget tagihan, estimasi kasar (asumsi 500 siswa/sekolah rata-rata,
25.000 siswa total):

| Operasi | Frekuensi | Estimasi Firestore Ops/hari |
|---|---|---|
| Submit absensi | 1x/siswa/hari | ~25.000 writes |
| Baca dashboard admin/guru | Variatif | ~50.000–100.000 reads |
| Decay pet harian | 1x/siswa/hari (batched) | ~25.000 writes |
| Chat/RTDB | Realtime, volume tinggi tapi RTDB ditagih beda (bandwidth+storage, bukan per-op) | — |

- Firestore free tier: 50.000 reads, 20.000 writes per hari — **akan terlampaui**
  di skala ini, jadi wajib di Blaze plan dengan monitoring budget alert aktif
  (set budget alert di Google Cloud Billing, bukan cuma andalkan estimasi).
- Cloud Functions ditagih per-invocation + compute time — `minInstances`
  di Bagian 4 menambah biaya idle, harus dipantau tiap bulan apakah worth it.
- **Tindakan konkret**: aktifkan Budget Alert di Google Cloud Console
  (misal alert di 50%, 90%, 100% dari perkiraan bulanan) sebelum go-live
  ke 50 sekolah, bukan setelah tagihan datang.

---

## 7. Backup & Disaster Recovery

**Masalah**: belum ada strategi kalau data korup/terhapus tidak sengaja.

**Solusi wajib**:

- Aktifkan **Firestore scheduled export** (Point-in-Time Recovery / daily
  export ke Cloud Storage bucket) — minimal harian, retensi 30 hari.
  ```bash
  gcloud firestore export gs://<backup-bucket>/$(date +%Y%m%d) --async
  ```
  Dijadwalkan lewat Cloud Scheduler + Cloud Function trigger, atau
  Firestore PITR (Point-in-Time Recovery) bawaan kalau tier mendukung.
- **Audit log tidak boleh jadi satu-satunya cara rollback** — audit log
  untuk investigasi "apa yang terjadi", backup export untuk "kembalikan
  ke kondisi sebelumnya".
- Tulis SOP recovery tertulis: siapa yang berwenang restore, dari backup
  mana, berapa lama estimasi downtime saat restore — ini harus ada
  **sebelum** insiden terjadi, bukan didesain saat panik.
- Storage (foto siswa, bukti pelanggaran) — aktifkan **Object Versioning**
  di Cloud Storage bucket supaya file yang tertimpa/terhapus bisa
  dikembalikan.

---

## 8. Testing Strategy Bertingkat

Supaya "kokoh" ini bisa dibuktikan, bukan diasumsikan:

1. **Unit test** — `assertCapability`, `assertSchoolScope`, kalkulasi
   Haversine, logika decay pet. Jalankan di CI setiap push.
2. **Rules unit test** (`@firebase/rules-unit-testing`) — skenario lintas
   sekolah, lintas role, wajib lulus sebelum merge Rules baru.
3. **Emulator integration test** — jalankan Function + Firestore emulator
   bersamaan, simulasikan alur penuh submit absensi dari awal sampai
   audit log tertulis.
4. **Load test** — sebelum rollout ke 50 sekolah, simulasikan beban jam
   07:00 memakai tool seperti `k6` atau `artillery` menembak Function
   `submitAttendance` dengan volume setara beban nyata (mis. 5.000
   request dalam 15 menit) di project `dev`. Amati: error rate, latency
   p95/p99, apakah `minInstances` cukup.
5. **Chaos/failure test** — matikan koneksi di tengah proses mobile,
   pastikan idempotency key mencegah double-write; matikan satu Function
   scheduled di tengah proses, pastikan retry policy menyelesaikannya.

---

## 9. Rollout Strategy — Jangan Langsung 50 Sekolah

Ini pengulangan penting dari checklist sebelumnya, tapi harus eksplisit
sebagai bagian dari "kokoh":

```text
Tahap 1: 1 sekolah pilot (idealnya SMPN 3 Pacet sendiri, data asli)
   → jalan 2-4 minggu, pantau error log & audit log harian

Tahap 2: 5 sekolah tambahan (mix ukuran kecil-besar)
   → validasi asumsi beban di Bagian 1 dengan data nyata, bukan estimasi

Tahap 3: 15 sekolah
   → validasi biaya nyata (Bagian 6) vs estimasi, sesuaikan minInstances

Tahap 4: sisa 50 sekolah, bertahap per gelombang
   → hanya setelah Tahap 1-3 tanpa insiden data korup/hilang
```

**Aturan keras**: jangan naik tahap kalau masih ada open issue kategori
"data salah/hilang/korup" dari tahap sebelumnya, meski kecil.

---

## 10. Monitoring & Alert Threshold Konkret

Bukan cuma "aktifkan monitoring", tapi angka nyata untuk 50 sekolah:

| Metrik | Threshold Alert |
|---|---|
| Function error rate | > 1% dalam window 5 menit |
| Function latency p95 | > 3 detik untuk `onCall` sensitif |
| Firestore write ops | > 80% kuota harian terpakai sebelum jam 12 siang |
| Budget bulanan | 50%, 90%, 100% dari estimasi Bagian 6 |
| Failed scheduled Function | Retry habis tanpa sukses → alert langsung, karena berarti decay/prune 1 sekolah gagal hari itu |
| Auth anomaly | Login gagal beruntun dari 1 akun (indikasi brute-force) |

---

## 11. Checklist "Sudah Kokoh" — Definition of Done

Arsitektur ini baru boleh disebut **sekokoh V1** kalau semua berikut checklist
(bukan sekadar didesain, tapi **dijalankan dan lulus**):

- [ ] Semua operasi inkremental pakai `FieldValue.increment()`/`runTransaction()`
- [ ] Idempotency key diimplementasi dan diuji untuk retry offline
- [ ] `minInstances` diset untuk Function jam sibuk, diuji dengan load test
- [ ] Scheduled Function berat dipecah per-sekolah (Pub/Sub fan-out)
- [ ] App Check aktif di semua client
- [ ] Budget alert aktif di Google Cloud Billing
- [ ] Firestore scheduled export aktif, sudah dicoba proses restore minimal 1x
- [ ] Rules unit test lulus untuk semua skenario lintas-tenant
- [ ] Load test jam sibuk (07:00) lulus dengan error rate < 1%
- [ ] Rollout Tahap 1 (1 sekolah) berjalan minimal 2 minggu tanpa insiden data
- [ ] SOP recovery tertulis dan sudah disimulasikan minimal 1x (bukan cuma teori)

Sebelum semua kotak ini tercentang, anggap sistem ini **belum boleh diklaim
kokoh** — statusnya masih "desain matang, pembuktian berjalan".
