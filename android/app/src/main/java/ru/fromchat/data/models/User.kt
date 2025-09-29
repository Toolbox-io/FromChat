package ru.fromchat.data.models

import kotlinx.serialization.Serializable

@Serializable
data class User(
    val id: Int,
    val username: String,
    val created_at: String,
    val last_seen: String,
    val online: Boolean,
    val admin: Boolean = false,
    val bio: String? = null,
    val profile_picture: String
)

@Serializable
data class UserProfile(
    val id: Int,
    val username: String,
    val profile_picture: String? = null,
    val bio: String? = null,
    val online: Boolean,
    val last_seen: String,
    val created_at: String
)
