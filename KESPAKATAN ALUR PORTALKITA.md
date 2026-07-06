# Kesepakatan Alur PortalKita

Dokumen ini mengunci kesepakatan kerja selama pembangunan aplikasi `PortalKita` agar struktur super admin, admin sekolah, dan modul turunan selalu konsisten.

## 1. Nama dan Konsep Utama

- Nama web utama adalah `PortalKita`.
- Setelah pengguna login ke `PortalKita`, pengguna tidak merasa pindah aplikasi secara liar.
- Semua modul utama tampil sebagai bagian dari satu portal yang sama.

## 2. Menu Utama Portal

Menu inti portal yang menjadi fondasi bersama adalah:

- `DATABASE`
- `GAS`
- `EduLock`

Menu konteks aktif per role yang berlaku pada source saat ini:

- `super admin`: `DATABASE`, `GAS`, `EduLock`, `Status Layanan Sekolah`
- `admin sekolah`: `DATABASE`, `GAS`, `EduLock`, `Lentera Digital`

Artinya, kerangka portal tetap sama, tetapi menu keempat mengikuti ruang kerja utama yang memang dipakai role tersebut.

## 2.1 Identitas Visual Dashboard Satu Pintu

- blok header/sidebar portal utama harus memakai label `Dashboard Satu Pintu`,
- ikon untuk blok header/sidebar portal utama harus memakai identitas `PortalKita` / dashboard utama, bukan ikon modul `GAS`,
- sublabel pada blok header/sidebar mengikuti role aktif (`Super Admin` atau `Admin Sekolah`),
- modul khusus seperti `Status Layanan Sekolah` tetap mengikuti struktur visual header/sidebar portal utama versi V1,
- untuk `Status Layanan Sekolah`, blok logo/header kiri atas boleh memakai ikon activity khusus modul selama layout dan tipografinya tetap konsisten,
- treatment icon/warna khusus boleh dipakai di area konten, kartu menu, dan blok logo/header kiri atas modul khusus,
- untuk kebutuhan kesamaan visual 1:1 dengan V1, aset ikon/logo harus diambil langsung dari repo referensi bila tersedia,
- item menu `Status Layanan Sekolah` di sidebar memakai aset final yang sudah disetujui pengguna, yaitu `status-layanan-sekolah.png`, agar hasil visual mengikuti acuan V1 yang dipilih pengguna.

## 3. Peran dan Tanggung Jawab

### 3.1 Super Admin

Super admin adalah pemegang **data induk pusat** seluruh sekolah.

Tanggung jawab utama super admin:

- membuat dan mengelola data induk sekolah,
- membuka dan menutup status tenant sekolah,
- membuat dan memonitor akun admin sekolah,
- membuat dan memonitor akun kepala sekolah,
- memantau status layanan lintas sekolah,
- mengontrol kebijakan global lintas tenant.

Super admin **tidak** dipakai untuk mengelola user operasional harian di dalam sekolah satu per satu, kecuali data induknya.

### 3.2 Admin Sekolah

Admin sekolah adalah pengelola operasional untuk sekolahnya sendiri.

Tanggung jawab utama admin sekolah:

- mengelola user internal sekolah,
- mengelola database siswa, guru, staff, dan struktur kelas,
- menjalankan operasional GAS untuk sekolahnya,
- masuk ke EduLock melalui PortalKita sesuai hak akses sekolahnya,
- memantau status layanan yang berkaitan dengan sekolahnya sendiri.

Admin sekolah tidak boleh mengubah data induk sekolah lain.

Catatan penting:

- akun admin sekolah yang diatur dari menu `DATABASE` super admin adalah akun yang dipakai untuk login admin seluruh sekolah pada **web PortalKita**,
- akun ini adalah pintu masuk admin sekolah ketika login di web, bukan akun kepala sekolah APK,
- halaman login `PortalKita` di web hanya untuk `super admin` dan `admin sekolah`,
- login `guru` dan `siswa` tidak ditampilkan sebagai halaman login web PortalKita,
- autentikasi `guru` dan `siswa` dipakai untuk flow **APK Android**, bukan pintu masuk utama web admin,
- username login admin sekolah adalah `NPSN`,
- password awal login admin sekolah adalah `admin123`,
- setelah login pertama dengan password awal, admin sekolah wajib mengganti password,
- aksi super admin `Reset Default` harus mengembalikan akun admin sekolah ke aturan awal: username `NPSN`, password `admin123`, dan status wajib ganti password,
- jalur bootstrap login pertama hanya boleh menyiapkan akun admin sekolah yang memang belum ada,
- akun admin sekolah yang sudah pernah hidup tidak boleh diam-diam dikembalikan ke `admin123` dari halaman login; reset default hanya sah bila dijalankan dari panel super admin yang terautentikasi.

### 3.3 Kepala Sekolah

Kepala sekolah adalah akun khusus yang terikat ke satu sekolah.

Aturan utamanya:

- akun kepala sekolah dibuat oleh super admin,
- akun kepala sekolah selalu punya `schoolId` yang valid,
- akun kepala sekolah tidak boleh berdiri tanpa data induk sekolah,
- jika sekolah dinonaktifkan, akses kepala sekolah ikut terdampak.

Penegasan penggunaan:

- akun kepala sekolah yang dibuat oleh super admin adalah akun akses kepala sekolah untuk login di **APK GAS**,
- alur APK GAS untuk kepala sekolah sudah aktif di repo `native-mobile` dan dipakai untuk login ke varian `GAS Kepala Sekolah`,
- login kepala sekolah wajib tenant-aware: input `Kode Sekolah / NPSN` harus dipetakan ke tenant sekolah yang sama, dan akun principal hanya boleh lolos bila `schoolId`/`npsn` cocok dengan sekolah yang dipilih,
- data akun kepala sekolah yang dibuat super admin di `principal_accounts` harus tetap sinkron dengan identitas sekolah induk, termasuk `schoolId`, `schoolName`, dan `npsn`,
- bila user login memakai `NPSN`, maka data sekolah induk dan akun principal tidak boleh membiarkan `npsn` kosong karena itu akan memutus resolusi tenant di APK.

### 3.4 Pegangan Teknis Android Native

Untuk pekerjaan Android native/APK:

- folder acuan teknis mobile ada di `D:\Satu Pintu\native-mobile`,
- file `D:\Satu Pintu\native-mobile\README.md` adalah pegangan teknis resmi untuk domain Android native,
- README tersebut menjadi rujukan awal untuk asal porting, struktur fondasi mobile, daftar file sensitif build yang memang harus disiapkan manual, dan status bahwa fondasi native saat ini masih perlu penyelarasan bertahap dengan arsitektur repo utama,
- pada layar Android native berbasis Compose, aset visual yang dirender dengan `painterResource` harus memakai drawable vector biasa atau aset raster yang kompatibel (`png/jpg/webp`), bukan adaptive launcher icon `mipmap`,
- semua pekerjaan APK tetap wajib tunduk pada aturan bisnis, role, login, dan multi-tenancy yang dikunci di dokumen kesepakatan ini.

## 4. Arsitektur Menu Super Admin

Menu `DATABASE` untuk super admin adalah **pusat data induk**.

Submenu final tahap 1:

- `Sekolah & Tenant`
- `Admin Sekolah`
- `Akun Kepala Sekolah`
- `Monitoring Akun & Layanan`

### 4.1 Sekolah & Tenant

Fungsi submenu ini:

- membuat sekolah baru,
- mengubah identitas sekolah,
- menyimpan `schoolId`, `name`, `district`, `npsn`,
- mengatur `authEmail`, `adminEmail`, `backupEmail`,
- membuka atau menutup tenant sekolah.

Node data utama:

- `schools`
- `npsn_index`

### 4.2 Admin Sekolah

Fungsi submenu ini:

- mengatur login admin sekolah untuk akses **web PortalKita**,
- membuka atau menutup akses admin sekolah,
- reset password admin sekolah ke default terkontrol,
- melihat apakah sekolah sudah punya admin atau belum,
- melihat status admin sekolah: siap, aktif, live, atau belum pernah login.

Aturan login yang dikunci:

- login admin sekolah menggunakan username `NPSN`,
- password awal admin sekolah adalah `admin123`,
- email sekolah dipakai sebagai data kontak/backup, bukan username login utama admin sekolah,
- tombol aksi super admin untuk akun admin sekolah memakai label `Reset Default`, bukan reset via email,
- reset password berbasis email tidak dipakai untuk akun admin sekolah berbasis `NPSN`/`@edulock.local`,
- jika akun admin sekolah sudah pernah aktif lalu perlu dikembalikan ke password awal, prosesnya wajib lewat `Reset Default` oleh super admin.

Node data utama:

- `schools/{schoolId}`
- `admin_profiles/{uid}`

### 4.3 Akun Kepala Sekolah

Fungsi submenu ini:

- membuat akun kepala sekolah,
- mengubah akun kepala sekolah,
- mengaktifkan atau menonaktifkan akun,
- reset device,
- generate password massal,
- download daftar akun kepala sekolah.

Catatan domain:

- akun ini disiapkan untuk akses kepala sekolah pada **APK GAS**,
- akun ini bukan akun login admin sekolah untuk web,
- implementasi login APK GAS kepala sekolah sudah aktif dan harus selalu menjaga isolasi tenant berbasis `schoolId`/`NPSN`.

Node data utama:

- `principal_accounts`

### 4.4 Monitoring Akun & Layanan

Fungsi submenu ini:

- memantau sekolah yang belum punya admin,
- memantau sekolah yang belum punya kepala sekolah,
- memantau tenant yang belum live,
- memantau log pelanggaran atau event penting,
- membaca health status lintas sekolah.

Monitoring tidak boleh berdiri tanpa relasi ke data induk sekolah.

### 4.5 Aturan Layout Halaman Data Induk Super Admin

Untuk menjaga pengalaman visual tetap rapi dan seimbang:

