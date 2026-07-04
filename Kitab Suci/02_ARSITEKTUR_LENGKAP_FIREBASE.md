# ARSITEKTUR LENGKAP — Unified System di atas Firebase

Dokumen ini adalah gambaran teknis menyeluruh: bagaimana frontend, backend,
auth, database, storage, dan deployment disusun untuk seluruh sistem yang
berjalan di atas Firebase, untuk skala 50 sekolah dengan 1 kendali super
admin.

---

## 1. Peta Arsitektur Menyeluruh

```text
                         ┌───────────────────────────┐
                         │      FIREBASE AUTH        │
                         │  (Custom Claims: role,    │
                         │   schoolId, classId)      │
                         └─────────────┬─────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌───────────────┐           ┌────────────────────┐          ┌──────────────────┐
│   FRONTEND     │           │   CLOUD FUNCTIONS   │          │   FIRESTORE /     │
│  (5 aplikasi)  │◄─────────►│  (backend logic)    │◄────────►│   RTDB / STORAGE  │
└───────────────┘  callable  └────────────────────┘  Admin   └──────────────────┘
        │            HTTPS             │               SDK              │
        │                              ▼                                │
        │                    ┌────────────────────┐                     │
        │                    │  Cloud Scheduler /  │                     │
        │                    │  Pub/Sub (cron job) │                     │
        │                    └────────────────────┘                     │
        │                                                                │
        └───────────────── Security Rules (baca langsung) ───────────────┘
```

Tiga jalur komunikasi client ke backend:

1. **Auth** — login, refresh token, baca custom claims.
2. **Cloud Functions (`onCall`/HTTPS)** — semua operasi sensitif, lihat Bagian 4.
3. **Firestore/RTDB langsung** — hanya untuk baca, dan tulis data non-sensitif,
   dijaga Security Rules (Bagian 6).

---

## 2. Lapisan Frontend

Frontend tidak berubah dari struktur monorepo yang sudah ada
(`DETAIL_APLIKASI.md`), tapi setiap aplikasi punya tanggung jawab yang lebih
jelas terhadap backend Firebase.

### 2.1 Web Dashboard (`apps/web` — Next.js)

- Next.js App Router, TypeScript, TailwindCSS, Zustand.
- Firebase SDK (client) untuk: Auth (login), Firestore (baca dashboard/rekap),
  Storage (upload dokumen/foto).
- **Tidak** langsung menulis field sensitif (skor pet, status kehadiran, role) —
  semua lewat pemanggilan Cloud Function (`httpsCallable`).
- State role/schoolId diambil dari `getIdTokenResult()` setelah login, disimpan
  di Zustand store, dipakai untuk render UI sesuai hak akses (RBAC di Bagian 3
  dari `DETAIL_APLIKASI.md`) — **namun ini hanya untuk UX**, bukan pengganti
  validasi server.

### 2.2 Mobile App (`apps/mobile` — Expo/React Native)

- SQLite lokal untuk offline-first (log literasi, absensi draft).
- Firebase SDK untuk Auth + sinkronisasi Firestore/RTDB saat online.
- Alur absensi: GPS mentah + flag mock-provider dikumpulkan di device →
  dikirim ke Cloud Function `submitAttendance` saat online, **bukan** dihitung
  dan ditulis sendiri ke Firestore.
- Kalau offline: data disimpan dulu di SQLite lokal dengan status `pending_sync`,
  background worker memanggil Cloud Function begitu koneksi kembali.

### 2.3 Native Mobile Kotlin (`apps/native-mobile`)

- Jetpack Compose + Coroutines, Room/SQLite lokal, Firebase Realtime Database
  untuk fitur guru (absensi manual kelas) dan tatib (pencatatan pelanggaran).
- Sama seperti mobile Expo: input mentah dikirim ke Cloud Function, bukan
  ditulis langsung — khususnya untuk pencatatan poin pelanggaran yang
  mempengaruhi skor Virtual Pet.

