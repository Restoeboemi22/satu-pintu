# MonitoringService (Koordinator Monitoring)

Dokumen ini merangkum perilaku MonitoringService yang **sesuai dengan implementasi aplikasi saat ini**.

## Komponen yang berkolaborasi

- MonitoringService: service foreground yang melakukan pengecekan berkala dan mendengarkan status dari Firebase.
- OfflineMonitor: mengecek internet dan memicu lockdown jika offline terlalu lama.
- LocationMonitor: membaca lokasi (berbasis permission) dan mengecek “di dalam zona sekolah” berdasarkan konfigurasi yang tersimpan di Preferences.
- TrustScoreManager: mengelola skor kepercayaan (reward/punishment).
- GracePeriodManager: mengelola grace period.
- SchoolScheduleManager: menentukan jam sekolah berdasarkan konfigurasi start/end di Preferences.
- FirebaseReporter: mengirim status realtime ke Firebase (lokasi, inside zone, internet, trust score, statusMessage).

## Konfigurasi yang dipakai

- Jam sekolah: `schoolStartHour/schoolStartMinute` dan `schoolEndHour/schoolEndMinute` di Preferences.
  - Default: 07:00–15:00.
  - Berlaku semua hari kecuali Minggu (Minggu selalu bebas).
- Zona sekolah: `schoolLatitude/schoolLongitude/schoolRadius` di Preferences.
  - Biasanya di-update dari dashboard melalui node `school_config` (aplikasi menyimpan ke Preferences).

## Listener Firebase (real-time)

MonitoringService mendengarkan beberapa node:

- `students/{nisn}/uninstall_authorized`
  - Jika `true`, service akan melepas proteksi uninstall (termasuk mencoba mencabut Device Admin agar uninstall bisa dilakukan).
- `school_config/is_holiday_mode`
  - Jika `true`, mode acara/libur aktif: monitoring dibypass (perangkat bebas).
- `school_config/is_active_protection`
  - Jika `false`, mode silent/bebas aktif: monitoring dibypass (perangkat bebas).
  - Jika `true`, proteksi aktif kembali: service memicu pengecekan langsung dan dapat mengunci ulang saat memenuhi kondisi.
- `students/{nisn}/device_uuid`
  - Jika berubah (berbeda dengan perangkat ini), dianggap konflik login perangkat: sesi diputus dan diarahkan ke registrasi.

## Siklus monitoring

- Service berjalan sebagai foreground service.
- Pengecekan awal dimulai setelah delay 10 detik (agar sistem stabil).
- Setelah itu, pengecekan berjalan tiap 3 detik.

## Urutan pengecekan utama (ringkas)

1. Pre-fetch status:
   - lokasi saat ini (jika ada), internet, trust score, jam sekolah, after school.
2. Emergency mode:
   - jika emergency unlock aktif dan internet sudah kembali, emergency dimatikan lalu monitoring lanjut.
3. Update status zona:
   - hitung apakah di dalam zona sekolah dan update `isInsideSchoolZone`.
   - konsep “sticky state”: jika proteksi aktif dan masih jam sekolah, status inside bisa dipertahankan untuk mendeteksi kabur (tergantung kondisi dan update lokasi yang masuk).
4. Kirim laporan realtime ke Firebase (selalu jalan):
   - latitude/longitude (jika ada), insideZone, internet, trust score, status message.
5. Bypass mode:
   - jika `is_holiday_mode = true` → berhenti (bebas).
   - jika `is_active_protection = false` → berhenti (bebas) dan kirim broadcast untuk melepas lock/kiosk.
6. Proteksi aktif:
   - cek accessibility service (wajib saat proteksi aktif). Jika mati, service akan memaksa user kembali mengaktifkan (lock screen / prompt sesuai kondisi).
   - jalankan OfflineMonitor + TrustScoreManager + GracePeriodManager sesuai implementasi.

## Catatan penting (perbedaan dengan versi lama)

- Dokumen lama menyebut jadwal Senin–Sabtu berbeda-beda. Implementasi sekarang memakai jam dinamis dari Preferences (yang bisa diatur dari dashboard), dan Minggu selalu bebas.
- Interval monitoring bukan 5 detik, tetapi 3 detik (setelah delay awal 10 detik).
- Detail “GPS dimatikan langsung lockdown” tidak sepenuhnya berada di MonitoringService; sebagian enforcement GPS dan UI status berada di MainActivity/overlay. MonitoringService fokus pada koordinasi dan enforcement berbasis status global (silent/holiday/protection) + accessibility + offline + reporting.
