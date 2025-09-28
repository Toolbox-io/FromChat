import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { List, Avatar, Divider } from 'react-native-paper';
import { useAppState } from '../../state';

export default function ChannelsTab() {
    const { chat, switchToPublicChat } = useAppState();

    const channelsList = [
        {
            id: 1,
            name: 'Новости',
            lastMessage: 'Последние новости',
            timestamp: '10:30',
            unread: 5,
        },
        {
            id: 2,
            name: 'Обсуждения',
            lastMessage: 'Интересная тема',
            timestamp: '09:15',
            unread: 0,
        },
    ];

    const renderChannelItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            onPress={() => switchToPublicChat(item.name)}
            style={styles.channelItem}
        >
            <List.Item
                title={item.name}
                description={item.lastMessage}
                left={(props) => (
                    <Avatar.Icon 
                        {...props} 
                        icon="broadcast" 
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
                data={channelsList}
                renderItem={renderChannelItem}
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
    channelItem: {
        backgroundColor: '#fff',
    },
    avatar: {
        backgroundColor: '#4caf50',
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
        backgroundColor: '#4caf50',
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