- halaman `super-admin/database` harus mengikuti area kerja utama dari shell portal dan tidak boleh memakai centering ganda yang membuat konten tampak terlalu menjorok ke kanan,
- route `super-admin` boleh memakai override lebar kontainer pada shell portal selama tidak mengubah struktur sidebar utama PortalKita,
- submenu lokal `DATABASE` super admin harus tetap tampil sebagai sidebar kiri,
- panel submenu lokal super admin harus dibuat lebih ramping agar tidak mendorong konten utama terlalu jauh ke kanan,
- gutter kiri area kerja super admin boleh diperkecil secara khusus bila diperlukan untuk menghilangkan kesan ruang kosong di kiri,
- setelah gutter kiri dikurangi, halaman tetap harus menyisakan padding kiri yang wajar agar layout tidak terasa menempel ke tepi layar,
- bila wrapper shell global masih menyisakan left rail kosong pada `super-admin/database`, route ini boleh memakai layout mandiri tanpa `PortalShell`,
- pada desktop, rail/menu lokal kiri `super-admin/database` harus tetap diam dan tidak ikut naik turun bersama konten kanan,
- scroll utama untuk halaman data induk super admin harus terjadi pada area konten kanan agar perilakunya konsisten dengan modul-modul portal lain,
- perapian layout super admin tidak boleh mengubah kontrak 4 submenu data induk yang sudah disepakati,
- route `super-admin/database` tidak boleh lagi bergantung langsung pada file page admin sekolah; jika ada logic bersama, tempatnya harus berada di layer komponen/workspace bersama di bawah route, bukan import silang antar halaman app.

## 5. Alur Kerja Super Admin

Urutan kerja super admin yang disepakati:

1. Daftarkan sekolah di `Sekolah & Tenant`
2. Pastikan identitas sekolah valid
3. Buka atau siapkan akses `Admin Sekolah`
4. Buat akun `Kepala Sekolah`
5. Pantau semuanya di `Monitoring Akun & Layanan`

Artinya:

- sekolah harus ada dulu,
- baru admin sekolah boleh dibuka,
- baru kepala sekolah boleh dibuat,
- sesudah itu statusnya dipantau.

## 6. Aturan Data Induk

Aturan data induk yang harus dijaga:

- setiap sekolah harus punya `schoolId` unik,
- `npsn_index` harus sinkron dengan `schools`,
- akun admin sekolah harus terikat ke sekolah valid,
- akun kepala sekolah harus terikat ke sekolah valid,
- status sekolah adalah master switch utama.

Implikasi:

- jika sekolah ditutup, akses operasional sekolah ikut terdampak,
- jika login admin sekolah ditutup, admin sekolah tidak bisa melanjutkan operasional,
- data induk tidak boleh dikelola dari halaman admin sekolah biasa.
- seluruh mutasi sensitif yang berada di domain `admin sekolah` dan `super admin` wajib melewati route backend terautentikasi, bukan write langsung dari browser ke database.

### 6.1 Aturan Enforcement Backend Admin

Untuk menjaga rumah web `super admin` dan `admin sekolah` tetap kokoh:

- semua aksi sensitif domain admin harus memakai enforcement layer server-side yang memverifikasi token EduLock admin, role, capability, dan scope `schoolId`,
- guard client hanya dipakai untuk UX redirect dan penguncian tampilan, bukan sumber kebenaran otorisasi,
- domain sensitif yang sudah wajib backend-first untuk admin/super admin meliputi minimal:
  - pengaturan presensi,
  - log presensi manual dan hapus log presensi,
  - mutasi virtual pet,
  - mutasi admin Lentera (`task`, review laporan, transaksi yang dijalankan dari sesi admin),
  - penilaian 7 KAIH oleh sesi admin/super admin,
  - operasi data induk super admin,
- bila suatu flow masih dipakai role non-admin tetapi trust anchor backend role tersebut belum ada, flow itu tidak boleh dipalsukan seolah sudah aman; statusnya harus dicatat jujur sebagai pekerjaan fondasi lanjutan.

### 6.2 Aturan Multi-Tenancy dan Isolasi Data

Untuk memastikan aplikasi aman saat dipakai banyak sekolah:

- `schoolId` adalah identitas tenant wajib untuk seluruh role operasional sekolah (`admin`, `teacher`, `student`, `kepala sekolah` bila nanti aktif di APK),
- session portal untuk role tenant tidak boleh diterbitkan bila `schoolId` kosong atau tidak valid,
- admin sekolah hanya boleh menerima data sekolahnya sendiri sejak level query/subscription; filter UI setelah data global masuk browser tidak dianggap cukup aman,
- record tanpa `schoolId` yang jelas tidak boleh ditampilkan ke admin sekolah sebagai fallback kompatibilitas,
- semua store atau listener realtime yang memuat domain sensitif lintas sekolah wajib tenant-aware sejak awal untuk area seperti presensi, sholat, kedisiplinan, virtual pet, Lentera, notifikasi, dan domain serupa,
- pengecualian pembacaan global hanya boleh terjadi pada workspace `super_admin` yang memang dirancang untuk monitoring lintas tenant.

Implikasi implementasi:

- query RTDB untuk admin sekolah harus memakai scope tenant yang eksplisit bila struktur data mendukung index `schoolId`,
- bila data legacy belum memiliki `schoolId`, solusinya adalah migrasi data di backend, bukan membuka fallback pembacaan global di client,
- kontrak ini berlaku untuk web sekarang dan harus tetap menjadi acuan saat jalur APK Android memakai backend/RTDB yang sama.

### 6.3 Aturan RBAC Portal

RBAC yang dikunci untuk PortalKita:

