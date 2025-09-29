package ru.fromchat.data.settings

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit

class SettingsService(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("settings", Context.MODE_PRIVATE)
    
    companion object {
        private const val KEY_NOTIFICATIONS_ENABLED = "notifications_enabled"
        private const val KEY_SOUND_ENABLED = "sound_enabled"
        private const val KEY_VIBRATION_ENABLED = "vibration_enabled"
        private const val KEY_DARK_THEME = "dark_theme"
        private const val KEY_AUTO_DOWNLOAD = "auto_download"
        private const val KEY_IMAGE_QUALITY = "image_quality"
        private const val KEY_LANGUAGE = "language"
    }
    
    var notificationsEnabled: Boolean
        get() = prefs.getBoolean(KEY_NOTIFICATIONS_ENABLED, true)
        set(value) = prefs.edit { putBoolean(KEY_NOTIFICATIONS_ENABLED, value) }
    
    var soundEnabled: Boolean
        get() = prefs.getBoolean(KEY_SOUND_ENABLED, true)
        set(value) = prefs.edit { putBoolean(KEY_SOUND_ENABLED, value) }
    
    var vibrationEnabled: Boolean
        get() = prefs.getBoolean(KEY_VIBRATION_ENABLED, true)
        set(value) = prefs.edit { putBoolean(KEY_VIBRATION_ENABLED, value) }
    
    var darkTheme: Boolean
        get() = prefs.getBoolean(KEY_DARK_THEME, false)
        set(value) = prefs.edit { putBoolean(KEY_DARK_THEME, value) }
    
    var autoDownload: Boolean
        get() = prefs.getBoolean(KEY_AUTO_DOWNLOAD, true)
        set(value) = prefs.edit { putBoolean(KEY_AUTO_DOWNLOAD, value) }
    
    var imageQuality: String
        get() = prefs.getString(KEY_IMAGE_QUALITY, "high") ?: "high"
        set(value) = prefs.edit { putString(KEY_IMAGE_QUALITY, value) }
    
    var language: String
        get() = prefs.getString(KEY_LANGUAGE, "ru") ?: "ru"
        set(value) = prefs.edit { putString(KEY_LANGUAGE, value) }
    
    fun resetToDefaults() {
        prefs.edit { clear() }
    }
}
