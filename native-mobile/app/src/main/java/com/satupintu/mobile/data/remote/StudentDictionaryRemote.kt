package com.satupintu.mobile.data.remote

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

data class DictionaryEntryResponse(
    val word: String? = null,
    val phonetic: String? = null,
    val phonetics: List<DictionaryPhoneticResponse> = emptyList(),
    val meanings: List<DictionaryMeaningResponse> = emptyList()
)

data class DictionaryPhoneticResponse(
    val text: String? = null,
    val audio: String? = null
)

data class DictionaryMeaningResponse(
    val partOfSpeech: String? = null,
    val definitions: List<DictionaryDefinitionResponse> = emptyList()
)

data class DictionaryDefinitionResponse(
    val definition: String? = null,
    val example: String? = null
)

data class TranslationResponse(
    val responseData: TranslationPayload? = null,
    val responseDetails: String? = null,
    val responseStatus: Int? = null,
    val matches: List<TranslationMatchPayload> = emptyList()
)

data class TranslationPayload(
    val translatedText: String? = null,
    val match: Double? = null
)

data class TranslationMatchPayload(
    val segment: String? = null,
    val translation: String? = null,
    val source: String? = null,
    val target: String? = null,
    val match: Double? = null
)

interface EnglishDictionaryApi {
    @GET("api/v2/entries/en/{word}")
    suspend fun getDefinition(@Path("word") word: String): List<DictionaryEntryResponse>
}

interface TranslationApi {
    @GET("get")
    suspend fun translate(
        @Query("q") text: String,
        @Query("langpair") langPair: String
    ): TranslationResponse
}

object StudentDictionaryRemote {
    private const val ENGLISH_DICTIONARY_BASE_URL = "https://api.dictionaryapi.dev/"
    private const val TRANSLATION_BASE_URL = "https://api.mymemory.translated.net/"

    val englishDictionaryApi: EnglishDictionaryApi by lazy {
        Retrofit.Builder()
            .baseUrl(ENGLISH_DICTIONARY_BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(EnglishDictionaryApi::class.java)
    }

    val translationApi: TranslationApi by lazy {
        Retrofit.Builder()
            .baseUrl(TRANSLATION_BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(TranslationApi::class.java)
    }
}