- `super_admin` boleh mengakses monitoring lintas tenant dan data induk pusat,
- `admin` hanya boleh mengakses domain operasional sekolah miliknya sendiri,
- `teacher` dan `student` tidak boleh menjadi role aktif untuk shell web admin; jalur web admin hanya untuk `super_admin` dan `admin sekolah`,
- `teacher` dan `student` yang masih dipakai untuk Android/web operasional non-admin wajib divalidasi melalui session backend dan scope tenant yang sama ketatnya,
- guard client (`localStorage`, Zustand persisted state, redirect UI) hanya berfungsi sebagai pengalaman pengguna; keputusan akses final tetap berasal dari session backend yang tervalidasi,
- halaman `super_admin` dan route data induk tidak boleh mengandalkan state client persisted sebagai sumber kebenaran otorisasi.

## 7. Alur Admin Sekolah

Menu utama admin sekolah tetap sama:

- `DATABASE`
- `GAS`
- `EduLock`
- `Lentera Digital`

Tetapi fungsi `DATABASE` admin sekolah berbeda dari super admin.

Fungsi `DATABASE` admin sekolah:

- mengelola siswa,
- mengelola guru dan wali kelas,
- mengelola petugas atau staff sekolah,
- mengelola kelas,
- mengelola data internal sekolahnya sendiri,
- menjadi induk data seluruh user sekolah tersebut,
- menjadi sumber akun/login utama untuk semua user sekolah saat APK Android sekolah nanti dibangun.

Penegasan domain:

- menu `DATABASE` admin sekolah adalah satu pintu pengelolaan data user sekolah untuk kebutuhan jangka panjang,
- akun siswa, guru/wali kelas, petugas OSIS, dan struktur kelas disiapkan dari halaman ini sebagai data induk,
- akun siswa pada `DATABASE` admin sekolah menjadi data induk untuk `APK GAS siswa` dan `APK EduLock siswa`,
- akun guru/wali kelas pada `DATABASE` admin sekolah menjadi data induk untuk `APK GAS guru`,
- data induk ini harus langsung menjadi referensi realtime bagi dashboard admin sekolah yang relevan,
- istilah resmi submenu staff pada `DATABASE` admin sekolah adalah `Petugas OSIS`,
- aturan login induk siswa yang ditampilkan di `DATABASE` admin sekolah adalah `username: Nama Siswa` dan `password login: NISN`,
- aturan login induk guru/wali kelas yang ditampilkan di `DATABASE` admin sekolah adalah `username: Nama Guru/Wali Kelas` dan `password login: NUPTK`,
- login web PortalKita tetap eksklusif untuk `super_admin` dan `admin sekolah`; `teacher` dan `student` memakai jalur APK Android resmi,
- perubahan data dan aktivitas dari `APK GAS` wajib muncul realtime di workspace `GAS` admin sekolah,
- perubahan data dan aktivitas dari `APK EduLock` wajib muncul realtime di workspace `EduLock` admin sekolah,
- karena itu, `DATABASE` admin sekolah berfungsi sebagai pusat data induk user, sedangkan dashboard `GAS` dan `EduLock` menjadi ruang monitoring operasional realtime sesuai modul masing-masing,
- seluruh mutasi induk siswa yang dipicu dari workspace `EduLock` tetap wajib lewat jalur backend `api/admin/students`; workspace `EduLock` tidak boleh memiliki jalur CRUD siswa paralel yang membypass `master_students`,
- reader sensitif di workspace `EduLock` seperti daftar induk siswa dan kode akses aktif wajib scoped sejak query berdasarkan `schoolId`, bukan memuat root global lalu difilter di browser admin sekolah.

### 6.4 Aturan Deploy Firebase Dua Console

- project hosting utama web admin / PortalKita adalah `satu-pintu-gas-dev`,
- boundary runtime `GAS / PortalKita` tetap memakai console `satu-pintu-gas-dev`,
- boundary runtime `EduLock` tetap memakai console `satu-pintu-edulock-dev`,
- web admin tidak dideploy ganda ke console EduLock; EduLock tetap berperan sebagai backend boundary kedua di dalam aplikasi yang sama,
- `NEXT_PUBLIC_HOSTING_PROJECT_ID` harus mengikuti project hosting utama (`satu-pintu-gas-dev`), bukan project boundary EduLock,
- `.firebaserc` web wajib mengunci `default` ke `satu-pintu-gas-dev` agar perintah `firebase deploy --only hosting` tidak salah arah,
- env public dan service account harus tetap dipisah tegas antara boundary `GAS` dan `EduLock`; dilarang mencampur config kedua console dalam label yang salah,
- template env production yang dijadikan acuan repo adalah `web/.env.production.checklist-ready.example`; file itu menjadi sumber salin ke `.env.local` saat deploy,
- repo tidak memakai template bernama `.env.local.*` sebagai acuan terdokumentasi karena pola `.gitignore` mengabaikan file dengan nama tersebut,
- karena output build web admin menggunakan static export (`output: "export"`), semua halaman yang membaca parameter kueri (`searchParams`) wajib diimplementasikan sebagai Client Component menggunakan `useSearchParams()` dan dibungkus di dalam komponen `<Suspense>` agar tidak memicu kegagalan prerendering (`NEXT_STATIC_GEN_BAILOUT`) saat build.

### 6.5 Aturan Porting APK GAS dari V1

