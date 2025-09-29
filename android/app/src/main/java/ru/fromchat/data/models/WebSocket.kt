package ru.fromchat.data.models

import kotlinx.serialization.Serializable

@Serializable
data class WebSocketMessage<T>(
    val type: String,
    val credentials: WebSocketCredentials? = null,
    val data: T? = null,
    val error: WebSocketError? = null
)

@Serializable
data class WebSocketError(
    val code: Int,
    val detail: String
)

@Serializable
data class WebSocketCredentials(
    val scheme: String,
    val credentials: String
)

@Serializable
data class SendMessageWebSocketRequest(
    val content: String,
    val reply_to_id: Int? = null
)

@Serializable
data class DMEditPayload(
    val id: Int,
    val iv: String,
    val ciphertext: String,
    val iv2: String,
    val wrappedMk: String,
    val salt: String
)

@Serializable
data class DMEditRequest(
    val id: Int,
    val iv: String,
    val ciphertext: String,
    val iv2: String,
    val wrappedMk: String,
    val salt: String
)

@Serializable
data class MessageEditedPayload(
    val id: Int,
    val username: String? = null,
    val content: String? = null,
    val is_read: Boolean? = null,
    val is_edited: Boolean? = null,
    val timestamp: String? = null,
    val profile_picture: String? = null,
    val reply_to: Message? = null,
    val files: List<Attachment>? = null
)

@Serializable
data class MessageDeletedPayload(
    val message_id: Int
)

@Serializable
data class DMDeletedPayload(
    val id: Int,
    val senderId: Int,
    val recipientId: Int
)