### 2.4 EduLock CBT (`apps/EduLock`)

- Device Administration API untuk kiosk mode.
- Kontrol nyala/mati lock dipanggil dari Cloud Function `toggleEduLockAccess`
  (dipanggil admin dari web dashboard), device membaca status ini lewat RTDB
  listener realtime.
- Log aktivitas EduLock (percobaan keluar kiosk, dsb) ditulis ke RTDB oleh
  device, tapi keputusan "kunci ulang otomatis" tetap logic di Cloud Function
  yang memantau log tersebut (Firestore/RTDB trigger).

### 2.5 E-Perpustakaan (`apps/e-perpustakaan`)

- Statis (HTML/JS), Firebase Hosting.
- Baca katalog buku langsung dari Firestore (public read, sesuai Rules).
- Interaksi member (log baca, minat baca) lewat Cloud Function ringan kalau
  ingin nanti dihubungkan ke skor Virtual Pet (field "Lapar/Hunger").

---

## 3. Lapisan Auth (Identitas & Tenant)

Firebase Auth adalah satu-satunya sumber identitas di seluruh sistem.

### 3.1 Struktur Custom Claims

```json
{
  "role": "super_admin | admin | guru | siswa",
  "schoolId": "school_012 (null untuk super_admin)",
  "classId": "kelas_7a (opsional, khusus guru wali kelas)",
  "capabilities": ["ATTENDANCE_INPUT_MANUAL", "PET_REWARD_PENALTY"]
}
```

### 3.2 Alur Login

```text
1. User login (email/NPSN + password, atau metode lain) → Firebase Auth SDK
2. Auth mengembalikan ID Token (JWT) berisi custom claims
3. Client refresh token setelah login (getIdTokenResult(true)) untuk
   memastikan claims terbaru terbaca (claims baru butuh token refresh)
4. Client simpan role/schoolId di state lokal HANYA untuk keperluan UI
5. Setiap panggilan Cloud Function otomatis membawa ID Token di header —
   Function membaca claims dari context.auth.token, bukan dari body request
```

### 3.3 Siapa yang Boleh Mengubah Claims

- Hanya Cloud Function `assignRole` (dipanggil super_admin) yang boleh
  menulis custom claims lewat Admin SDK (`setCustomUserClaims`).
- Tidak ada jalur lain — client tidak pernah menulis claims sendiri.

### 3.4 Onboarding 50 Sekolah

- Super admin membuat akun Admin Sekolah baru lewat Function `createSchoolAdmin`
  — otomatis membuat dokumen `schools/{schoolId}` + set claims `role: admin,
  schoolId: <baru>`.
- Admin sekolah lalu membuat akun Guru/Siswa lewat Function `createSchoolUser`,
  di-assert bahwa `schoolId` yang dibuat harus sama dengan `schoolId` miliknya
  sendiri (tidak bisa membuat user untuk sekolah lain).

---

## 4. Lapisan Backend — Cloud Functions

Ini adalah "otak" sistem — semua logika keputusan dan enforcement akses
hidup di lapisan ini.

### 4.1 Struktur Folder

```text
functions/
├── src/
│   ├── index.ts                  # Entry point, export semua Function
│   ├── lib/
│   │   ├── policy.ts             # assertCapability, assertSchoolScope
│   │   ├── capabilities.ts       # Konstanta capability catalog
│   │   └── auditLog.ts           # Helper tulis audit_logs
│   ├── types/
│   │   └── index.ts              # Shared types (dipakai juga oleh frontend)
│   ├── auth/
│   │   ├── assignRole.ts
│   │   ├── createSchoolAdmin.ts
│   │   └── createSchoolUser.ts
│   ├── attendance/
│   │   ├── submitAttendance.ts   # onCall — validasi GPS + waktu
│   │   └── pruneOldAttendance.ts # scheduled — auto-prune bulanan
│   ├── pet/
│   │   ├── calculatePetDecay.ts  # scheduled — decay harian
│   │   ├── revivePet.ts          # onCall
│   │   └── rewardPenaltyBulk.ts  # onCall
│   ├── edulock/
│   │   └── toggleEduLockAccess.ts
│   └── discipline/
│       └── recordViolation.ts
├── package.json
└── tsconfig.json
```

