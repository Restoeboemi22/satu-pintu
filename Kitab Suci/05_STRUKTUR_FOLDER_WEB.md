# STRUKTUR FOLDER — Web Dashboard (Firebase Project Root)

Berdasarkan screenshot folder `Sekolahan (D:)/Satu Pintu/web`, folder ini
**sudah benar sebagai root project Firebase** — terbukti dari `.firebaserc`
dan `firebase.json` yang ada langsung di level ini. Struktur di bawah ini
melengkapi folder yang sudah ada, mengikuti urutan `SITEPLAN_ALUR_KERJA.md`
(Tahap A → B → C).

**Prinsip:** folder `web/` ini tetap dipakai (sudah teruji), kita hanya
menambah apa yang belum ada dan merapikan `src/` sesuai modul.

---

## 1. Struktur Lengkap Target

```text
web/                                   ← root Firebase project (sudah ada)
├── .firebaserc                        ← sudah ada
├── firebase.json                      ← sudah ada, perlu ditambah config functions/rules
├── firestore.rules                    ← BARU — Security Rules Firestore
├── firestore.indexes.json             ← BARU — index composite (butuh untuk query per-schoolId)
├── storage.rules                      ← BARU — Security Rules Storage
├── database.rules.json                ← BARU — Security Rules RTDB
│
├── functions/                         ← BARU — seluruh backend Cloud Functions
│   ├── package.json
│   ├── tsconfig.json
│   ├── .eslintrc.json
│   └── src/
│       ├── index.ts                   ← entry point, export semua Function
│       ├── lib/
│       │   ├── policy.ts              ← assertCapability, assertSchoolScope
│       │   ├── capabilities.ts        ← konstanta capability catalog
│       │   └── auditLog.ts            ← helper tulis audit_logs
│       ├── types/
│       │   └── index.ts               ← shared types (diimpor juga oleh src/ Next.js)
│       ├── auth/
│       │   ├── assignRole.ts
│       │   ├── createSchoolAdmin.ts
│       │   └── createSchoolUser.ts
│       ├── attendance/
│       │   ├── submitAttendance.ts
│       │   ├── manualAttendanceInput.ts
│       │   └── pruneOldAttendance.ts
│       ├── pet/
│       │   ├── calculatePetDecay.ts
│       │   ├── revivePet.ts
│       │   └── rewardPenaltyBulk.ts
│       ├── discipline/
│       │   └── recordViolation.ts
│       └── edulock/
│           └── toggleEduLockAccess.ts
│
├── public/                            ← sudah ada
├── scripts/                           ← sudah ada
│
├── src/                                ← sudah ada, DIRAPIKAN mengikuti modul
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    ← landing/redirect ke login
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── dashboard/
│   │       ├── layout.tsx              ← guard: cek claims, redirect kalau tidak sesuai role
│   │       ├── super/                  ← TAHAP B — hanya super_admin
│   │       │   ├── page.tsx            ← ringkasan lintas sekolah
│   │       │   ├── schools/
│   │       │   │   ├── page.tsx        ← daftar sekolah
│   │       │   │   └── [schoolId]/page.tsx
│   │       │   ├── audit-log/
│   │       │   │   └── page.tsx
│   │       │   └── edulock/
│   │       │       └── page.tsx
│   │       ├── students/               ← TAHAP C.1
│   │       │   ├── page.tsx
│   │       │   └── [studentId]/page.tsx
│   │       ├── teachers/               ← TAHAP C.1
│   │       │   └── page.tsx
│   │       ├── attendance/             ← TAHAP C.2
│   │       │   └── page.tsx
│   │       ├── attendance-report/      ← TAHAP C.2
│   │       │   └── page.tsx
│   │       ├── discipline/             ← TAHAP C.3
│   │       │   └── page.tsx
│   │       ├── virtual-pet/            ← TAHAP C.4
│   │       │   └── page.tsx
│   │       ├── library/                ← TAHAP C.5
│   │       │   └── page.tsx
│   │       ├── halo-spentgapa/         ← TAHAP C.6
│   │       │   └── page.tsx
│   │       └── seven-habits/           ← TAHAP C.7
│   │           └── page.tsx
│   │
│   ├── components/
│   │   ├── ui/                         ← komponen visual generik (button, table, modal)
│   │   └── dashboard/                  ← komponen spesifik dashboard (sidebar, role-guard)
│   │
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── client.ts               ← init Firebase SDK client
│   │   │   ├── auth.ts                 ← helper getIdTokenResult, listener auth state
│   │   │   └── functions.ts            ← helper httpsCallable wrapper
│   │   └── utils/
│   │
│   ├── store/                          ← Zustand store (role, schoolId, user state)
│   │   └── authStore.ts
│   │
│   └── types/
│       └── shared.ts                   ← idealnya re-export dari functions/src/types
│
├── .eslintrc.json                     ← sudah ada
├── next.config.mjs                    ← sudah ada
├── next-env.d.ts                      ← sudah ada
├── package.json                       ← sudah ada
├── package-lock.json                  ← sudah ada
├── postcss.config.js                  ← sudah ada
├── README.md                          ← sudah ada
├── tailwind.config.ts                 ← sudah ada
├── tsconfig.json                      ← sudah ada
├── .gitignore                         ← PERIKSA — lihat Bagian 3 (kritis)
└── service-account.json               ← LIHAT PERINGATAN Bagian 3
```

