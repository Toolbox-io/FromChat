import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { List, Avatar, Divider } from 'react-native-paper';
import { useAppState } from '../../state';

export default function DMsTab() {
    const { chat, switchToDm } = useAppState();

    const dmList = [
        {
            id: 1,
            username: 'user1',
            nickname: 'Пользователь 1',
            lastMessage: 'Привет! Как дела?',
            timestamp: '12:30',
            unread: 3,
            isOnline: true,
        },
        {
            id: 2,
            username: 'user2',
            nickname: 'Пользователь 2',
            lastMessage: 'Спасибо за помощь',
            timestamp: '11:45',
            unread: 0,
            isOnline: false,
        },
        {
            id: 3,
            username: 'user3',
            nickname: 'Пользователь 3',
            lastMessage: 'До встречи!',
            timestamp: '10:20',
            unread: 1,
            isOnline: true,
        },
    ];

    const renderDMItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            onPress={() => switchToDm(item.id)}
            style={styles.dmItem}
        >
            <List.Item
                title={item.nickname}
                description={item.lastMessage}
                left={(props) => (
                    <Avatar.Icon 
                        {...props} 
                        icon="account" 
                        size={48}
                        style={[
                            styles.avatar,
                            { backgroundColor: item.isOnline ? '#4caf50' : '#9e9e9e' }
                        ]}
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
                data={dmList}
                renderItem={renderDMItem}
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
    dmItem: {
        backgroundColor: '#fff',
    },
    avatar: {
        backgroundColor: '#9e9e9e',
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
