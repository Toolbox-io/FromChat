package ru.fromchat.services

import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import ru.fromchat.data.auth.AuthService
import ru.fromchat.data.chat.ChatService
import ru.fromchat.data.notifications.NotificationService
import ru.fromchat.data.settings.SettingsService
import ru.fromchat.data.state.AppState
import ru.fromchat.data.state.Page

class AppService : Application() {
    private lateinit var authService: AuthService
    private lateinit var chatService: ChatService
    private lateinit var notificationService: NotificationService
    private lateinit var settingsService: SettingsService
    
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    override fun onCreate() {
        super.onCreate()
        
        // Initialize services
        authService = AuthService(this)
        chatService = ChatService()
        notificationService = NotificationService(this)
        settingsService = SettingsService(this)
        
        // Create notification channel
        notificationService.createNotificationChannel()
        
        // Try to restore user session
        serviceScope.launch {
            try {
                val result = authService.restoreUserFromStorage()
                if (result.isSuccess) {
                    AppState.currentPage = Page.CHAT
                    
                    // Initialize chat
                    val user = AppState.user.currentUser
                    val token = AppState.user.authToken
                    if (user != null && token != null) {
                        chatService.initializeChat(token)
                    }
                }
            } catch (e: Exception) {
                // Handle error silently
            }
        }
    }
    
    override fun onTerminate() {
        super.onTerminate()
        
        // Disconnect chat service
        serviceScope.launch {
            chatService.disconnect()
        }
        
        serviceScope.cancel()
    }
    
    fun getAuthService(): AuthService = authService
    fun getChatService(): ChatService = chatService
    fun getNotificationService(): NotificationService = notificationService
    fun getSettingsService(): SettingsService = settingsService
}