---

## 2. Update `firebase.json` yang Diperlukan

File `firebase.json` yang sudah ada perlu mencakup semua layanan, bukan
cuma hosting. Bentuk lengkapnya kira-kira:

```json
{
  "hosting": {
    "public": "out",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"]
  },
  "functions": {
    "source": "functions",
    "predeploy": ["npm --prefix functions run build"]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "database": {
    "rules": "database.rules.json"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "database": { "port": 9000 },
    "storage": { "port": 9199 },
    "ui": { "enabled": true }
  }
}
```

Sesuaikan `hosting.public` dengan output build Next.js kamu (`out` kalau
static export, atau pakai Firebase Web Frameworks integration kalau pakai
SSR — cek dulu mode Next.js yang dipakai sebelum isi bagian ini).

---

## 3. PERINGATAN KRITIS — `service-account.json`

File ini terlihat ada langsung di root folder `web/` pada screenshot kamu.
Ini **file paling sensitif** di seluruh proyek — siapa pun yang memegangnya
punya akses Admin SDK penuh ke semua data Firebase kamu, lintas 50 sekolah.

Tindakan wajib sebelum lanjut:

- [ ] Cek `.gitignore` — pastikan `service-account.json` ada di dalamnya.
      Kalau file ini pernah ter-commit ke Git (bahkan di masa lalu, sudah
      dihapus sekarang), riwayatnya di Git history tetap menyimpan isinya
      — kredensial itu harus dianggap bocor dan **wajib di-revoke +
      generate ulang** dari Firebase Console (Project Settings → Service
      Accounts).
- [ ] Jangan simpan file ini di folder yang di-sync otomatis ke cloud
      publik/shared drive tanpa enkripsi.
- [ ] Untuk kebutuhan development lokal, pertimbangkan pakai
      `firebase emulators` + Application Default Credentials daripada
      selalu load service account asli.
- [ ] Untuk production (CI/CD), simpan isi file ini sebagai **encrypted
      secret** di GitHub Actions (`secrets.FIREBASE_SERVICE_ACCOUNT`),
      bukan sebagai file di repository.

---

## 4. Urutan Membuat Folder Baru (Ikuti Tahap A dari Siteplan)

Jangan buat semua folder sekaligus. Urutan konkret:

1. `firestore.rules`, `storage.rules`, `database.rules.json` — isi dengan
   default deny dulu (`allow read, write: if false`), supaya tidak ada
   window terbuka sejak awal.
2. `functions/` — init dengan `firebase init functions` (pilih TypeScript),
   lalu buat `lib/policy.ts` dan `lib/capabilities.ts` sebagai file pertama
   sebelum satu pun Function bisnis ditulis.
3. `src/lib/firebase/` — setup client SDK + auth helper di sisi Next.js.
4. Baru mulai `src/app/dashboard/super/` (Tahap B), diikuti modul C.1
   dst sesuai urutan di `SITEPLAN_ALUR_KERJA.md`.

---

## 5. Catatan tentang `scripts/`

Folder `scripts/` yang sudah ada cocok dipakai untuk:
- Script seed data dummy untuk testing (`scripts/seed-dev-data.ts`).
- Script one-off migrasi data (kalau nanti ada perubahan struktur Firestore).
- Script export/backup manual (memanggil `gcloud firestore export`).

Pisahkan dari `functions/` karena script ini dijalankan manual dari lokal/CI,
bukan Function yang di-deploy ke Firebase.
