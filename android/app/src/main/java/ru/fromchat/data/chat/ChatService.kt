package ru.fromchat.data.chat

import ru.fromchat.data.api.ApiService
import ru.fromchat.data.state.AppState
import ru.fromchat.data.websocket.WebSocketManager
import ru.fromchat.utils.crypto.CryptoUtils

class ChatService {
    private val apiService = ApiService()
    private val webSocketManager = WebSocketManager()
    
    suspend fun initializeChat(token: String): Result<Unit> {
        return try {
            // Connect WebSocket
            val wsResult = webSocketManager.connect(token)
            if (wsResult.isFailure) {
                return Result.failure(wsResult.exceptionOrNull() ?: Exception("WebSocket connection failed"))
            }
            
            // Load DM users
            val dmUsersResult = apiService.getDmUsers(token)
            if (dmUsersResult.isSuccess) {
                AppState.setDmUsers(dmUsersResult.getOrThrow())
            }
            
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun sendMessage(content: String, replyToId: Int? = null) {
        webSocketManager.sendMessage(content, replyToId)
    }
    
    suspend fun sendMessageWithFiles(content: String, replyToId: Int?, files: List<ByteArray>) {
        val token = AppState.user.authToken ?: return
        apiService.sendMessageWithFiles(token, content, replyToId, files)
    }
    
    suspend fun sendDm(recipientId: Int, content: String, replyToId: Int? = null) {
        val token = AppState.user.authToken ?: return
        val keys = AppState.user.currentUser?.let { getCurrentKeys() } ?: return
        
        // Get recipient's public key
        val dmUsers = AppState.chat.dmUsers
        val recipient = dmUsers.find { it.id == recipientId } ?: return
        
        // For now, send without encryption (would need proper encryption implementation)
        webSocketManager.sendDm(recipientId, "", content, replyToId)
    }
    
    suspend fun sendDmWithFiles(recipientId: Int, content: String, files: List<ByteArray>, fileNames: List<String>) {
        val token = AppState.user.authToken ?: return
        
        // Create DM payload (simplified, would need encryption)
        val dmPayload = """{"recipientId":$recipientId,"iv":"","ciphertext":"","salt":"","iv2":"","wrappedMk":""}"""
        
        apiService.sendDmWithFiles(token, recipientId, dmPayload, files, fileNames)
    }
    
    suspend fun loadDmMessages(userId: Int) {
        val token = AppState.user.authToken ?: return
        val result = apiService.getDmMessages(token, userId)
        if (result.isSuccess) {
            // Convert DmEnvelope to Message and add to state
            val dmMessages = result.getOrThrow()
            // This would need proper decryption and conversion
        }
    }
    
    suspend fun disconnect() {
        webSocketManager.disconnect()
    }
    
    private fun getCurrentKeys(): CryptoUtils.KeyPair? {
        // This would get the current user's encryption keys
        // For now, return null (would need proper key management)
        return null
    }
}
