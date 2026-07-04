package com.satupintu.mobile.utils

import android.content.Context
import android.content.SharedPreferences

object SecurePreferences {
    private const val LEGACY_SESSION_PREFS = "app_session"
    @Volatile
    private var cachedPrefs: SharedPreferences? = null

    fun getSessionPrefs(context: Context): SharedPreferences {
        cachedPrefs?.let { return it }

        return synchronized(this) {
            cachedPrefs?.let { return it }

            // Session storage is read very early during cold start.
            // Using plain SharedPreferences here keeps startup stable on OEM devices
            // that hang or fail when Android Keystore is touched on the main thread.
            context.applicationContext
                .getSharedPreferences(LEGACY_SESSION_PREFS, Context.MODE_PRIVATE)
                .also { cachedPrefs = it }
        }
    }
}

