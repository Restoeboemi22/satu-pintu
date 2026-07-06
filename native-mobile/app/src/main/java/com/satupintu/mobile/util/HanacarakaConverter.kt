package com.satupintu.mobile.util

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
        "i" to "\uA9B6",
        "u" to "\uA9B8",
        "e" to "\uA9BC",
        "o" to "\uA9BA\uA9B4"
    )

    private const val PANGKON = "\uA9C0"
    private val vowels = setOf("a", "i", "u", "e", "o")

    fun convert(text: String): String {
        return text.lowercase()
            .split(Regex("\\s+"))
            .filter { it.isNotBlank() }
            .joinToString(" ") { convertWord(it) }
    }

    private fun convertWord(word: String): String {
        val cleanWord = word.filter { it.isLetter() }
        val result = StringBuilder()
        var index = 0

        while (index < cleanWord.length) {
            val matchedConsonant = consonantKeys
                .sortedByDescending { it.length }
                .firstOrNull { cleanWord.startsWith(it, index) }

            if (matchedConsonant != null) {
                index += matchedConsonant.length
                val base = consonantMap[matchedConsonant].orEmpty()

                if (index < cleanWord.length && cleanWord[index].toString() in vowels) {
                    val vowel = cleanWord[index].toString()
                    index += 1
                    result.append(if (vowel == "a") base else base + (vowelSign[vowel].orEmpty()))
                } else {
                    result.append(base).append(PANGKON)
                }
            } else if (cleanWord[index].toString() in vowels) {
                val vowel = cleanWord[index].toString()
                index += 1
                result.append(vowelIndependent[vowel].orEmpty())
            } else {
                index += 1
            }
        }

        return result.toString()
    }
}
