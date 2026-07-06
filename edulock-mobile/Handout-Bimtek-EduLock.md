# Handout Bimtek EduLock (Super Admin, Admin Sekolah, dan APK Siswa)
Versi sistem: Web Dashboard + Firebase Realtime Database (RTDB) + APK Siswa (Android)  
URL Dashboard: https://edulock-4b7fc.web.app

## 1) Tujuan Bimtek
- Peserta memahami peran Super Admin dan Admin Sekolah.
- Peserta mampu menjalankan alur utama (realtime):
  - Registrasi siswa, monitoring status perangkat
  - Generate kode izin dan cabut izin
  - Uninstall per siswa dan uninstall massal Kelas 9 (kelulusan)
  - Monitoring sekolah aktif dan siswa aktif (Super Admin)
- Peserta memahami SOP darurat: reset admin, offline, dan troubleshooting.

## 2) Peran dan Akses
### Super Admin
- Kelola sekolah, kelola admin, monitoring seluruh sekolah, keamanan (kode uninstall per sekolah).

### Admin Sekolah
- Kelola siswa sekolahnya, monitoring siswa, generate kode izin, cabut izin, uninstall massal Kelas 9.

### Siswa (APK Android)
- Registrasi (NISN/Nama/Kelas), kirim status realtime, input/scan kode izin, mode uninstall jika diizinkan.

## 3) Gambaran Data (Node RTDB)
- schools/{schoolId}
  - Data sekolah, status aktif, dan uninstallAccess (kode uninstall per sekolah)
- admin_profiles/{uid}
  - Profil admin (role, sekolah, status aktif)
- students/{nisn}
  - Data siswa + status perangkat (deviceStatus, lastUpdated, lokasi, dsb)
  - uninstall_authorized (izin uninstall per siswa)
- active_codes/{code}
  - Kode izin sementara (expiresAt, duration, sessionStart, sessionEnd)
- active_sessions/{nisn}
  - Siswa yang sedang diizinkan memakai HP (aktif)
- violations/{id}
  - Log pelanggaran/kejadian penting

## 4) Ringkasan Alur Sistem
### 4.1 Kode izin (izin penggunaan HP)
1. Admin Sekolah membuat kode izin dari dashboard.
2. Kode disimpan ke active_codes/{code} dengan:
   - expiresAt: batas waktu kode boleh dipakai (masa berlaku kode)
   - duration: durasi izin (menit) untuk penggunaan HP
3. Siswa input/scan kode di APK.
4. Jika valid, APK membuat active_sessions/{nisn}.
5. Admin dapat cabut izin dengan menghapus active_sessions/{nisn}.

### 4.2 Uninstall APK siswa (kelulusan / kebutuhan administrasi)
1. Cara utama (recommended): izin uninstall per siswa
   - Set students/{nisn}/uninstall_authorized = true
   - APK masuk mode uninstall dan menampilkan tombol uninstall
2. Cara per sekolah (opsional): kode uninstall sekolah
   - Super Admin generate kode di schools/{schoolId}/uninstallAccess (berlaku singkat)
   - Kode tampil otomatis di Admin Sekolah
   - APK memvalidasi kode ke RTDB (butuh internet)

## 5) Agenda Bimtek (Saran)
- Sesi 1 (Super Admin)
  - Struktur sistem, menu Super Admin, monitoring, keamanan (kode uninstall)
- Sesi 2 (Admin Sekolah)
  - Import/tambah siswa, monitoring, kode izin, cabut izin, kelulusan Kelas 9 (uninstall massal)
- Sesi 3 (APK Siswa)
  - Registrasi, status realtime, input/scan kode izin, uninstall resmi
- Sesi 4 (SOP dan Troubleshooting)
  - Reset admin, masalah offline, mapping siswa-sekolah, masalah device binding

## 6) Praktik Langsung (Checklist)
### 6.1 Checklist Super Admin
- Login Super Admin.
- Menu Sekolah:
  - Pastikan sekolah aktif (status Aktif).
  - Pastikan NPSN terisi untuk login Admin Sekolah.