- referensi V1 resmi untuk fondasi Android native ada di `C:\Unified-System\apps\native-mobile`,
- hasil port kerja ke repo aktif ditempatkan di `D:\Satu Pintu\native-mobile`,
- porting dilakukan secara selektif: struktur Gradle, manifest, source Kotlin, resource, screen, viewmodel, repository, dan utilitas inti boleh dibawa jika masih relevan dengan fondasi proyek sekarang,
- file sensitif Android seperti `app/google-services.json`, `keystore.properties`, `local.properties`, folder `keystore`, dan artefak build lama tidak boleh ikut dipindahkan ke repo aktif,
- namespace dasar proyek hasil port harus digeneralisasi ke identitas proyek aktif dan tidak boleh mempertahankan identitas sekolah release lama,
- fondasi port ini dipakai untuk tiga varian `GAS Siswa`, `GAS Guru`, dan `GAS Kepala Sekolah`,
- port V1 tidak berarti seluruh logika lama otomatis sah; integrasi Firebase, RBAC, multi-tenancy, dan isolasi data tetap wajib mengikuti arsitektur repo `Satu Pintu` yang aktif,
- sebelum build lokal atau release, file sensitif Android wajib disiapkan manual pada environment yang benar dan tidak boleh dijadikan artefak commit repo,
- setiap build APK yang berhasil dan siap diuji wajib disalin ke folder `D:\Satu Pintu\Siap Pakai` agar paket uji HP terkumpul di satu tempat operasional.

### 6.6 Aturan Hardening Native Mobile

- `LoginScreen` mobile wajib meminta `Kode Sekolah / NPSN` sebagai scope tenant saat login; akun guru, siswa, staff, dan kepala sekolah tidak boleh lolos tanpa tenant yang eksplisit,
- sesi mobile aktif harus menyimpan minimal `user_role`, `user_school_id`, `user_login_key`, dan `user_boundary`; password mentah tidak boleh dijadikan sumber session runtime,
- `Navigation` dan route guard mobile tidak boleh mempercayai `SharedPreferences` mentah; validitas route harus bergantung pada helper konsistensi sesi, role/flavor, dan boundary Firebase aktif,
- setiap varian mobile hanya boleh menerima role yang sesuai: `siswa -> student`, `guru -> teacher/staff`, `kepala -> principal`,
- seluruh repository Firebase di `native-mobile` yang memuat data operasional sekolah wajib query scoped by `schoolId` sejak awal; filter setelah data global masuk device tidak dianggap aman,
- record tanpa `schoolId` yang jelas tidak boleh otomatis lolos ke sesi tenant aktif pada domain attendance, discipline, notifikasi, virtual pet, dan aduan siswa,
- boundary Firebase mobile wajib fail-fast terhadap project id aktif; config `GAS` tidak boleh diam-diam tersambung ke boundary `EduLock` atau sebaliknya,
- fallback kompatibilitas lama seperti `user_credential` hanya boleh dibaca lewat helper transisional yang aman, bukan dipakai langsung oleh screen atau navigation baru.

### 7.1 Aturan Tetap Workspace GAS Admin

Untuk menjaga kesetiaan terhadap V1, workspace `GAS` admin sekolah dikunci dengan aturan berikut:

- saat admin sekolah berada di route `/dashboard/*`, sidebar harus fokus ke menu kerja GAS dan tidak boleh mencampur blok kerja `DATABASE`, `EduLock`, atau `Lentera Digital`,
- branding header/sidebar GAS admin memakai logo `Icon_GAS.png` dengan judul `Gerbang Aplikasi Sekolah`,
- urutan menu GAS admin yang menjadi acuan tetap adalah:
  - `Beranda GAS`
  - `Manajemen Siswa`
  - `Manajemen Presensi`
  - `Presensi Sekolah`
  - `Presensi Sholat`
  - `Pengaturan Sistem`
  - `Rekap Kehadiran`
  - `Rekap Kedisiplinan`
  - `Monitoring E-Library`
  - `Rekap Sholat`
  - `Virtual Pet Monitor`
  - `7 KAIH`
  - `Laporan Masuk`
  - `Broadcast Notifikasi`,
- struktur menu dan perilaku sidebar GAS admin harus mengikuti V1 sebagai baseline, bukan improvisasi layout portal umum.

Aturan parity modul GAS yang sudah dikunci:

- rumus `Rekap Kehadiran` harus tetap mengikuti pola V1: hari Minggu dilewati, tanggal masa depan dilewati, dan hari valid tanpa log dihitung `Alpha`,
- rumus `Rekap Sholat` harus tetap mengikuti pola V1 dengan perlakuan `PRAY`, `NOT_PRAY`, `PERMIT`, `HALANGAN`, serta denominator `effectiveDays` yang sama,
- penilaian `7 KAIH` harus tetap memakai bobot `40% + 30% + 20% + 10%` dengan predikat akhir yang sama seperti V1,
- skor `Monitoring E-Library` harus tetap memakai komposisi `visitScore + readingScore + taskScore` dan kategori aktivitas yang sama seperti V1,
- `Virtual Pet Monitor` harus mempertahankan analisis risiko, leaderboard, statistik, dan reward logic yang sama seperti V1,
- fallback write `teacher` / `student` langsung ke Firebase dari browser tidak boleh dipertahankan; presensi manual guru, transaksi Lentera non-admin, dan 7 KAIH non-admin wajib lewat route backend portal yang memverifikasi session cookie dan scope sekolah,
- guru hanya boleh memutasi data kelas yang diampu atau setidaknya tenant sekolahnya sendiri, sedangkan siswa hanya boleh mutasi data miliknya sendiri.

