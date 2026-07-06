# PANDUAN PENGGUNAAN EDULOCK
**(Untuk Siswa & Administrator)**

---

## DAFTAR ISI
1. [Panduan untuk Siswa (Aplikasi Android)](#bagian-1-panduan-untuk-siswa-android)
2. [Panduan untuk Admin (Web Dashboard)](#bagian-2-panduan-untuk-admin-web-dashboard)
3. [Troubleshooting & Solusi Masalah](#bagian-3-troubleshooting--solusi-masalah)

---

## BAGIAN 1: PANDUAN UNTUK SISWA (ANDROID)

### 1. Instalasi & Registrasi
1.  **Instalasi:** Install file APK EduLock yang diberikan oleh sekolah.
2.  **Registrasi:**
    *   Buka aplikasi.
    *   Masukkan **NISN** Anda dengan benar.
    *   Sistem akan memvalidasi data Anda. Jika berhasil, nama dan kelas akan muncul otomatis.
    *   Klik **"Daftarkan Perangkat"**.
    *   *Catatan:* Satu NISN hanya bisa digunakan di satu HP. Jika ganti HP, hubungi Admin untuk reset Device ID.

### 2. Setup Awal (PENTING!)
Setelah registrasi, Anda **WAJIB** mengaktifkan semua izin agar aplikasi berjalan lancar:
1.  **Izin Lokasi:** Klik "Aktifkan" -> Pilih **"Izinkan Sepanjang Waktu"** (Allow all the time). Ini wajib untuk mendeteksi apakah Anda di sekolah.
2.  **Izin Kamera:** Klik "Aktifkan" -> "Izinkan". Digunakan untuk scan barcode izin.
3.  **Admin Perangkat:** Klik "Aktifkan" -> "Activate this device admin app". Ini mencegah aplikasi terhapus tidak sengaja.
4.  **Aksesibilitas (Proteksi):**
    *   Klik "Aktifkan".
    *   Cari menu **"Layanan Terinstall"** (Installed Services) atau **"Aplikasi yang Diunduh"**.
    *   Pilih **"EduLock Protection"** -> **AKTIFKAN**.
5.  **Overlay (Tampil di atas aplikasi lain):** Klik "Aktifkan" -> Cari "EduLock" -> Nyalakan switch-nya.

### 3. Cara Kerja Aplikasi
*   **Masuk Sekolah:** Saat Anda memasuki area sekolah (geofencing) pada jam sekolah, aplikasi otomatis aktif memonitor.
*   **Pulang Sekolah:** Monitoring otomatis berhenti saat jam sekolah berakhir.
*   **Kiosk Mode:** Selama jam sekolah, HP akan terkunci (hanya bisa buka EduLock) kecuali Anda mendapat izin.

### 4. Meminta Izin Penggunaan HP
Jika perlu menggunakan HP (misal untuk pelajaran), minta izin ke Guru:
1.  Klik tombol **"Minta Izin Penggunaan HP"**.
2.  Pilih metode:
    *   **Input Kode:** Masukkan 6 digit kode yang diberikan guru.
    *   **Scan Barcode:** Scan QR Code yang ditampilkan guru.
3.  Jika berhasil, HP akan terbuka selama durasi yang ditentukan (misal 60 menit).

---

## BAGIAN 2: PANDUAN UNTUK ADMIN (WEB DASHBOARD)

**URL Dashboard:** `https://edulock-4b7fc.web.app` (Contoh)

### 1. Menu Monitoring (Realtime)
*   Melihat status seluruh siswa:
    *   🟢 **Aman (Di Sekolah):** Siswa di dalam area & GPS aktif.
    *   🔴 **Keluar Area:** Siswa kabur/keluar pagar.
    *   ⚠️ **GPS Mati:** Siswa mematikan lokasi.
    *   ⚫ **Offline:** HP mati atau tidak ada internet.
*   **Fitur "Cabut Izin":** Jika siswa menyalahgunakan HP saat sesi izin, klik tombol **"Cabut Izin"** di sebelah nama siswa. HP siswa akan langsung terkunci kembali.

### 2. Manajemen Siswa
*   **Tambah Siswa Manual:** Klik "Tambah Siswa".
*   **Import Excel (Massal):**
    *   Download template Excel yang disediakan.
    *   Isi data (NISN, Nama, Kelas).
    *   Upload file Excel.
    *   Sistem menggunakan **Smart Update**: Data siswa lama akan diupdate, siswa baru akan ditambahkan.

### 3. Generate Kode Izin
*   Masuk ke menu **"Generate Code"**.
*   Pilih durasi (misal 45 menit, 90 menit).
*   Klik "Generate".
*   Berikan kode 6 digit atau tampilkan QR Code ke siswa.

### 4. Pengaturan Sekolah (Settings)
*   **Lokasi Sekolah:** Tentukan titik tengah dan radius (meter) area sekolah.
*   **Jam Sekolah:** Atur jam masuk dan jam pulang.
*   **Mode Libur (Global Holiday):** Aktifkan switch **"Mode Libur"** saat tanggal merah atau acara bebas. Semua monitoring akan dimatikan otomatis.
*   **Remote Uninstall:** Izinkan siswa tertentu untuk uninstall aplikasi (jika lulus/pindah).

---

## BAGIAN 3: TROUBLESHOOTING & SOLUSI MASALAH

### A. Masalah pada HP Siswa (Android)

#### 1. Aplikasi Sering Keluar Sendiri / Monitoring Mati (PENTING UNTUK XIAOMI/OPPO/VIVO)
HP merk China sering mematikan aplikasi background untuk hemat baterai.
**Solusi:**
*   Buka **Info Aplikasi** EduLock.
*   Pilih **Penghemat Baterai** -> Ubah ke **"Tidak Ada Pembatasan"** (No Restrictions).
*   Cari menu **Mulai Otomatis (Autostart)** -> **AKTIFKAN**.
*   Kunci aplikasi di Recent Apps (Tekan lama aplikasi EduLock di task manager -> Klik ikon gembok).

#### 2. "Overlay Detected" / Tidak Bisa Klik Tombol
Muncul pesan error saat mencoba memberikan izin.
**Solusi:**
*   Matikan sementara aplikasi perekam layar, "Assistive Touch", atau "Bola Pintas".
*   Jika masih gagal, restart HP dan coba lagi.

#### 3. Lokasi Tidak Terdeteksi / GPS Error
**Solusi:**
*   Pastikan berada di luar ruangan (outdoor) agar GPS akurat.
*   Buka Google Maps dulu untuk memancing sinyal GPS, lalu buka EduLock.
*   Pastikan izin lokasi diset ke **"Sepanjang Waktu"** (Always Allow).

#### 4. Tidak Bisa Uninstall Aplikasi
Aplikasi dilindungi fitur Admin.
**Solusi:**
*   **Cara Resmi:** Minta Admin Web mengaktifkan izin uninstall untuk NISN Anda. Lalu buka menu Admin di aplikasi -> Uninstall.
*   **Cara Manual (Perlu Password):** Buka aplikasi -> Klik menu Admin -> Masukkan Password Admin (Default: `SpEnT9@P@_2007`) -> Pilih Uninstall.

### B. Masalah pada Web Dashboard

#### 1. Status Siswa Tidak Update (Stuck)
Siswa sudah bergerak tapi di dashboard masih diam.
**Penyebab:**
*   Sistem sekarang menggunakan **"Smart Throttling"** untuk menghemat data. Jika siswa diam di tempat, status hanya update setiap 5 menit.
*   Jika siswa bergerak/melanggar, status update instan.
*   Pastikan siswa memiliki koneksi internet.

#### 2. Gagal Import Excel
**Solusi:**
*   Pastikan format file `.xlsx` atau `.xls`.
*   Jangan ubah nama header kolom di template (NISN, Nama, Kelas).
*   Pastikan tidak ada NISN ganda di dalam file Excel.

#### 3. Lupa Password Admin Web
**Solusi:**
*   Gunakan fitur "Forgot Password" di halaman login. Link reset akan dikirim ke email admin (`spentgapaofficial@gmail.com`).
