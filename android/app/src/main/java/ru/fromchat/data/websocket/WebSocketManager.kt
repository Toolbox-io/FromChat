package ru.fromchat.data.websocket

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.fromchat.data.state.AppState

class WebSocketManager {
    private val webSocketService = WebSocketService()
    private var isConnected = false
    
    private val _connectionState = MutableStateFlow(false)
    val connectionState: StateFlow<Boolean> = _connectionState.asStateFlow()
    
    suspend fun connect(token: String): Result<Unit> {
        return try {
            val result = webSocketService.connect(token)
            if (result.isSuccess) {
                isConnected = true
                _connectionState.value = true
                startMessageHandling()
            }
            result
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    private fun startMessageHandling() {
        CoroutineScope(Dispatchers.IO).launch {
            webSocketService.messages.collect { message ->
                AppState.addMessage(message)
            }
        }
        
        CoroutineScope(Dispatchers.IO).launch {
            webSocketService.dmMessages.collect { dmMessage ->
                // Handle DM messages
                // Convert DmEnvelope to Message if needed
            }
        }
        
        CoroutineScope(Dispatchers.IO).launch {
            webSocketService.messageEdited.collect { edited ->
                // Handle message edits
            }
        }
        
        CoroutineScope(Dispatchers.IO).launch {
            webSocketService.messageDeleted.collect { deleted ->
                AppState.removeMessage(deleted.message_id)
            }
        }
    }
    
    suspend fun sendMessage(content: String, replyToId: Int? = null) {
        val token = AppState.user.authToken ?: return
        webSocketService.sendMessage(token, content, replyToId)
    }
    
    suspend fun sendDm(recipientId: Int, recipientPublicKey: String, plaintext: String, replyToId: Int? = null) {
        val token = AppState.user.authToken ?: return
        webSocketService.sendDm(token, recipientId, recipientPublicKey, plaintext, replyToId)
    }
    
    suspend fun disconnect() {
        webSocketService.disconnect()
        isConnected = false
        _connectionState.value = false
    }
    
    fun isConnected(): Boolean = isConnected
}