### 7.2 Aturan Tetap Workspace EduLock Admin

Untuk menjaga kesetiaan terhadap V1, workspace `EduLock` admin sekolah dikunci dengan aturan berikut:

- route `/edulock` saat ini berfungsi sebagai gerbang role-aware EduLock: bila sesi EduLock sudah ada maka user otomatis diarahkan ke workspace yang sesuai role, sedangkan bila sesi belum ada halaman root tetap boleh tampil sebagai landing integrasi dengan CTA ke area EduLock,
- halaman `/edulock/admin` harus memakai struktur workspace EduLock versi V1, bukan shell refaktor portal umum,
- area kerja internal EduLock admin yang menjadi acuan tetap adalah:
  - `Dashboard`
  - `Realtime Monitoring`
  - `Kelola Kode Izin`
  - `Pengaturan Zona`
  - `Data Siswa`
  - `Manajemen Kelas`
  - `Audit Log Pelanggaran`
  - `Pengaturan Sistem`,
- saat admin sekolah berada di domain EduLock, sidebar portal kiri harus tetap sinkron dengan 8 area kerja internal tersebut; pada source aktif label portal yang tampil adalah `Dashboard EduLock`, `Realtime Monitoring`, `Kelola Kode Izin`, `Pengaturan Zona`, `Data Siswa`, `Manajemen Kelas`, `Audit Log Pelanggaran`, dan `Settings EduLock`,
- branding EduLock admin harus memakai logo `Logo EduLock.png` dan identitas admin sekolah ditempatkan di bawah logo pada sidebar kiri,
- detail visual utama workspace EduLock admin harus mengikuti baseline V1 yang sudah disetujui, termasuk struktur sidebar internal, header, dan komposisi panel pengaturan.

Aturan operasional EduLock admin yang sudah dikunci:

- admin EduLock mengelola sekolahnya sendiri dan tidak boleh bercampur dengan domain super admin saat dinilai sebagai workspace admin sekolah,
- login admin sekolah tetap dipusatkan melalui `PortalKita / Dashboard Satu Pintu` dengan aturan username `NPSN` dan password yang mengikuti alur resmi portal,
- karena login admin sekolah dipusatkan di portal, fitur `Ubah Password Admin` tidak dipakai lagi di halaman `/edulock/admin`,
- pengembangan berikutnya pada EduLock admin tidak boleh mengubah urutan 8 tab, identitas visual utama, atau alur login satu pintu yang sudah dikunci ini.

### 7.3 Aturan Tetap Workspace Lentera Digital Admin

Untuk menjaga kesetiaan terhadap V1, workspace `Lentera Digital` admin sekolah dikunci dengan aturan berikut:

- halaman `/admin/lentera` harus tetap memakai pola wrapper ke modul `dashboard/library` seperti V1, bukan dipisah menjadi shell portal baru yang mengubah struktur kerja internal,
- sidebar internal Lentera admin yang menjadi acuan tetap adalah:
  - `Dashboard`
  - `Peminjaman`
  - `Kelola Literasi`
  - `Daftar Tugas`
  - `Perlu Dinilai`
  - `Riwayat`
  - `Data Anggota`
  - `Statistik Siswa`
  - `Pengaturan`
  - `Logout`,
- saat admin sekolah berada di domain `Lentera`, sidebar portal kiri harus fokus ke struktur kerja Lentera dan tidak boleh memecah konteks dengan jalur tambahan di luar pola V1,
- navigasi internal Lentera harus tetap bertumpu pada query `tab`, `view`, dan `taskView` seperti baseline V1,
- `Data Anggota` Lentera harus tetap diposisikan sebagai mirror dari `DATABASE` admin sekolah, bukan sumber master data terpisah.

Aturan operasional Lentera admin yang sudah dikunci:

- default pengaturan tugas Lentera harus tetap `30 poin`, `45 menit`, `reminder 3 hari`, dan `auto publish` nonaktif,
- default pengaturan peminjaman harus tetap `7 hari`, `maksimal 2 buku`, `denda 1000/hari`, dan `allow weekend due date` nonaktif,
- perubahan teknis backend-first pada penyimpanan pengaturan Lentera boleh dipertahankan karena itu merupakan penguatan keamanan, bukan perubahan aturan bisnis,
- workspace `Lentera Digital` hanya boleh diakses oleh `admin sekolah`; role lain harus dipantulkan kembali ke portal utama,
- pengembangan berikutnya pada Lentera admin tidak boleh mengubah struktur menu, query navigasi, atau parity bisnis terhadap V1 yang sudah dikunci ini.

Admin sekolah tidak boleh:

- membuat sekolah baru,
- mengubah tenant sekolah lain,
- mengatur admin sekolah lain,
- mengatur kepala sekolah sekolah lain.

## 8. Hubungan PortalKita dengan GAS dan EduLock

PortalKita adalah pintu masuk utama.

Kesepakatannya:

- user login ke `PortalKita` terlebih dahulu,
- setelah login, user melihat menu utama portal,
- dari portal, user masuk ke `GAS` dan `EduLock` sebagai bagian dari portal yang sama,
- pengalaman masuk ke modul harus terasa terintegrasi, bukan seperti pindah aplikasi liar.

Pembeda akun yang harus dijaga:

- `Admin Sekolah` login ke **web PortalKita**,
- `Kepala Sekolah` nantinya login ke **APK GAS**,
- `Siswa`, `Guru/Wali Kelas`, dan `Petugas OSIS` nantinya memakai data induk dari menu `DATABASE` admin sekolah saat APK Android sekolah dibangun,
- keduanya sama-sama dibuat atau dikontrol dari super admin, tetapi tujuan platform login-nya berbeda.

## 9. Prinsip UI yang Harus Dijaga

Prinsip UI yang disepakati:

- tiga menu inti portal `DATABASE`, `GAS`, dan `EduLock` tetap hadir sebagai tulang punggung lintas role,
- menu konteks keempat mengikuti role aktif: `Status Layanan Sekolah` untuk `super admin` dan `Lentera Digital` untuk `admin sekolah`,
- perbedaan berikutnya ada pada sub menu dan cakupan data,
- halaman pertama super admin harus terasa sebagai dashboard induk,
- halaman `DATABASE` super admin harus menegaskan fungsi data induk pusat,
- visual V1 menjadi acuan bila terjadi perbedaan struktur.

Tambahan kesepakatan UI untuk `APK GAS Kepala Sekolah`:

- 6 menu utama dashboard kepala sekolah ditampilkan dalam grid `2 kolom`, bukan list vertikal satu kolom,
- setiap card menu utama harus memiliki identitas warna yang berbeda agar domain monitoring cepat dikenali,
- perubahan layout menu kepala sekolah harus tetap menjaga keterbacaan di layar HP dan tidak mengorbankan konteks judul/subjudul menu,
- `Ringkasan Eksekutif` kepala sekolah harus ikut memuat kartu `7 KAIH` yang mengambil data real-time dari sumber monitoring `7 KAIH` yang sama,
- string UI principal harus memakai separator ASCII aman seperti ` | ` untuk menghindari bug mojibake/encoding seperti `aEc` atau `â€¢` di perangkat.

Tambahan aturan umum untuk APK Android:

- string UI yang tampil ke user pada varian `GAS Siswa`, `GAS Guru`, dan `GAS Kepala Sekolah` harus menghindari separator hasil encoding rawan seperti `â€¢`,
- bila perlu separator antar metadata singkat, pakai format ASCII aman seperti ` | ` atau list `-` agar stabil saat dirender di perangkat Android.
- untuk wrapper `EduLock Admin` Android, URL WebView wajib selalu diarahkan ke portal web aktif proyek ini dan tidak boleh tertinggal ke domain deployment lama seperti `sc-app-bk-2025.web.app`.
- source build Android `EduLock` yang aktif harus berada di workspace utama `D:\Satu Pintu\edulock-mobile`; folder referensi lama hanya boleh dipakai untuk audit atau pembanding, bukan sebagai sumber build utama jangka panjang.

Tambahan aturan integrasi data induk:

- menu `DATABASE` adalah induk semua data user lintas modul.
- data akun siswa untuk `GAS` APK dan `EduLock` APK harus berasal dari satu sumber yang sama, yaitu data induk pada `DATABASE`.
- halaman web `EduLock Admin`, khususnya tab `Data Siswa`, wajib membaca scope tenant yang sama dengan sesi portal admin agar tidak terjadi kondisi `DATABASE` berisi tetapi `EduLock` kosong.
- bila ada data realtime atau metadata khusus `EduLock`, data tersebut hanya menjadi lapisan tambahan di atas data induk siswa, bukan pengganti sumber utama akun.
- bila halaman `EduLock Admin` perlu membaca data induk `GAS` langsung dari client, page tersebut wajib membuka sesi baca `GAS` terlebih dahulu dan tidak boleh mengandalkan subscription diam tanpa autentikasi yang jelas.
- halaman `EduLock Admin > Data Siswa` tidak boleh menyediakan fitur `Template`, `Import`, atau `Tambah Siswa`; input data siswa hanya dilakukan dari menu `DATABASE`.

Tambahan aturan UI untuk modul guru:

- kolom status `PET` pada layar `Data Siswa` harus memakai chip yang kontras terhadap background tabel agar label `-`, `Mati`, `Sakit`, dan `Sehat` tetap terbaca jelas di perangkat.
- tabel pada `Monitoring Kehadiran` dan `Rekapitulasi Kehadiran` harus mengikuti treatment visual tabel `Presensi Sholat`, termasuk tanpa elevasi/card haze tambahan yang menimbulkan efek kotak putih samar.
- pada halaman `Pengaturan Sistem` admin sekolah di web, tab atau card `Akun Admin` tidak perlu ditampilkan kembali bila alur `ganti password saat login pertama` sudah aktif; dashboard tidak boleh menyediakan form ubah password lokal yang menduplikasi jalur login satu pintu.
- pada menu `Tools` siswa, card penjelasan bawah `Segera Hadir` tidak perlu dipertahankan; cukup tampilkan katalog tools yang benar-benar ada.
- `Kamus Bahasa Inggris` dan `Kamus Bahasa Jawa` di APK siswa tidak boleh lagi berbentuk daftar kata statis jika panduan referensi root sudah menetapkan versi pencarian online; implementasi harus mengikuti referensi root:
  - `panduan-kamus-bahasa-inggris-android.md`
  - `panduan-kamus-bahasa-jawa-android.md`