### 4.2 Tiga Jenis Cloud Function yang Dipakai

| Jenis | Kegunaan | Contoh |
|---|---|---|
| **Callable (`onCall`)** | Dipanggil langsung dari client dengan auth context otomatis | `submitAttendance`, `revivePet`, `assignRole` |
| **Scheduled (Pub/Sub + Cloud Scheduler)** | Cron job, tidak dipicu client | `calculatePetDecay` (harian), `pruneOldAttendance` (bulanan) |
| **Firestore/RTDB Trigger** | Bereaksi otomatis saat data berubah | Auto-hitung ulang audit log, notifikasi saat poin pelanggaran ditulis |

### 4.3 Pola Wajib di Setiap Function Sensitif

```ts
export const submitAttendance = onCall(async (request) => {
  const { auth, data } = request;

  // 1. Wajib login
  if (!auth) throw new HttpsError('unauthenticated', 'Login required');

  // 2. Wajib capability check
  assertCapability(auth.token, 'ATTENDANCE_SELF_SUBMIT');

  // 3. Wajib tenant scope dari token, bukan dari body
  const schoolId = auth.token.schoolId;
  assertSchoolScope(schoolId);

  // 4. Logika bisnis di server
  const distance = haversine(schoolCoord, data.lat, data.lng);
  const status = decideStatus(distance, data.mockLocationFlag, Date.now());

  // 5. Tulis dengan Admin SDK
  await db.doc(`schools/${schoolId}/attendance/...`).set(...);

  // 6. Audit log
  await writeAuditLog(auth.uid, 'ATTENDANCE_SUBMIT', schoolId, status);

  return { status };
});
```

---

## 5. Lapisan Data — Firestore, RTDB, Storage

### 5.1 Firestore (data terstruktur jangka panjang)

Struktur path wajib tenant-scoped:

```text
schools/{schoolId}
schools/{schoolId}/students/{studentId}
schools/{schoolId}/teachers/{teacherId}
schools/{schoolId}/attendance/{yyyymm}/{studentId}
schools/{schoolId}/discipline/{recordId}
schools/{schoolId}/pets/{studentId}
schools/{schoolId}/library_tasks/{taskId}
schools/{schoolId}/halo_reports/{reportId}
schools/{schoolId}/seven_habits/{studentId}/{date}
audit_logs/{logId}                    # global, hanya ditulis Function
```

Super admin mengakses lintas `schoolId` lewat Function/query khusus dengan
claims `role: super_admin` (tidak dibatasi Rules per-schoolId).

### 5.2 Realtime Database (realtime, low-latency)

Dipakai khusus untuk data yang butuh update instan:

```text
/edulock_status/{schoolId}/{deviceId}     # lock/unlock realtime
/chat/{schoolId}/{threadId}/{messageId}
/presence/{schoolId}/{userId}             # online/offline status
```

### 5.3 Cloud Storage

```text
/schools/{schoolId}/students/{studentId}/photo.jpg
/schools/{schoolId}/library/covers/{bookId}.jpg
/schools/{schoolId}/discipline/evidence/{recordId}/{file}
```

Upload lewat client SDK boleh langsung (dengan Storage Rules validasi
schoolId + ownership), karena file upload umumnya bukan data keputusan.

---

## 6. Security Rules

