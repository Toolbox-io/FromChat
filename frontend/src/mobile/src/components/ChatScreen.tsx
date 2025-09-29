import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  SafeAreaView, 
  StatusBar,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useMessages } from '../hooks/useMessages';
import { useWebSocket } from '../hooks/useWebSocket';
import type { Message } from '@common/core/types';

type ChatTab = 'chats' | 'channels' | 'contacts' | 'dms';

export default function ChatScreen() {
  const { user, authToken, logout } = useAuth();
  const { messages, isLoading, addMessage, updateMessage, removeMessage } = useMessages(authToken);
  const { isConnected, sendMessage } = useWebSocket(authToken);
  const [activeTab, setActiveTab] = useState<ChatTab>('chats');
  const [messageText, setMessageText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Handle WebSocket messages
  useEffect(() => {
    // WebSocket messages are handled in the useWebSocket hook
    // and automatically added to the messages state
  }, []);

  const handleSendMessage = () => {
    if (!messageText.trim()) return;

    sendMessage(messageText.trim(), replyingTo?.id);
    setMessageText('');
    setReplyingTo(null);
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
  };

  const handleEdit = (message: Message) => {
    // TODO: Implement message editing
    Alert.alert('Edit Message', 'Message editing will be implemented in a future update');
  };

  const handleDelete = (message: Message) => {
    // TODO: Implement message deletion
    Alert.alert('Delete Message', 'Message deletion will be implemented in a future update');
  };

  const renderTabBar = () => (
    <View style={styles.tabContainer}>
      {(['chats', 'channels', 'contacts', 'dms'] as ChatTab[]).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, activeTab === tab && styles.activeTab]}
          onPress={() => setActiveTab(tab)}
        >
          <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderMessage = (message: Message) => (
    <View key={message.id} style={styles.messageContainer}>
      <View style={styles.messageHeader}>
        <Text style={styles.messageUsername}>{message.username}</Text>
        <Text style={styles.messageTime}>
          {new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>
      
      {message.reply_to && (
        <View style={styles.replyContainer}>
          <Text style={styles.replyText}>
            Replying to {message.reply_to.username}: {message.reply_to.content}
          </Text>
        </View>
      )}
      
      <Text style={styles.messageContent}>{message.content}</Text>
      
      {message.is_edited && (
        <Text style={styles.editedText}>(edited)</Text>
      )}
      
      <View style={styles.messageActions}>
        <TouchableOpacity onPress={() => handleReply(message)}>
          <Text style={styles.actionText}>Reply</Text>
        </TouchableOpacity>
        {user?.id === message.id && (
          <>
            <TouchableOpacity onPress={() => handleEdit(message)}>
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(message)}>
              <Text style={styles.actionText}>Delete</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  const renderChatContent = () => {
    if (activeTab === 'chats') {
      return (
        <View style={styles.chatContent}>
          <ScrollView style={styles.messagesList}>
            {isLoading ? (
              <ActivityIndicator size="large" color="#007AFF" style={styles.loading} />
            ) : (
              messages.map(renderMessage)
            )}
          </ScrollView>
          
          {replyingTo && (
            <View style={styles.replyBar}>
              <Text style={styles.replyBarText}>
                Replying to {replyingTo.username}
              </Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <Text style={styles.cancelReply}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.messageInput}
              placeholder="Type a message..."
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity 
              style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]} 
              onPress={handleSendMessage}
              disabled={!messageText.trim()}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    } else {
      return (
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} feature coming soon!
          </Text>
          <Text style={styles.placeholderSubtext}>
            This feature will be implemented in a future update.
          </Text>
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>FromChat</Text>
          <Text style={styles.headerSubtitle}>
            {isConnected ? 'Connected' : 'Connecting...'}
          </Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
      
      {renderTabBar()}
      {renderChatContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  logoutText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  chatContent: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
    padding: 15,
  },
  loading: {
    marginTop: 50,
  },
  messageContainer: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  messageUsername: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  messageTime: {
    fontSize: 12,
    color: '#666',
  },
  replyContainer: {
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  replyText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  messageContent: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  editedText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  messageActions: {
    flexDirection: 'row',
    marginTop: 8,
  },
  actionText: {
    color: '#007AFF',
    fontSize: 12,
    marginRight: 15,
  },
  replyBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  replyBarText: {
    fontSize: 14,
    color: '#333',
  },
  cancelReply: {
    color: '#007AFF',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