- Menu Admin:
  - Pastikan admin sekolah ter-assign ke sekolah yang benar.
- Menu Monitoring:
  - Pastikan jumlah siswa aktif berubah realtime saat ada siswa aktif.
- Menu Keamanan:
  - Kode Uninstall (Per Sekolah): pilih sekolah lalu klik Generate.

### 6.2 Checklist Admin Sekolah
- Login Admin Sekolah (NPSN + password).
- Manajemen Data Siswa:
  - Import Excel atau tambah siswa manual.
  - Pastikan data siswa muncul.
  - Pastikan students/{nisn}.schoolId terisi (penting untuk fitur lintas sekolah dan monitoring super admin).
- Monitoring:
  - Pastikan status siswa berubah realtime (Online/Offline) saat perangkat aktif.
- Kode Izin:
  - Atur jam mulai–akhir, klik Generate.
  - Minta siswa input/scan kode.
  - Verifikasi siswa menjadi aktif (active_sessions).
- Cabut Izin:
  - Klik Cabut Izin pada siswa yang sedang aktif.

### 6.3 Checklist APK Siswa
- Registrasi:
  - Input NISN/Nama/Kelas sesuai database.
- Uji kode izin:
  - Input/scan kode dari Admin Sekolah.
  - Pastikan izin aktif sesuai durasi.
- Uji uninstall:
  - Admin memberikan izin uninstall.
  - Pastikan muncul mode uninstall dan tombol uninstall.

## 7) SOP Operasional (Wajib Dipahami)
### 7.1 SOP Reset Password Admin Sekolah (Tanpa Backend)
Dipakai jika reset via email tidak masuk.
1. Firebase Console -> Authentication
2. Hapus user dengan email sistem: NPSN@edulock.local
3. Admin login ulang dengan password default admin123
4. Setelah login, admin wajib ganti password

### 7.2 SOP Kelulusan (Uninstall Massal Kelas 9)
Tujuan: seluruh Kelas 9 diizinkan uninstall.
1. Pastikan data siswa benar dan schoolId sudah terisi.
2. Saat internet tersedia:
   - Admin Sekolah klik Uninstall Kls 9
3. Proses uninstall di perangkat siswa.
4. Setelah selesai:
   - Admin Sekolah klik Cabut Kls 9 (disarankan agar izin tidak terbuka lama).

Catatan:
- Perangkat siswa sebaiknya online saat izin diberikan agar perubahan realtime masuk.

### 7.3 SOP Kode Uninstall Sekolah (Darurat Akses Admin/Uninstall)
Dipakai jika perlu akses cepat per sekolah.
1. Super Admin -> Keamanan -> Kode Uninstall (Per Sekolah) -> Generate
2. Admin Sekolah melihat kode/QR di Pengaturan Sistem
3. Masukkan/scan kode di perangkat siswa untuk akses uninstall

## 8) Troubleshooting Cepat
- Monitoring Super Admin tidak bisa hitung per sekolah:
  - Pastikan students/{nisn}.schoolId sudah terisi.
  - Solusi cepat: import ulang Excel siswa dari Admin Sekolah (mode update).
- Siswa tidak muncul aktif:
  - Pastikan siswa memasukkan kode izin valid dan belum expired.
  - Pastikan active_sessions/{nisn} terbentuk.
- Uninstall tidak jalan:
  - Pastikan students/{nisn}/uninstall_authorized = true (atau gunakan kode uninstall sekolah yang masih berlaku).
  - Pastikan perangkat online saat perubahan izin dikirim (minimal sekali).
- Registrasi siswa gagal:
  - Pastikan NISN ada di students dan Nama/Kelas cocok.

## 9) Lembar Catatan Peserta
- Nama Sekolah:
- Nama Admin:
- NPSN:
- Kontak (opsional):
- Catatan Kendala:
- Tindak Lanjut:
