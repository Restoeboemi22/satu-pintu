# Panduan Membuat Aplikasi Kamus Bahasa Inggris (Android)

Aplikasi ini mencari definisi kata **Bahasa Inggris** secara online (via dictionaryapi.dev), lengkap dengan pelafalan, jenis kata, dan contoh kalimat — lalu menerjemahkan hasilnya ke **Bahasa Indonesia** (via MyMemory API).

---

## Langkah 1 — Siapkan Proyek Android

1. Buka **Android Studio** → New Project → pilih template **Empty Views Activity**
2. Bahasa: **Kotlin**
3. Minimum SDK: **API 24 (Android 7.0)** atau lebih tinggi
4. Beri nama proyek, misalnya `KamusInggris`

---

## Langkah 2 — Tambahkan Izin Internet

Buka `AndroidManifest.xml`, tambahkan di dalam tag `<manifest>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

---

## Langkah 3 — Tambahkan Dependency

Buka `app/build.gradle`, tambahkan di dalam blok `dependencies { }`:

```gradle
dependencies {
    implementation 'com.squareup.retrofit2:retrofit:2.9.0'
    implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
}
```

Klik **Sync Now** setelah menambahkan.

---

## Langkah 4 — Model Data Kamus

Buat file `DictionaryResponse.kt`:

```kotlin
data class DictionaryResponse(
    val word: String,
    val phonetic: String?,
    val meanings: List<Meaning>
)

data class Meaning(
    val partOfSpeech: String,
    val definitions: List<Definition>
)

data class Definition(
    val definition: String,
    val example: String?
)
```

---

## Langkah 5 — Interface API Kamus (dictionaryapi.dev)

Buat file `DictionaryApi.kt`:

```kotlin
import retrofit2.Call
import retrofit2.http.GET
import retrofit2.http.Path

interface DictionaryApi {
    @GET("api/v2/entries/en/{word}")
    fun getDefinition(@Path("word") word: String): Call<List<DictionaryResponse>>
}
```

---

## Langkah 6 — Retrofit Client Kamus

Buat file `RetrofitClient.kt`:

```kotlin
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object RetrofitClient {
    private const val BASE_URL = "https://api.dictionaryapi.dev/"

    val api: DictionaryApi by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(DictionaryApi::class.java)
    }
}
```

---

## Langkah 7 — Model & API Terjemahan (MyMemory)

Buat file `TranslationResponse.kt`:

```kotlin
data class TranslationResponse(
    val responseData: ResponseData
)

data class ResponseData(
    val translatedText: String
)
```

Buat file `TranslateApi.kt`:

```kotlin
import retrofit2.Call
import retrofit2.http.GET
import retrofit2.http.Query

interface TranslateApi {
    @GET("get")
    fun translate(
        @Query("q") text: String,
        @Query("langpair") langPair: String = "en|id"
    ): Call<TranslationResponse>
}
```

Buat file `TranslateRetrofitClient.kt`:

```kotlin
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object TranslateRetrofitClient {
    private const val BASE_URL = "https://api.mymemory.translated.net/"

    val api: TranslateApi by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(TranslateApi::class.java)
    }
}
```

---

## Langkah 8 — Layout Tampilan

Buat file `res/layout/activity_main.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="16dp">

    <EditText
        android:id="@+id/etWord"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:hint="Masukkan kata bahasa Inggris..." />

    <Button
        android:id="@+id/btnSearch"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_gravity="end"
        android:text="Cari" />

    <ScrollView
        android:layout_width="match_parent"
        android:layout_height="match_parent">

        <TextView
            android:id="@+id/tvResult"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:textSize="16sp"
            android:padding="8dp" />
    </ScrollView>

</LinearLayout>
```

---

## Langkah 9 — Logic di Activity

Buat file `MainActivity.kt`:

```kotlin
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val etWord = findViewById<android.widget.EditText>(R.id.etWord)
        val btnSearch = findViewById<android.widget.Button>(R.id.btnSearch)
        val tvResult = findViewById<android.widget.TextView>(R.id.tvResult)

        btnSearch.setOnClickListener {
            val word = etWord.text.toString().trim()
            if (word.isEmpty()) {
                Toast.makeText(this, "Masukkan kata dulu", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            tvResult.text = "Mencari..."

            RetrofitClient.api.getDefinition(word)
                .enqueue(object : Callback<List<DictionaryResponse>> {
                    override fun onResponse(
                        call: Call<List<DictionaryResponse>>,
                        response: Response<List<DictionaryResponse>>
                    ) {
                        if (response.isSuccessful && response.body() != null) {
                            val data = response.body()!!.first()
                            val sb = StringBuilder()
                            sb.append("Kata: ${data.word}\n")
                            data.phonetic?.let { sb.append("Pelafalan: $it\n") }
                            sb.append("\n")

                            data.meanings.forEach { meaning ->
                                sb.append("(${meaning.partOfSpeech})\n")
                                meaning.definitions.forEachIndexed { i, def ->
                                    sb.append("${i + 1}. ${def.definition}\n")
                                    def.example?.let { sb.append("   Contoh: $it\n") }
                                }
                                sb.append("\n")
                            }

                            tvResult.text = sb.toString()

                            // Panggil terjemahan setelah definisi bahasa Inggris tampil
                            translateWord(word, tvResult, sb.toString())

                        } else {
                            tvResult.text = "Kata tidak ditemukan."
                        }
                    }

                    override fun onFailure(call: Call<List<DictionaryResponse>>, t: Throwable) {
                        tvResult.text = "Gagal terhubung: ${t.message}"
                    }
                })
        }
    }

    private fun translateWord(word: String, tvResult: android.widget.TextView, previousText: String) {
        TranslateRetrofitClient.api.translate(word)
            .enqueue(object : Callback<TranslationResponse> {
                override fun onResponse(
                    call: Call<TranslationResponse>,
                    response: Response<TranslationResponse>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        val terjemahan = response.body()!!.responseData.translatedText
                        tvResult.text = "$previousText\nTerjemahan Indonesia: $terjemahan"
                    }
                }

                override fun onFailure(call: Call<TranslationResponse>, t: Throwable) {
                    // Kalau gagal, biarkan hasil definisi bahasa Inggris tetap tampil
                }
            })
    }
}
```

---

## Langkah 10 — Jalankan dan Uji Coba

1. Sambungkan HP Android (aktifkan **USB Debugging**) atau pakai emulator
2. Klik tombol **Run** (▶) di Android Studio
3. Coba ketik kata seperti `beautiful`, `library`, `run` dan cek hasil definisi + terjemahannya

---

## Langkah 11 — Catatan & Pengembangan Lanjutan

- Aplikasi ini **butuh koneksi internet** setiap kali mencari kata — tidak ada riwayat, cache, atau database lokal.
- `dictionaryapi.dev` gratis dan tidak perlu API key, tapi hanya menyediakan definisi dalam **Bahasa Inggris** (bukan kamus dwibahasa asli) — terjemahan Indonesia ditambahkan lewat API terpisah (MyMemory).
- Kalau terjemahan gagal (misal limit API tercapai), definisi bahasa Inggris tetap tampil normal.

### Ide pengembangan selanjutnya (opsional)
| Fitur | Deskripsi |
|---|---|
| Audio pelafalan | API `dictionaryapi.dev` menyediakan field `audio` di data `phonetics` — bisa diputar pakai `MediaPlayer` |
| Riwayat pencarian | Simpan kata yang pernah dicari pakai Room/SQLite |
| Mode offline | Cache hasil pencarian atau database kata lokal |
| Bookmark/favorit | Simpan kata favorit untuk dibuka lagi nanti |
| Terjemahan dua arah | Tambahkan pencarian Indonesia → Inggris |

---

*Dibuat sebagai panduan referensi pengembangan aplikasi Kamus Bahasa Inggris Android.*
