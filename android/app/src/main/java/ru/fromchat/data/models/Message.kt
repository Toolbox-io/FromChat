package ru.fromchat.data.models

import kotlinx.serialization.Serializable

@Serializable
data class Message(
    val id: Int,
    val username: String,
    val content: String,
    val is_read: Boolean,
    val is_edited: Boolean,
    val timestamp: String,
    val profile_picture: String? = null,
    val reply_to: Message? = null,
    val files: List<Attachment>? = null,
    val runtimeData: RuntimeData? = null
)

@Serializable
data class Attachment(
    val path: String,
    val encrypted: Boolean,
    val name: String
)

@Serializable
data class RuntimeData(
    val dmEnvelope: DmEnvelope? = null,
    val sendingState: SendingState? = null
)

@Serializable
data class SendingState(
    val status: String, // 'sending' | 'sent' | 'failed'
    val tempId: String? = null,
    val retryData: RetryData? = null
)

@Serializable
data class RetryData(
    val content: String,
    val replyToId: Int? = null,
    val files: List<String>? = null
)

@Serializable
data class DmEnvelope(
    val id: Int,
    val senderId: Int,
    val recipientId: Int,
    val iv: String,
    val ciphertext: String,
    val salt: String,
    val iv2: String,
    val wrappedMk: String,
    val timestamp: String,
    val files: List<DmFile>? = null
)

@Serializable
data class DmFile(
    val name: String,
    val id: Int,
    val path: String
)
