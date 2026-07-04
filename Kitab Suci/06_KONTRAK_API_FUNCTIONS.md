# KONTRAK API — Cloud Functions Unified System

Dokumen ini adalah **sumber kebenaran tunggal** untuk semua Cloud Function
yang dipanggil dari client (web maupun mobile). Setiap kali ada Function
baru atau perubahan skema, dokumen ini **wajib diupdate di PR yang sama**
— jangan biarkan kontrak dan kode berbeda.

Prinsip: tim frontend/mobile membaca dokumen ini untuk tahu apa yang bisa
dipanggil, tanpa perlu baca kode backend. Tim backend membaca ini untuk
tahu kontrak yang tidak boleh dilanggar tanpa koordinasi.

---

## 0. Konvensi Umum

### 0.1 Format Semua Response

```ts
// Sukses
{ success: true, data: T }

// Gagal (dilempar sebagai HttpsError, ditangkap otomatis oleh SDK)
{ code: string, message: string }
```

### 0.2 Kode Error Standar

| Code | Kapan Dipakai |
|---|---|
| `unauthenticated` | Tidak ada auth token / token invalid |
| `permission-denied` | Login valid tapi role/capability tidak cukup |
| `invalid-argument` | Payload tidak sesuai skema (field kosong, tipe salah) |
| `not-found` | Dokumen/entitas yang direferensikan tidak ada |
| `failed-precondition` | Kondisi bisnis tidak terpenuhi (misal: sekolah nonaktif) |
| `resource-exhausted` | Rate limit tercapai |
| `already-exists` | Duplikasi entitas yang harus unik |
| `internal` | Error tak terduga di server |

Frontend/mobile **wajib** menangani minimal `unauthenticated`,
`permission-denied`, dan `invalid-argument` secara eksplisit di setiap
pemanggilan — bukan cuma tampilkan pesan generik.

### 0.3 Header/Context Otomatis

Setiap Function `onCall` otomatis menerima:
- `context.auth.uid` — UID user pemanggil
- `context.auth.token.role`, `.schoolId`, `.classId`, `.capabilities` —
  dari Custom Claims, **tidak pernah dikirim manual di payload**

### 0.4 Idempotency

Function yang ditandai **[IDEMPOTENT]** di bawah **wajib** menerima field
`idempotencyKey: string` (UUID v4 dibuat di client) di payload. Memanggil
ulang dengan key yang sama akan mengembalikan hasil pertama tanpa
eksekusi ulang. Lihat `ARSITEKTUR_KOKOH_MASSAL.md` Bagian 3.

### 0.5 Penamaan Capability

Format: `MODUL_AKSI`, huruf kapital, snake_case. Contoh: `ATTENDANCE_INPUT_MANUAL`,
`PET_REWARD_PENALTY`. Daftar lengkap ada di `functions/src/lib/capabilities.ts`
— dokumen ini merujuk nama capability-nya, definisi teknisnya di kode.

---

## 1. Modul Auth

### 1.1 `assignRole` — [onCall]
Menetapkan role, schoolId, classId, dan capabilities ke user lain.

**Capability**: `ROLE_ASSIGN` (hanya `super_admin`)

```ts
// Request
{
  targetUid: string;
  role: "admin" | "guru" | "siswa";
  schoolId: string;
  classId?: string;
  capabilities?: string[];
}

// Response
{ success: true; data: { uid: string; claimsSet: object } }
```

**Error khusus**: `not-found` kalau `targetUid` tidak ada di Firebase Auth.

---

### 1.2 `createSchoolAdmin` — [onCall]
Membuat sekolah baru sekaligus akun admin pertamanya.

**Capability**: `SCHOOL_CREATE` (hanya `super_admin`)

```ts
// Request
{
  schoolName: string;
  npsn: string;
  adminEmail: string;
  adminInitialPassword: string; // wajib diganti saat login pertama
}

// Response
{
  success: true;
  data: { schoolId: string; adminUid: string }
}
```

**Error khusus**: `already-exists` kalau `npsn` sudah terdaftar.

**Efek samping**: membuat dokumen `schools/{schoolId}`, menulis `audit_logs`.

---

