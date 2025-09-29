package ru.fromchat.data.websocket

import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.websocket.WebSockets
import io.ktor.client.plugins.websocket.webSocket
import io.ktor.http.HttpMethod
import io.ktor.websocket.CloseReason
import io.ktor.websocket.DefaultWebSocketSession
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.readText
import io.ktor.websocket.send
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import ru.fromchat.data.models.DMDeletedPayload
import ru.fromchat.data.models.DMEditPayload
import ru.fromchat.data.models.DMEditRequest
import ru.fromchat.data.models.DmEnvelope
import ru.fromchat.data.models.Message
import ru.fromchat.data.models.MessageDeletedPayload
import ru.fromchat.data.models.MessageEditedPayload
import ru.fromchat.data.models.SendMessageWebSocketRequest
import ru.fromchat.data.models.WebSocketCredentials
import ru.fromchat.data.models.WebSocketMessage

class WebSocketService {
    private var client: HttpClient? = null
    private var session: DefaultWebSocketSession? = null
    private val _messages = MutableSharedFlow<Message>()
    private val _dmMessages = MutableSharedFlow<DmEnvelope>()
    private val _messageEdited = MutableSharedFlow<MessageEditedPayload>()
    private val _messageDeleted = MutableSharedFlow<MessageDeletedPayload>()
    private val _dmEdited = MutableSharedFlow<DMEditPayload>()
    private val _dmDeleted = MutableSharedFlow<DMDeletedPayload>()

    val messages: SharedFlow<Message> = _messages.asSharedFlow()
    val dmMessages: SharedFlow<DmEnvelope> = _dmMessages.asSharedFlow()
    val messageEdited: SharedFlow<MessageEditedPayload> = _messageEdited.asSharedFlow()
    val messageDeleted: SharedFlow<MessageDeletedPayload> = _messageDeleted.asSharedFlow()
    val dmEdited: SharedFlow<DMEditPayload> = _dmEdited.asSharedFlow()
    val dmDeleted: SharedFlow<DMDeletedPayload> = _dmDeleted.asSharedFlow()

    private var isConnected = false

    suspend fun connect(token: String): Result<Unit> {
        return try {
            client = HttpClient(OkHttp) {
                install(WebSockets)
            }
            
            client!!.webSocket(
                method = HttpMethod.Get,
                host = "fromchat.ru",
                port = 443,
                path = "/ws"
            ) {
                isConnected = true
                session = this
                
                // Send ping
                send(Json.encodeToString(WebSocketMessage(
                    type = "ping",
                    credentials = WebSocketCredentials("Bearer", token),
                    data = JsonObject(emptyMap())
                )))
                
                // Listen for messages
                for (frame in incoming) {
                    if (frame is Frame.Text) {
                        handleMessage(frame.readText())
                    }
                }
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        } finally {
            session = null
        }
    }

    private suspend fun handleMessage(message: String) {
        try {
            val json = Json.parseToJsonElement(message)
            val type = json.jsonObject["type"]?.jsonPrimitive?.content ?: return
            
            when (type) {
                "newMessage" -> {
                    val data = json.jsonObject["data"]
                    if (data != null) {
                        val message = Json.decodeFromJsonElement(Message.serializer(), data)
                        _messages.emit(message)
                    }
                }
                "dmNew" -> {
                    val data = json.jsonObject["data"]
                    if (data != null) {
                        val dmMessage = Json.decodeFromJsonElement(DmEnvelope.serializer(), data)
                        _dmMessages.emit(dmMessage)
                    }
                }
                "messageEdited" -> {
                    val data = json.jsonObject["data"]
                    if (data != null) {
                        val edited = Json.decodeFromJsonElement(MessageEditedPayload.serializer(), data)
                        _messageEdited.emit(edited)
                    }
                }
                "messageDeleted" -> {
                    val data = json.jsonObject["data"]
                    if (data != null) {
                        val deleted = Json.decodeFromJsonElement(MessageDeletedPayload.serializer(), data)
                        _messageDeleted.emit(deleted)
                    }
                }
                "dmEdited" -> {
                    val data = json.jsonObject["data"]
                    if (data != null) {
                        val edited = Json.decodeFromJsonElement(DMEditPayload.serializer(), data)
                        _dmEdited.emit(edited)
                    }
                }
                "dmDeleted" -> {
                    val data = json.jsonObject["data"]
                    if (data != null) {
                        val deleted = Json.decodeFromJsonElement(DMDeletedPayload.serializer(), data)
                        _dmDeleted.emit(deleted)
                    }
                }
            }
        } catch (e: Exception) {
            // Handle parsing errors silently
        }
    }

    suspend fun sendMessage(token: String, content: String, replyToId: Int? = null) {
        try {
            val message = WebSocketMessage(
                type = "sendMessage",
                credentials = WebSocketCredentials("Bearer", token),
                data = SendMessageWebSocketRequest(content, replyToId)
            )
            session?.send(Frame.Text(Json.encodeToString(message)))
        } catch (e: Exception) {
            // Handle send errors
        }
    }

    suspend fun sendDm(token: String, recipientId: Int, recipientPublicKey: String, plaintext: String, replyToId: Int? = null) {
        // This would need encryption implementation
        // For now, just a placeholder
    }

    suspend fun editDm(token: String, dmEditRequest: DMEditRequest) {
        try {
            val message = WebSocketMessage(
                type = "dmEdit",
                credentials = WebSocketCredentials("Bearer", token),
                data = dmEditRequest
            )
            session?.send(Frame.Text(Json.encodeToString(message)))
        } catch (e: Exception) {
            // Handle send errors
        }
    }

    suspend fun disconnect() {
        try {
            session?.close(CloseReason(CloseReason.Codes.NORMAL, "Client disconnect"))
            client?.close()
            isConnected = false
        } catch (e: Exception) {
            // Handle disconnect errors
        }
    }

    fun isConnected(): Boolean = isConnected
}
