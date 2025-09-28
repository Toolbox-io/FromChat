import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { List, Avatar, Divider } from 'react-native-paper';
import { useAppState } from '../../state';

export default function ChatTab() {
    const { chat, switchToPublicChat } = useAppState();

    const chatList = [
        {
            id: 1,
            name: 'Общий чат',
            lastMessage: 'Последнее сообщение',
            timestamp: '12:30',
            unread: 2,
        },
        {
            id: 2,
            name: 'Общий чат 2',
            lastMessage: 'Другое сообщение',
            timestamp: '11:45',
            unread: 0,
        },
    ];

    const renderChatItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            onPress={() => switchToPublicChat(item.name)}
            style={styles.chatItem}
        >
            <List.Item
                title={item.name}
                description={item.lastMessage}
                left={(props) => (
                    <Avatar.Icon 
                        {...props} 
                        icon="chat" 
                        size={48}
                        style={styles.avatar}
                    />
                )}
                right={() => (
                    <View style={styles.rightContent}>
                        <Text style={styles.timestamp}>{item.timestamp}</Text>
                        {item.unread > 0 && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadText}>{item.unread}</Text>
                            </View>
                        )}
                    </View>
                )}
            />
            <Divider />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={chatList}
                renderItem={renderChatItem}
                keyExtractor={(item) => item.id.toString()}
                style={styles.list}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    list: {
        flex: 1,
    },
    chatItem: {
        backgroundColor: '#fff',
    },
    avatar: {
        backgroundColor: '#1976d2',
    },
    rightContent: {
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    timestamp: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
    },
    unreadBadge: {
        backgroundColor: '#1976d2',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    unreadText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
});
