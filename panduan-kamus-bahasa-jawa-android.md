# Panduan Membuat Aplikasi Kamus Bahasa Jawa (Android)

Aplikasi ini menerjemahkan kata antara **Bahasa Indonesia ↔ Bahasa Jawa** secara online (via MyMemory API), lalu menampilkan hasilnya juga dalam **Aksara Jawa (Hanacaraka)** menggunakan konverter transliterasi otomatis.

---

## Langkah 1 — Siapkan Proyek Android

1. Buka **Android Studio** → New Project → pilih template **Empty Views Activity**
2. Bahasa: **Kotlin**
3. Minimum SDK: **API 24 (Android 7.0)** atau lebih tinggi
4. Beri nama proyek, misalnya `KamusJawa`

---

## Langkah 2 — Tambahkan Izin Internet

Buka `AndroidManifest.xml`, tambahkan di dalam tag `<manifest>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

---

## Langkah 3 — Tambahkan Dependency Retrofit

Buka `app/build.gradle`, tambahkan di dalam blok `dependencies { }`:

```gradle
implementation 'com.squareup.retrofit2:retrofit:2.9.0'
implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
```

Klik **Sync Now** setelah menambahkan.

---

## Langkah 4 — Model Data Terjemahan

Buat file `TranslationResponse.kt`:

```kotlin
data class TranslationResponse(
    val responseData: ResponseData
)

data class ResponseData(
    val translatedText: String
)
```

---

## Langkah 5 — Interface API (MyMemory)

Buat file `JawaTranslateApi.kt`:

```kotlin
import retrofit2.Call
import retrofit2.http.GET
import retrofit2.http.Query

interface JawaTranslateApi {
    @GET("get")
    fun translate(
        @Query("q") text: String,
        @Query("langpair") langPair: String // contoh: "id|jv" atau "jv|id"
    ): Call<TranslationResponse>
}
```

---

## Langkah 6 — Retrofit Client

Buat file `JawaRetrofitClient.kt`:

```kotlin
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object JawaRetrofitClient {
    private const val BASE_URL = "https://api.mymemory.translated.net/"

    val api: JawaTranslateApi by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(JawaTranslateApi::class.java)
    }
}
```

---

## Langkah 7 — Konverter Aksara Jawa (Hanacaraka)

Buat file `HanacarakaConverter.kt`.

> Catatan: ini transliterasi otomatis berbasis aturan sederhana (bukan mesin linguistik lengkap). Cukup baik untuk kata-kata umum, tapi belum menangani kasus rumit seperti aksara murda atau pengecualian ejaan kata serapan.

```kotlin
object HanacarakaConverter {

    private val consonantMap = mapOf(
        "ng" to "\uA994", "ny" to "\uA99A", "dh" to "\uA99D", "th" to "\uA99B",
        "b" to "\uA9A7", "c" to "\uA995", "d" to "\uA9A2", "f" to "\uA9A5",
        "g" to "\uA992", "h" to "\uA9B2", "j" to "\uA997", "k" to "\uA98F",
        "l" to "\uA9AD", "m" to "\uA9A9", "n" to "\uA9A4", "p" to "\uA9A5",
        "q" to "\uA98F", "r" to "\uA9AB", "s" to "\uA9B1", "t" to "\uA9A0",
        "v" to "\uA9AE", "w" to "\uA9AE", "x" to "\uA9B1", "y" to "\uA9AA",
        "z" to "\uA9B1"
    )

    private val consonantKeys = listOf(
        "ng", "ny", "dh", "th", "b", "c", "d", "f", "g", "h", "j", "k",
        "l", "m", "n", "p", "q", "r", "s", "t", "v", "w", "x", "y", "z"
    )

    private val vowelIndependent = mapOf(
        "a" to "\uA984", "i" to "\uA986", "u" to "\uA988",
        "e" to "\uA98C", "o" to "\uA98E"
    )

    private val vowelSign = mapOf(
        "i" to "\uA9B6", "u" to "\uA9B8", "e" to "\uA9BC", "o" to "\uA9BA\uA9B4"
    )

    private const val PANGKON = "\uA9C0"
    private val vowels = listOf("a", "i", "u", "e", "o")

    fun convert(text: String): String {
        return text.lowercase()
            .split(Regex("\\s+"))
            .joinToString(" ") { convertWord(it) }
    }

