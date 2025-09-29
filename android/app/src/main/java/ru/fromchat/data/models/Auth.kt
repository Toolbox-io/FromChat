package ru.fromchat.data.models

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val username: String,
    val password: String
)

@Serializable
data class RegisterRequest(
    val username: String,
    val password: String,
    val confirm_password: String
)

@Serializable
data class LoginResponse(
    val user: User,
    val token: String
)

@Serializable
data class ErrorResponse(
    val message: String
)

@Serializable
data class UploadPublicKeyRequest(
    val publicKey: String
)

@Serializable
data class SendDMRequest(
    val recipientId: Int,
    val iv: String,
    val ciphertext: String,
    val salt: String,
    val iv2: String,
    val wrappedMk: String,
    val replyToId: Int? = null
)

@Serializable
data class BackupBlob(
    val blob: String
)

@Serializable
data class SendMessageRequest(
    val content: String,
    val reply_to_id: Int? = null
)
