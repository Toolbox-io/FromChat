package ru.fromchat.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Contacts
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.QuestionMark
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SecondaryTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ru.fromchat.data.models.Message
import ru.fromchat.data.state.AppState
import ru.fromchat.data.state.ChatTabs
import ru.fromchat.ui.LocalNavController
import ru.fromchat.ui.components.FilePicker

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen() {
    val chatState = AppState.chat
    val navController = LocalNavController.current
    var showSettings by remember { mutableStateOf(false) }
    var showProfile by remember { mutableStateOf(false) }
    
    if (showSettings) {
        SettingsScreen(
            onBackClick = { showSettings = false }
        )
        return
    }
    
    if (showProfile) {
        ProfileScreen(
            onBackClick = { showProfile = false }
        )
        return
    }
    
    Column(
        modifier = Modifier.fillMaxSize()
    ) {
        // Top App Bar
        TopAppBar(
            title = { Text("FromChat") },
            actions = {
                IconButton(onClick = { showProfile = true }) {
                    Icon(Icons.Default.Person, contentDescription = "Профиль")
                }
                IconButton(onClick = { showSettings = true }) {
                    Icon(Icons.Default.Settings, contentDescription = "Настройки")
                }
                IconButton(onClick = { 
                    AppState.logout()
                    navController.navigate("login")
                }) {
                    Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Выйти")
                }
            }
        )
        
        // Chat Tabs
        SecondaryTabRow(
            selectedTabIndex = when (chatState.activeTab) {
                ChatTabs.CHATS -> 0
                ChatTabs.CHANNELS -> 1
                ChatTabs.CONTACTS -> 2
                ChatTabs.DMS -> 3
            }
        ) {
            Tab(
                selected = chatState.activeTab == ChatTabs.CHATS,
                onClick = { AppState.setActiveTab(ChatTabs.CHATS) },
                text = { Text("Чаты") },
                icon = { Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = null) }
            )
            Tab(
                selected = chatState.activeTab == ChatTabs.CHANNELS,
                onClick = { AppState.setActiveTab(ChatTabs.CHANNELS) },
                text = { Text("Каналы") },
                icon = { Icon(Icons.Default.QuestionMark, contentDescription = null) }
            )
            Tab(
                selected = chatState.activeTab == ChatTabs.CONTACTS,
                onClick = { AppState.setActiveTab(ChatTabs.CONTACTS) },
                text = { Text("Контакты") },
                icon = { Icon(Icons.Default.Contacts, contentDescription = null) }
            )
            Tab(
                selected = chatState.activeTab == ChatTabs.DMS,
                onClick = { AppState.setActiveTab(ChatTabs.DMS) },
                text = { Text("ЛС") },
                icon = { Icon(Icons.Default.Mail, contentDescription = null) }
            )
        }
        
        // Content based on active tab
        when (chatState.activeTab) {
            ChatTabs.CHATS -> {
                ChatTabContent()
            }
            ChatTabs.CHANNELS -> {
                ChannelsTabContent()
            }
            ChatTabs.CONTACTS -> {
                ContactsTabContent()
            }
            ChatTabs.DMS -> {
                DMsTabContent()
            }
        }
    }
}

@Composable
fun ChatTabContent() {
    val chatState = AppState.chat
    
    Column(
        modifier = Modifier.fillMaxSize()
    ) {
        // Chat list
        LazyColumn(
            modifier = Modifier.weight(1f)
        ) {
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(8.dp),
                    onClick = { AppState.setCurrentChat("Общий чат") }
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.Chat,
                            contentDescription = null,
                            modifier = Modifier.size(40.dp)
                        )
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text(
                                text = "Общий чат",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Последнее сообщение",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
        
        // Messages area
        if (chatState.currentChat.isNotEmpty()) {
            MessagesArea()
        }
    }
}

@Composable
fun ChannelsTabContent() {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp)
    ) {
        item {
            Text(
                text = "Каналы",
                style = MaterialTheme.typography.headlineSmall
            )
        }
        item {
            Text(
                text = "Функция каналов будет добавлена в будущих версиях",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun ContactsTabContent() {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp)
    ) {
        item {
            Text(
                text = "Контакты",
                style = MaterialTheme.typography.headlineSmall
            )
        }
        item {
            Text(
                text = "Функция контактов будет добавлена в будущих версиях",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun DMsTabContent() {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp)
    ) {
        item {
            Text(
                text = "Личные сообщения",
                style = MaterialTheme.typography.headlineSmall
            )
        }
        item {
            Text(
                text = "Функция личных сообщений будет добавлена в будущих версиях",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun MessagesArea() {
    val chatState = AppState.chat
    val listState = rememberLazyListState()
    
    Column(
        modifier = Modifier.fillMaxSize()
    ) {
        // Messages
        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(chatState.messages) { message ->
                MessageItem(message = message)
            }
        }
        
        // Message input
        MessageInput()
    }
}

@Composable
fun MessageItem(message: Message) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = message.username,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = message.timestamp,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = message.content,
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

@Composable
fun MessageInput() {
    var messageText by remember { mutableStateOf("") }
    var selectedFiles by remember { mutableStateOf<List<android.net.Uri>>(emptyList()) }
    var showFilePicker by remember { mutableStateOf(false) }
    
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
    ) {
        if (showFilePicker) {
            FilePicker(
                onFilesSelected = { files ->
                    selectedFiles = files
                },
                modifier = Modifier.fillMaxWidth()
            )
            
            Spacer(modifier = Modifier.height(8.dp))
        }
        
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = messageText,
                onValueChange = { messageText = it },
                placeholder = { Text("Введите сообщение...") },
                modifier = Modifier.weight(1f)
            )
            
            Spacer(modifier = Modifier.width(8.dp))
            
            IconButton(
                onClick = { showFilePicker = !showFilePicker }
            ) {
                Icon(Icons.Default.AttachFile, contentDescription = "Прикрепить файл")
            }
            
            IconButton(
                onClick = { 
                    if (messageText.isNotBlank() || selectedFiles.isNotEmpty()) {
                        // Send message with files
                        messageText = ""
                        selectedFiles = emptyList()
                        showFilePicker = false
                    }
                }
            ) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Отправить")
            }
        }
    }
}
