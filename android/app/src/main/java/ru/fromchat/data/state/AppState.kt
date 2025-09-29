package ru.fromchat.data.state

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import ru.fromchat.data.models.Message
import ru.fromchat.data.models.User

data class ChatState(
    val messages: List<Message> = emptyList(),
    val currentChat: String = "Общий чат",
    val activeTab: ChatTabs = ChatTabs.CHATS,
    val dmUsers: List<User> = emptyList(),
    val activeDm: ActiveDM? = null,
    val isChatSwitching: Boolean = false
)

data class UserState(
    val currentUser: User? = null,
    val authToken: String? = null
)

data class ActiveDM(
    val userId: Int,
    val username: String,
    val publicKey: String?
)

enum class ChatTabs {
    CHATS, CHANNELS, CONTACTS, DMS
}

enum class Page {
    LOGIN, REGISTER, CHAT
}

object AppState {
    var currentPage by mutableStateOf(Page.LOGIN)
    
    var chat by mutableStateOf(ChatState())
        private set
    
    var user by mutableStateOf(UserState())
        private set
    
    fun addMessage(message: Message) {
        chat = chat.copy(
            messages = chat.messages + message
        )
    }
    
    fun updateMessage(messageId: Int, updatedMessage: Message) {
        chat = chat.copy(
            messages = chat.messages.map { if (it.id == messageId) updatedMessage else it }
        )
    }
    
    fun removeMessage(messageId: Int) {
        chat = chat.copy(
            messages = chat.messages.filter { it.id != messageId }
        )
    }
    
    fun clearMessages() {
        chat = chat.copy(messages = emptyList())
    }
    
    fun setCurrentChat(chatName: String) {
        chat = chat.copy(currentChat = chatName)
    }
    
    fun setActiveTab(tab: ChatTabs) {
        chat = chat.copy(activeTab = tab)
    }
    
    fun setDmUsers(users: List<User>) {
        chat = chat.copy(dmUsers = users)
    }
    
    fun setActiveDm(dm: ActiveDM?) {
        chat = chat.copy(activeDm = dm)
    }
    
    fun setIsChatSwitching(value: Boolean) {
        chat = chat.copy(isChatSwitching = value)
    }
    
    fun setUser(token: String, user: User) {
        this.user = UserState(currentUser = user, authToken = token)
    }
    
    fun logout() {
        user = UserState()
        currentPage = Page.LOGIN
        chat = ChatState()
    }
}