- `Kamus Bahasa Inggris` harus mendukung dua arah:
  - `Inggris -> Indonesia`: `dictionaryapi.dev` untuk definisi + `MyMemory` untuk arti Indonesia
  - `Indonesia -> Inggris`: `MyMemory` untuk terjemahan Inggris, lalu bila memungkinkan diperkaya lagi dengan definisi `dictionaryapi.dev`
- `Kamus Bahasa Jawa` memakai `MyMemory` untuk terjemahan dua arah dan transliterasi `Hanacaraka` untuk tampilan aksara Jawa.
- Untuk `Kamus Bahasa Jawa`, kode bahasa online harus memakai locale yang valid di layanan terjemahan:
  - `Indonesia -> Jawa`: `id-ID|jv-ID`
  - `Jawa -> Indonesia`: `jv-ID|id-ID`
- Hasil mentah error dari layanan online tidak boleh ditampilkan sebagai hasil terjemahan pengguna; jika API mengembalikan pesan error, UI harus memunculkan status gagal yang jelas, bukan meneruskan teks error itu ke kartu hasil atau transliterasi aksara.
- Untuk frasa pendek di `Kamus Bahasa Jawa`, UI hasil sebaiknya menampilkan rincian aksara per kata agar lebih membantu pemahaman siswa, bukan hanya satu blok aksara utuh.
- Untuk APK `GAS Siswa`, sesi login yang sudah berhasil harus dipertahankan di penyimpanan lokal dan dipakai kembali saat aplikasi dibuka ulang. Menekan `Home`, keluar dari recent apps, atau membuka ulang aplikasi tidak boleh melempar siswa kembali ke halaman login selama:
  - sesi lokal masih valid,
  - boundary Firebase masih sesuai,
  - tenant sekolah masih aktif,
  - user belum melakukan logout eksplisit.
- Setiap perubahan perilaku sesi/login yang berdampak ke proses instal ulang atau update APK siswa wajib diikuti kenaikan `versionCode` dan build ulang release agar pengujian di perangkat tidak tertukar dengan APK lama.

## 10. Implikasi Implementasi

Saat membangun fitur baru, aturan berikut wajib diikuti:

- jangan mencampur data induk super admin dengan data operasional admin sekolah,
- jangan membuat menu utama baru jika masih bisa masuk ke kerangka portal aktif per role yang sudah dikunci,
- setiap mutasi sensitif harus bergerak ke backend-first,
- node data baru harus jelas berada di domain super admin atau domain sekolah,
- semua alur login dan monitoring harus tetap tenant-aware.

## 11. Kesimpulan Operasional

Ringkasan paling penting:

- `Super Admin` = pusat data induk semua sekolah
- `Admin Sekolah` = pengelola operasional sekolah masing-masing
- `Admin Sekolah` login melalui web PortalKita
- `Kepala Sekolah` login melalui APK GAS Kepala Sekolah dengan tenant sekolah yang tervalidasi
- `PortalKita` = shell utama yang mengikat `DATABASE`, `GAS`, `EduLock`, serta modul konteks role aktif
- menu konteks aktif saat ini adalah `Status Layanan Sekolah` untuk `super admin` dan `Lentera Digital` untuk `admin sekolah`
- sekolah harus dibuat dulu, baru admin sekolah dan kepala sekolah bisa diatur

Dokumen ini menjadi acuan tetap selama pengembangan berikutnya kecuali Anda memberi revisi baru secara eksplisit.

Tambahan aturan sinkronisasi `DATABASE` dan `EduLock`:

- pembacaan data induk siswa `master_students` pada workspace `EduLock` harus mengikuti pola yang sama dengan halaman `DATABASE` yang sudah terbukti stabil,
- bila node `master_students` aktif belum memiliki index `schoolId`, query tenant-aware di `EduLock` wajib memakai baca node penuh lalu filter `schoolId` secara lokal; jangan kembali memakai query RTDB ber-index yang sudah terbukti gagal di project aktif.
- untuk halaman `EduLock Admin`, pembacaan data induk `DATABASE` diutamakan lewat route backend berbasis service account (`/api/admin/students`) dan tidak mengandalkan akses langsung browser ke RTDB `GAS`.
- halaman `EduLock Admin > Manajemen Kelas` wajib menjadi mirror read-only dari registry kelas induk `DATABASE/master_classes`; mutasi kelas tidak boleh lagi lewat route `edulock/security`,
- daftar dan filter kelas di workspace `EduLock` harus dibangun dari katalog kelas induk `master_classes`, bukan fallback dari `master_students.class`.
- semua konfigurasi realtime `EduLock` yang diubah admin web wajib memakai sumber tenant yang sama dengan APK siswa, yaitu `schools/{schoolId}/...`; jangan kembali memakai node global legacy `school_config` untuk fitur multi-tenant,
- perubahan admin yang menyasar device/sesi siswa (`reset device`, pencabutan izin, kode akses, mode proteksi/libur) harus dirancang agar berdampak langsung ke APK siswa aktif tanpa menunggu login ulang,
- `active_codes` EduLock wajib divalidasi dengan boundary `schoolId` agar kode akses tidak bisa dipakai lintas tenant/sekolah.
- pada halaman admin web yang memakai tabel aksi padat, kolom `Aksi` tidak boleh dipaksa satu baris hingga tombol terpotong; gunakan proporsi card yang cukup, `overflow-x-auto`, dan tombol yang bisa `wrap` bila ruang menyempit.
