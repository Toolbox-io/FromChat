import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { List, Avatar, Divider, Searchbar } from 'react-native-paper';
import { useAppState } from '../../state';

export default function ContactsTab() {
    const { chat, switchToDm } = useAppState();
    const [searchQuery, setSearchQuery] = React.useState('');

    const contactsList = [
        {
            id: 1,
            username: 'user1',
            nickname: 'Пользователь 1',
            isOnline: true,
            lastSeen: 'онлайн',
        },
        {
            id: 2,
            username: 'user2',
            nickname: 'Пользователь 2',
            isOnline: false,
            lastSeen: '2 часа назад',
        },
        {
            id: 3,
            username: 'user3',
            nickname: 'Пользователь 3',
            isOnline: true,
            lastSeen: 'онлайн',
        },
    ];

    const filteredContacts = contactsList.filter(contact =>
        contact.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderContactItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            onPress={() => switchToDm(item.id)}
            style={styles.contactItem}
        >
            <List.Item
                title={item.nickname}
                description={item.username}
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
                        <Text style={[
                            styles.status,
                            { color: item.isOnline ? '#4caf50' : '#666' }
                        ]}>
                            {item.lastSeen}
                        </Text>
                    </View>
                )}
            />
            <Divider />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Searchbar
                placeholder="Поиск контактов..."
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={styles.searchbar}
            />
            <FlatList
                data={filteredContacts}
                renderItem={renderContactItem}
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
    searchbar: {
        margin: 16,
    },
    list: {
        flex: 1,
    },
    contactItem: {
        backgroundColor: '#fff',
    },
    avatar: {
        backgroundColor: '#9e9e9e',
    },
    rightContent: {
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    status: {
        fontSize: 12,
        color: '#666',
    },
});
