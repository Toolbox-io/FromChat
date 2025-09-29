package ru.fromchat.data.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.forms.formData
import io.ktor.client.request.forms.submitFormWithBinaryData
import io.ktor.client.request.get
import io.ktor.client.request.headers
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import ru.fromchat.API_HOST
import ru.fromchat.data.models.BackupBlob
import ru.fromchat.data.models.DmEnvelope
import ru.fromchat.data.models.ErrorResponse
import ru.fromchat.data.models.LoginRequest
import ru.fromchat.data.models.LoginResponse
import ru.fromchat.data.models.RegisterRequest
import ru.fromchat.data.models.UploadPublicKeyRequest
import ru.fromchat.data.models.User
import ru.fromchat.data.models.UserProfile

class ApiService {
    private val client = HttpClient {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
            })
        }
    }

    private val baseUrl = "https://$API_HOST"

    suspend fun login(request: LoginRequest): Result<LoginResponse> {
        return try {
            val response = client.post("$baseUrl/login") {
                contentType(ContentType.Application.Json)
                setBody(request)
            }
            if (response.status.isSuccess()) {
                Result.success(response.body())
            } else {
                val error = response.body<ErrorResponse>()
                Result.failure(Exception(error.message))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun register(request: RegisterRequest): Result<LoginResponse> {
        return try {
            val response = client.post("$baseUrl/register") {
                contentType(ContentType.Application.Json)
                setBody(request)
            }
            if (response.status.isSuccess()) {
                Result.success(response.body())
            } else {
                val error = response.body<ErrorResponse>()
                Result.failure(Exception(error.message))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getUserProfile(token: String): Result<User> {
        return try {
            val response = client.get("$baseUrl/user/profile") {
                headers {
                    append(HttpHeaders.Authorization, "Bearer $token")
                }
            }
            if (response.status.isSuccess()) {
                Result.success(response.body())
            } else {
                Result.failure(Exception("Failed to get user profile"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getUserProfileByUsername(token: String, username: String): Result<UserProfile> {
        return try {
            val response = client.get("$baseUrl/user/profile/$username") {
                headers {
                    append(HttpHeaders.Authorization, "Bearer $token")
                }
            }
            if (response.status.isSuccess()) {
                Result.success(response.body())
            } else {
                Result.failure(Exception("Failed to get user profile"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getPublicKey(token: String): Result<String> {
        return try {
            val response = client.get("$baseUrl/crypto/public-key") {
                headers {
                    append(HttpHeaders.Authorization, "Bearer $token")
                }
            }
            if (response.status.isSuccess()) {
                val data = response.body<Map<String, String>>()
                Result.success(data["publicKey"] ?: "")
            } else {
                Result.failure(Exception("Failed to get public key"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun uploadPublicKey(token: String, publicKey: String): Result<Unit> {
        return try {
            val response = client.post("$baseUrl/crypto/public-key") {
                headers {
                    append(HttpHeaders.Authorization, "Bearer $token")
                }
                contentType(ContentType.Application.Json)
                setBody(UploadPublicKeyRequest(publicKey))
            }
            if (response.status.isSuccess()) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to upload public key"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun uploadBackupBlob(token: String, blob: String): Result<Unit> {
        return try {
            val response = client.post("$baseUrl/crypto/backup") {
                headers {
                    append(HttpHeaders.Authorization, "Bearer $token")
                }
                contentType(ContentType.Application.Json)
                setBody(BackupBlob(blob))
            }
            if (response.status.isSuccess()) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to upload backup"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getBackupBlob(token: String): Result<String> {
        return try {
            val response = client.get("$baseUrl/crypto/backup") {
                headers {
                    append(HttpHeaders.Authorization, "Bearer $token")
                }
            }
            if (response.status.isSuccess()) {
                val data = response.body<BackupBlob>()
                Result.success(data.blob)
            } else {
                Result.failure(Exception("Failed to get backup"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getDmUsers(token: String): Result<List<User>> {
        return try {
            val response = client.get("$baseUrl/dm/users") {
                headers {
                    append(HttpHeaders.Authorization, "Bearer $token")
                }
            }
            if (response.status.isSuccess()) {
                val data = response.body<Map<String, List<User>>>()
                Result.success(data["users"] ?: emptyList())
            } else {
                Result.failure(Exception("Failed to get DM users"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getDmMessages(token: String, userId: Int): Result<List<DmEnvelope>> {
        return try {
            val response = client.get("$baseUrl/dm/messages/$userId") {
                headers {
                    append(HttpHeaders.Authorization, "Bearer $token")
                }
            }
            if (response.status.isSuccess()) {
                val data = response.body<Map<String, List<DmEnvelope>>>()
                Result.success(data["messages"] ?: emptyList())
            } else {
                Result.failure(Exception("Failed to get DM messages"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun sendMessageWithFiles(
        token: String,
        content: String,
        replyToId: Int?,
        files: List<ByteArray>
    ): Result<Unit> {
        return try {
            val response = client.submitFormWithBinaryData(
                url = "$baseUrl/send_message",
                formData = formData {
                    append("payload", """{"content":"$content","reply_to_id":${replyToId ?: "null"}}""")
                    files.forEachIndexed { index, fileData ->
                        append("files", fileData, Headers.build {
                            append(HttpHeaders.ContentType, "application/octet-stream")
                            append(HttpHeaders.ContentDisposition, "filename=\"file$index\"")
                        })
                    }
                }
            ) {
                headers {
                    append(HttpHeaders.Authorization, "Bearer $token")
                }
            }
            if (response.status.isSuccess()) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to send message with files"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun sendDmWithFiles(
        token: String,
        recipientId: Int,
        dmPayload: String,
        files: List<ByteArray>,
        fileNames: List<String>
    ): Result<Unit> {
        return try {
            val response = client.submitFormWithBinaryData(
                url = "$baseUrl/send_dm",
                formData = formData {
                    append("dm_payload", dmPayload)
                    append("fileNames", fileNames.joinToString(","))
                    files.forEachIndexed { index, fileData ->
                        append("files", fileData, Headers.build {
                            append(HttpHeaders.ContentType, "application/octet-stream")
                            append(HttpHeaders.ContentDisposition, "filename=\"${fileNames[index]}\"")
                        })
                    }
                }
            ) {
                headers {
                    append(HttpHeaders.Authorization, "Bearer $token")
                }
            }
            if (response.status.isSuccess()) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to send DM with files"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
