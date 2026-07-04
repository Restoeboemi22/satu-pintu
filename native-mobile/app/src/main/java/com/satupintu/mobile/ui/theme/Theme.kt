package com.satupintu.mobile.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val DarkColorScheme = darkColorScheme(
    primary = GasGold,
    onPrimary = GasNavyDark,
    primaryContainer = GasNavyDark,
    onPrimaryContainer = GasOnDark,
    secondary = GasGold,
    onSecondary = GasNavyDark,
    tertiary = GasTeal,
    onTertiary = GasOnDark,
    background = GasNavyDark,
    onBackground = GasOnDark,
    surface = Color(0xFF101A25),
    onSurface = GasOnDark,
    surfaceVariant = Color(0xFF162232),
    onSurfaceVariant = Color(0xFFCAD6E6),
    outline = Color(0xFF2A3A52)
)

private val LightColorScheme = lightColorScheme(
    primary = GasNavy,
    onPrimary = GasOnDark,
    primaryContainer = Color(0xFFE2ECF8),
    onPrimaryContainer = GasNavy,
    secondary = GasGold,
    onSecondary = GasNavyDark,
    secondaryContainer = GasGoldSoft,
    onSecondaryContainer = GasNavyDark,
    tertiary = GasTeal,
    onTertiary = GasOnDark,
    tertiaryContainer = GasTealSoft,
    onTertiaryContainer = GasTeal,
    background = GasBackground,
    onBackground = GasOnLight,
    surface = GasSurface,
    onSurface = GasOnLight,
    surfaceVariant = Color(0xFFF0F4F9),
    onSurfaceVariant = Color(0xFF35465C),
    outline = GasOutline
)

@Composable
fun GaspaTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    // Dynamic color is available on Android 12+
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }

        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}