### 6.1 Firestore Rules — pola dasar

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }
    function role() {
      return request.auth.token.role;
    }
    function sameSchool(schoolId) {
      return role() == 'super_admin' || request.auth.token.schoolId == schoolId;
    }

    match /schools/{schoolId} {

      match /students/{studentId} {
        allow read: if isSignedIn() && sameSchool(schoolId);
        allow write: if false; // wajib lewat Cloud Function
      }

      match /pets/{studentId} {
        allow read: if isSignedIn() && sameSchool(schoolId);
        allow write: if false; // skor pet hanya lewat Function
      }

      match /halo_reports/{reportId} {
        allow create: if isSignedIn()
          && sameSchool(schoolId)
          && request.resource.data.reporterId == request.auth.uid;
        allow read: if isSignedIn()
          && (role() in ['super_admin','admin']
              || (role() == 'guru' && sameSchool(schoolId)));
        allow update, delete: if false;
      }
    }

    match /audit_logs/{logId} {
      allow read: if isSignedIn() && role() in ['super_admin'];
      allow write: if false; // hanya Admin SDK dari Function
    }
  }
}
```

### 6.2 Realtime Database Rules — pola dasar

```json
{
  "rules": {
    "edulock_status": {
      "$schoolId": {
        ".read": "auth.token.role == 'super_admin' || auth.token.schoolId == $schoolId",
        ".write": false
      }
    },
    "chat": {
      "$schoolId": {
        ".read": "auth.token.schoolId == $schoolId",
        ".write": "auth.token.schoolId == $schoolId"
      }
    }
  }
}
```

### 6.3 Storage Rules — pola dasar

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /schools/{schoolId}/students/{studentId}/{file} {
      allow read: if request.auth.token.schoolId == schoolId;
      allow write: if request.auth.token.schoolId == schoolId
        && request.auth.token.role in ['admin','guru'];
    }
  }
}
```

---

## 7. Observability & Audit

- **Cloud Logging** (bawaan Firebase Functions) — semua `console.log`/error
  otomatis masuk log, bisa difilter per Function.
- **`audit_logs` collection** — jejak semua aksi sensitif (siapa, kapan,
  aksi apa, hasil apa), dibaca lewat panel khusus super admin di web dashboard.
- **Alerting** — set Cloud Monitoring alert untuk: error rate Function tinggi,
  quota Firestore mendekati batas, biaya bulanan melebihi threshold.
- **Firebase Performance Monitoring** — opsional, untuk pantau latency di
  aplikasi mobile/web.

---

## 8. CI/CD & Redeploy

```text
Push ke branch `develop`  → GitHub Actions → deploy ke Firebase project `dev`
Merge ke branch `main`    → GitHub Actions → deploy ke Firebase project `production`
                             (dengan manual approval step)
```

- Deploy granular: `firebase deploy --only functions:submitAttendance` untuk
  ubah satu Function tanpa redeploy semua.
- Deploy Rules terpisah: `firebase deploy --only firestore:rules,database:rules,storage:rules`.
- Firebase Emulator Suite dipakai wajib untuk uji lokal sebelum push ke `dev`.
- Environment terpisah (`dev` dan `production` project Firebase berbeda) —
  supaya eksperimen tidak menyentuh data 50 sekolah asli.

---

## 9. Ringkasan Prinsip

| Lapisan | Teknologi | Peran |
|---|---|---|
| Frontend | Next.js, Expo, Kotlin, HTML statis | Presentasi + input mentah, tanpa logika keputusan |
| Auth | Firebase Auth + Custom Claims | Identitas + tenant scope, sumber kebenaran role |
| Backend | Cloud Functions (callable/scheduled/trigger) | Semua logika keputusan & enforcement |
| Data | Firestore, RTDB, Storage | Penyimpanan, dengan Rules sebagai lapisan pertama |
| Observability | Cloud Logging, audit_logs, Monitoring | Deteksi anomali & jejak audit |
| Deployment | Firebase CLI + GitHub Actions | Redeploy granular, cepat, staged (dev → prod) |

Prinsip intinya satu: Firebase sebagai platform, dengan disiplin
backend-first sebagai cara kerja — client tidak pernah jadi sumber
kebenaran untuk data yang berkonsekuensi.