    private fun convertWord(word: String): String {
        val result = StringBuilder()
        var i = 0

        while (i < word.length) {
            val matchedConsonant = consonantKeys
                .sortedByDescending { it.length }
                .firstOrNull { word.startsWith(it, i) }

            if (matchedConsonant != null) {
                i += matchedConsonant.length
                val base = consonantMap[matchedConsonant] ?: ""

                if (i < word.length && word[i].toString() in vowels) {
                    val v = word[i].toString()
                    i++
                    result.append(if (v == "a") base else base + (vowelSign[v] ?: ""))
                } else {
                    result.append(base + PANGKON)
                }
            } else if (word[i].toString() in vowels) {
                val v = word[i].toString()
                i++
                result.append(vowelIndependent[v] ?: "")
            } else {
                i++ // karakter tidak dikenali, dilewati
            }
        }
        return result.toString()
    }
}
```

---

## Langkah 8 — Siapkan Font Hanacaraka

Tanpa langkah ini, Aksara Jawa akan tampil sebagai kotak kosong di HP.

1. Download font **Noto Sans Javanese** (gratis, dari Google Fonts)
2. Buat folder `app/src/main/assets/fonts/`
3. Taruh file `NotoSansJavanese-Regular.ttf` di folder tersebut

---

## Langkah 9 — Layout Tampilan

Buat file `res/layout/activity_kamus_jawa.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="16dp">

    <EditText
        android:id="@+id/etKata"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:hint="Masukkan kata..." />

    <RadioGroup
        android:id="@+id/rgArah"
        android:orientation="horizontal"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="8dp">

        <RadioButton
            android:id="@+id/rbIdKeJawa"
            android:text="Indonesia → Jawa"
            android:checked="true" />

        <RadioButton
            android:id="@+id/rbJawaKeId"
            android:text="Jawa → Indonesia"
            android:layout_marginStart="16dp" />
    </RadioGroup>

    <Button
        android:id="@+id/btnTerjemah"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_gravity="end"
        android:layout_marginTop="8dp"
        android:text="Terjemahkan" />

    <TextView
        android:id="@+id/tvHasilJawa"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:textSize="16sp"
        android:padding="8dp"
        android:layout_marginTop="12dp" />

    <TextView
        android:id="@+id/tvAksaraJawa"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:textSize="24sp"
        android:layout_marginTop="8dp" />

</LinearLayout>
```

---

## Langkah 10 — Logic di Activity

Buat file `KamusJawaActivity.kt`:

```kotlin
import android.graphics.Typeface
import android.os.Bundle
import android.widget.RadioGroup
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class KamusJawaActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_kamus_jawa)

        val etKata = findViewById<android.widget.EditText>(R.id.etKata)
        val rgArah = findViewById<RadioGroup>(R.id.rgArah)
        val rbIdKeJawa = findViewById<android.widget.RadioButton>(R.id.rbIdKeJawa)
        val btnTerjemah = findViewById<android.widget.Button>(R.id.btnTerjemah)
        val tvHasil = findViewById<android.widget.TextView>(R.id.tvHasilJawa)
        val tvAksara = findViewById<android.widget.TextView>(R.id.tvAksaraJawa)

        // Terapkan font Hanacaraka
        val typefaceJawa = Typeface.createFromAsset(assets, "fonts/NotoSansJavanese-Regular.ttf")
        tvAksara.typeface = typefaceJawa

        btnTerjemah.setOnClickListener {
            val kata = etKata.text.toString().trim()
            if (kata.isEmpty()) {
                Toast.makeText(this, "Masukkan kata dulu", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val langPair = if (rbIdKeJawa.isChecked) "id|jv" else "jv|id"
            tvHasil.text = "Menerjemahkan..."
            tvAksara.text = ""

            JawaRetrofitClient.api.translate(kata, langPair)
                .enqueue(object : Callback<TranslationResponse> {
                    override fun onResponse(
                        call: Call<TranslationResponse>,
                        response: Response<TranslationResponse>
                    ) {
                        if (response.isSuccessful && response.body() != null) {
                            val hasil = response.body()!!.responseData.translatedText
                            tvHasil.text = "Hasil: $hasil"

                            // Tampilkan versi Aksara Jawa
                            val kataJawa = if (rbIdKeJawa.isChecked) hasil else kata
                            tvAksara.text = HanacarakaConverter.convert(kataJawa)
                        } else {
                            tvHasil.text = "Terjemahan tidak ditemukan."
                        }
                    }

                    override fun onFailure(call: Call<TranslationResponse>, t: Throwable) {
                        tvHasil.text = "Gagal terhubung: ${t.message}"
                    }
                })
        }
    }
}
```

---

## Langkah 11 — Jalankan dan Uji Coba

1. Sambungkan HP Android (aktifkan **USB Debugging**) atau pakai emulator
2. Klik tombol **Run** (▶) di Android Studio
3. Coba ketik kata seperti `makan`, `rumah`, `terima kasih` dan cek hasil terjemahan + aksaranya

---

## Langkah 12 — Catatan & Pengembangan Lanjutan

- Aplikasi ini **butuh koneksi internet** setiap kali mencari kata (tidak ada penyimpanan/cache lokal saat ini).
- Kualitas dukungan bahasa Jawa di MyMemory API **tidak sekuat** bahasa besar seperti Inggris — hasil kadang kurang akurat, terutama untuk kata yang punya tingkat tutur (ngoko/krama madya/krama inggil).
- Konverter Aksara Jawa bersifat **transliterasi otomatis sederhana**, cocok untuk kata umum tapi belum sepenuhnya menangani semua aturan penulisan tradisional.

### Ide pengembangan selanjutnya (opsional)
| Fitur | Deskripsi |
|---|---|
| Riwayat pencarian | Simpan kata yang pernah dicari pakai Room/SQLite |
| Mode offline | Cache hasil pencarian atau database kata lokal |
| Tingkat tutur | Tambahkan pilihan ngoko/krama madya/krama inggil |
| Audio pelafalan | Tambahkan text-to-speech bahasa Jawa |
| Bookmark/favorit | Simpan kata favorit untuk dibuka lagi nanti |

---

*Dibuat sebagai panduan referensi pengembangan aplikasi Kamus Bahasa Jawa Android.*
