# Native Mobile Port V1

Port ini berasal dari `C:\Unified-System\apps\native-mobile` dan dibawa ke repo `D:\Satu Pintu` sebagai fondasi awal aplikasi Android Kotlin native untuk:

- `GAS Siswa`
- `GAS Guru`
- `GAS Kepala Sekolah`

Status saat ini:

- Struktur Gradle, manifest, Kotlin source, resource, screen, viewmodel, dan repository utama sudah dipindahkan.
- Namespace dasar sudah digeneralisasi menjadi `com.satupintu.mobile`.
- File sensitif dan hasil build lama tidak ikut dibawa.

File yang sengaja tidak ikut dipindahkan:

- `app/google-services.json`
- `keystore.properties`
- folder `keystore/`
- `local.properties`
- seluruh folder build/cache dari V1

Yang harus diisi manual sebelum build:

1. Tambahkan `app/google-services.json` dari Firebase project Android yang aktif.
2. Buat `local.properties` yang menunjuk ke Android SDK lokal.
3. Jika akan build release, buat `keystore.properties` dan siapkan keystore baru milik proyek ini.

Catatan penting:

- Port ini adalah fondasi referensi dari V1, belum final refactor penuh mengikuti struktur feature-first di `Kitab Suci`.
- Branding visual masih perlu dirapikan bertahap sesuai identitas final aplikasi `Satu Pintu`.
- Integrasi Firebase dan node backend wajib diselaraskan lagi dengan arsitektur multi-tenant repo saat ini sebelum rilis.

Perintah awal yang biasanya dipakai setelah file sensitif sudah siap:

```bash
gradlew.bat tasks
gradlew.bat assembleSiswaDebug
gradlew.bat assembleGuruDebug
gradlew.bat assembleKepalaDebug
```