### 1.3 `createSchoolUser` — [onCall]
Admin sekolah membuat akun guru/siswa untuk sekolahnya sendiri.

**Capability**: `USER_CREATE`

```ts
// Request
{
  role: "guru" | "siswa";
  name: string;
  email: string;
  classId?: string; // wajib untuk siswa, opsional untuk guru wali kelas
}

// Response
{ success: true; data: { uid: string } }
```

**Aturan wajib server-side**: `schoolId` diambil dari `context.auth.token.schoolId`
pemanggil, **tidak boleh** dikirim dari client — mencegah admin sekolah A
membuat user untuk sekolah B.

---

### 1.4 `changePassword` — [onCall]

```ts
// Request
{ oldPassword: string; newPassword: string }

// Response
{ success: true; data: { requiresPasswordChange: false } }
```

---

## 2. Modul Attendance

### 2.1 `submitAttendance` — [onCall] [IDEMPOTENT]
Siswa submit absensi mandiri.

**Capability**: `ATTENDANCE_SELF_SUBMIT`

```ts
// Request
{
  idempotencyKey: string;
  lat: number;
  lng: number;
  mockLocationFlag: boolean; // dari device, keputusan tetap di server
}

// Response
{
  success: true;
  data: {
    status: "PRESENT" | "LATE";
    distanceMeters: number;
    serverTimestamp: string; // ISO 8601, dari waktu server bukan device
  }
}
```

**Error khusus**:
- `failed-precondition` — GPS palsu terdeteksi, atau jarak > 100 meter
  (pesan berbeda untuk tiap kasus, lihat detail di kode agar UI bisa
  menampilkan pesan yang sesuai — jangan digabung jadi satu pesan generik)

**Catatan wajib untuk mobile**: field `idempotencyKey` harus persis sama
untuk retry request yang sama (lihat `STRUKTUR_FOLDER_MOBILE.md` Bagian 2).

---

### 2.2 `manualAttendanceInput` — [onCall]
Guru input absensi manual untuk kelasnya.

**Capability**: `ATTENDANCE_INPUT_MANUAL`

```ts
// Request
{
  studentId: string;
  status: "PRESENT" | "LATE" | "ALPHA" | "IZIN" | "SAKIT";
  date: string; // YYYY-MM-DD
  note?: string;
}

// Response
{ success: true; data: { attendanceId: string } }
```

**Aturan wajib server-side**: `assertSchoolScope` + cek `studentId` ada di
`classId` yang sama dengan guru pemanggil (bukan cuma sekolah yang sama).

---

### 2.3 `pruneOldAttendance` — [scheduled, bulanan]
Tidak dipanggil client. Dijadwalkan Cloud Scheduler, fan-out per `schoolId`.

```ts
// Trigger payload (internal, dari Pub/Sub)
{ schoolId: string; monthToPrune: string } // YYYY-MM
```

Tidak ada response ke client — hasil dicatat di `audit_logs` dan
Cloud Logging.

---

## 3. Modul Virtual Pet

### 3.1 `calculatePetDecay` — [scheduled, harian]
Tidak dipanggil client. Fan-out per `schoolId`.

```ts
{ schoolId: string }
```

---

### 3.2 `revivePet` — [onCall]

**Capability**: `PET_REVIVE`

```ts
// Request
{ studentId: string; reason: string }

// Response
{ success: true; data: { newStatus: "ALIVE"; level: 1; xp: 0 } }
```

**Wajib**: tulis `audit_logs` (siapa revive, kapan, siswa mana, alasan).

---

### 3.3 `rewardPenaltyBulk` — [onCall]

**Capability**: `PET_REWARD_PENALTY`

```ts
// Request
{
  studentIds: string[]; // maksimal 500 per panggilan, lihat catatan
  type: "REWARD" | "PENALTY";
  field: "health" | "happiness" | "energy" | "hunger";
  amount: number; // positif, arah ditentukan oleh `type`
  reason: string;
}

// Response
{
  success: true;
  data: { affectedCount: number; failedIds: string[] }
}
```

**Catatan wajib**: kalau `studentIds.length > 500`, Function menolak
dengan `invalid-argument` — client harus memecah jadi beberapa panggilan
(lihat `ARSITEKTUR_KOKOH_MASSAL.md` Bagian 2 soal batas batch Firestore).

---

## 4. Modul Discipline

### 4.1 `recordViolation` — [onCall]

**Capability**: `DISCIPLINE_RECORD`

```ts
// Request
{
  studentId: string;
  violationType: string; // merujuk ke katalog jenis pelanggaran
  points: number;
  note?: string;
}

// Response
{ success: true; data: { recordId: string; totalPointsThisSemester: number } }
```

**Efek samping**: otomatis trigger pengurangan `happiness` di dokumen pet
siswa terkait (lewat `FieldValue.increment`, bukan read-modify-write).

---

## 5. Modul EduLock

### 5.1 `toggleEduLockAccess` — [onCall]

**Capability**: `EDULOCK_CONTROL`

```ts
// Request
{ schoolId: string; enabled: boolean; scope: "ALL_DEVICES" | string[] }

// Response
{ success: true; data: { affectedDeviceCount: number } }
```

### 5.2 `forceUnlockDevice` — [onCall]

**Capability**: `EDULOCK_FORCE_UNLOCK` (kondisi darurat, audit log wajib)

```ts
// Request
{ deviceId: string; reason: string }

// Response
{ success: true; data: { deviceId: string; unlockedAt: string } }
```

---

## 6. Shared Types (Ringkasan)

Definisi lengkap ada di `functions/src/types/index.ts`, diimpor ulang oleh
`src/types/shared.ts` (web) dan `src/types/shared.ts` (mobile). Jangan
duplikasi manual — kalau tipe berubah, ubah di satu tempat ini saja.

```ts
export type Role = "super_admin" | "admin" | "guru" | "siswa";

export type AttendanceStatus = "PRESENT" | "LATE" | "ALPHA" | "IZIN" | "SAKIT";

export interface CustomClaims {
  role: Role;
  schoolId: string | null;
  classId?: string;
  capabilities?: string[];
}

export interface AuditLogEntry {
  actorUid: string;
  actorRole: Role;
  action: string;
  targetSchoolId: string;
  targetId?: string;
  timestamp: string;
  result: "success" | "failure";
}
```

---

## 7. Status Implementasi

Diupdate setiap kali satu Function selesai dibuat dan lulus unit test.

| Function | Status | Catatan |
|---|---|---|
| `assignRole` | ⬜ Belum dibuat | Fondasi — prioritas pertama |
| `createSchoolAdmin` | ⬜ Belum dibuat | |
| `createSchoolUser` | ⬜ Belum dibuat | |
| `changePassword` | ⬜ Belum dibuat | |
| `submitAttendance` | ⬜ Belum dibuat | Prioritas kedua, wajib load test |
| `manualAttendanceInput` | ⬜ Belum dibuat | |
| `pruneOldAttendance` | ⬜ Belum dibuat | |
| `calculatePetDecay` | ⬜ Belum dibuat | |
| `revivePet` | ⬜ Belum dibuat | |
| `rewardPenaltyBulk` | ⬜ Belum dibuat | |
| `recordViolation` | ⬜ Belum dibuat | |
| `toggleEduLockAccess` | ⬜ Belum dibuat | |
| `forceUnlockDevice` | ⬜ Belum dibuat | |

*(Ganti ⬜ jadi ✅ + tanggal + nama PR setiap Function selesai diimplementasi.)*

---

## 8. Aturan Perubahan Kontrak

1. Perubahan **menambah field opsional baru** — boleh langsung, tidak
   breaking, tapi tetap update dokumen ini di PR yang sama.
2. Perubahan **mengubah tipe field atau menghapus field** — breaking
   change, wajib dikoordinasikan dengan siapa pun yang sedang kerja di
   web/mobile sebelum merge, karena bisa mematahkan client yang sudah ada.
3. Function baru — wajib didaftarkan di dokumen ini **sebelum** PR
   dianggap selesai, bukan ditambahkan belakangan "kalau sempat".
4. Kalau ragu apakah suatu perubahan breaking atau tidak — anggap breaking,
   koordinasikan dulu.
