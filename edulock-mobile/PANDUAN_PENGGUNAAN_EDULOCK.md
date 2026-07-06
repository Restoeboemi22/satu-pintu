# Panduan Penggunaan & Troubleshooting EduLock

## Daftar Isi
1. [Instalasi & Aktivasi Awal](#1-instalasi--aktivasi-awal)
2. [Fitur Utama](#2-fitur-utama)
3. [Troubleshooting (Masalah Umum)](#3-troubleshooting-masalah-umum)
4. [Fitur Darurat](#4-fitur-darurat)
5. [Kontak & Support](#5-kontak--support)

---

## 1. Instalasi & Aktivasi Awal

Agar EduLock berfungsi maksimal melindungi siswa dan ujian, mohon ikuti langkah instalasi berikut dengan teliti.

### 1.1. Login
*   Masukkan **NISN** siswa dengan benar.
*   Aplikasi akan memvalidasi data ke server.
*   Jika NISN valid, Anda akan masuk ke halaman Setup.

### 1.2. Pemberian Izin (Wajib)
Aplikasi akan meminta beberapa izin secara berurutan. **Semua izin wajib diberikan** agar aplikasi tidak error.

1.  **Izin Lokasi (GPS):**
    *   Klik "Izinkan" -> Pilih "Izinkan Sepanjang Waktu" (Allow all the time) atau "Izinkan saat aplikasi digunakan".
    *   *Penting:* Pastikan GPS (Lokasi) di HP selalu NYALA.

2.  **Izin Admin Perangkat (Device Admin):**
    *   Akan muncul dialog sistem Android. Klik "Aktifkan aplikasi admin perangkat ini".
    *   *Fungsi:* Mencegah aplikasi di-uninstall sembarangan dan mengunci layar (Kiosk Mode).

3.  **Izin Aksesibilitas (Accessibility):**
    *   Klik "Buka Pengaturan".
    *   Cari menu "Aksesibilitas" -> "Aplikasi Terinstall" (Installed Services).
    *   Pilih **"EduLock Protection"** -> **AKTIFKAN**.
    *   *Fungsi:* Mencegah tombol Home/Back ditekan saat ujian/KBM.

4.  **Izin Baterai (Baru):**
    *   Akan muncul dialog "Izin Baterai Diperlukan". Klik "Izinkan".
    *   *Fungsi:* Mencegah sistem HP mematikan EduLock saat layar mati (Sleep Kill).

---

## 2. Fitur Utama

### 2.1. Mode Sekolah (Otomatis)
*   Aplikasi akan otomatis mengunci HP (Lock Screen) jika:
    *   Jam sekolah berlangsung (Senin-Jumat, 07:00 - 15:00, contoh).
    *   Siswa berada **DI DALAM AREA SEKOLAH**.
*   Jika siswa **KELUAR AREA** sekolah, HP akan terkunci dengan pesan peringatan.

### 2.2. Buka Aplikasi Sekolah
*   Di halaman Lock Screen atau Dashboard, terdapat tombol **"BUKA APLIKASI SEKOLAH"**.
*   Klik tombol ini untuk membuka aplikasi ujian/LMS resmi (AplikasiSMPN3Pacet).
*   EduLock akan berjalan di latar belakang untuk memantau.
*   *Catatan:* Jika Anda keluar dari aplikasi sekolah, EduLock akan kembali mengunci layar.

### 2.3. Minta Izin (Cabut Izin)
*   Siswa dapat meminta izin penggunaan HP (misal untuk telepon orang tua) melalui tombol "Minta Izin".
*   Guru dapat menyetujui/menolak via Web Dashboard.

---

## 3. Troubleshooting (Masalah Umum)

### Masalah 1: Aplikasi Tertutup Sendiri / Mati Tiba-tiba
*   **Penyebab:** Sistem HP (Android) mematikan aplikasi untuk hemat baterai.
*   **Solusi:**
    1.  Buka EduLock.
    2.  Jika muncul permintaan izin baterai, klik "Izinkan".
    3.  Atau atur manual: Pengaturan HP -> Aplikasi -> EduLock -> Baterai -> Pilih **"Tidak Dibatasi" (Unrestricted)**.

### Masalah 2: Tombol "Buka Aplikasi Sekolah" Tidak Bisa Diklik
*   **Penyebab:** Ada aplikasi lain yang menutupi layar (Overlay) atau error sementara.
*   **Solusi:**
    1.  Tutup paksa EduLock (lewat Recent Apps jika bisa) dan buka lagi.
    2.  Pastikan tidak ada aplikasi "Perekam Layar" atau "Assistive Touch" yang menutupi tombol.

### Masalah 3: Aplikasi Sekolah Terbuka Sebentar Lalu Tertutup Lagi
*   **Penyebab:** EduLock mengira Anda membuka aplikasi terlarang.
*   **Solusi:**
    1.  Update EduLock ke versi terbaru (kami baru saja merilis perbaikan "Grace Period").
    2.  Tunggu sekitar 5-10 detik setelah menekan tombol buka aplikasi.

### Masalah 4: Lupa Password Uninstall
*   **Password Default:** `SpEnT9@P@_2007` (Hanya untuk Admin/Guru).
*   Jangan berikan password ini ke siswa.

### Masalah 5: GPS Tidak Terdeteksi / "Lokasi Tidak Ditemukan"
*   **Solusi:**
    1.  Pastikan GPS di Quick Settings (Status Bar) menyala.
    2.  Buka Google Maps sebentar untuk memancing sinyal GPS.
    3.  Masuk kembali ke EduLock.

---

## 4. Fitur Darurat

Jika terjadi kondisi darurat (misal: Internet Mati Total Massal, Server Down) dan HP siswa terkunci, gunakan fitur ini:

### Emergency Unlock (Buka Paksa)
1.  Pada layar Lock Screen yang terkunci (warna merah/biru).
2.  Ketuk (Tap) teks peringatan di tengah layar sebanyak **7 kali** dengan cepat.
3.  Akan muncul kolom password.
4.  Masukkan Password Admin: `SpEnT9@P@_2007`.
5.  HP akan terbuka sementara.

---

## 5. Kontak & Support

Jika masalah berlanjut, hubungi Tim IT Sekolah atau Administrator EduLock.

*   **Email Admin:** spentgapaofficial@gmail.com
*   **Web Dashboard:** [URL Dashboard Sekolah]

---
*Dokumen ini dibuat otomatis oleh Asisten Pengembang EduLock.*
