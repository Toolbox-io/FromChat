import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { useDM } from "../../hooks/useDM";
import { useAppState } from "../../state";
import { fetchUserPublicKey } from "../../api/dmApi";

export function DMUsersList() {
    const { dmUsers, isLoadingUsers, loadUsers } = useDM();
    const { chat, switchToDM } = useAppState();

    useEffect(() => {
        if (chat.activeTab === "dms") {
            loadUsers();
        }
    }, [chat.activeTab, loadUsers]);

    if (isLoadingUsers) {
        return (
            <View style={styles.container}>
                <View style={styles.listItem}>
                    <Image 
                        source={{ uri: "https://via.placeholder.com/40x40/cccccc/ffffff?text=U" }} 
                        style={styles.avatar}
                    />
                    <View style={styles.listItemContent}>
                        <Text style={styles.headline}>Загрузка...</Text>
                        <Text style={styles.description}>Получение списка пользователей...</Text>
                    </View>
                </View>
            </View>
        );
    }

    if (dmUsers.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.listItem}>
                    <Image 
                        source={{ uri: "https://via.placeholder.com/40x40/cccccc/ffffff?text=U" }} 
                        style={styles.avatar}
                    />
                    <View style={styles.listItemContent}>
                        <Text style={styles.headline}>Нет пользователей</Text>
                        <Text style={styles.description}>Пользователи не найдены</Text>
                    </View>
                </View>
            </View>
        );
    }

    const handleUserClick = async (user: any) => {
        if (!user.publicKey) {
            // Get public key if not already loaded
            const authToken = useAppState.getState().user.authToken;
            if (!authToken) return;
            
            const publicKey = await fetchUserPublicKey(user.id, authToken);
            if (publicKey) {
                user.publicKey = publicKey;
            } else {
                console.error("Failed to get public key for user:", user.id);
                return;
            }
        }
        
        await switchToDM({
            recipientId: user.id,
            recipientUsername: user.username,
            messages: []
        });
    };

    return (
        <View style={styles.container}>
            {dmUsers.map((user) => (
                <TouchableOpacity
                    key={user.id}
                    style={styles.listItem}
                    onPress={() => handleUserClick(user)}
                >
                    <Image 
                        source={{ 
                            uri: user.profile_picture || "https://via.placeholder.com/40x40/cccccc/ffffff?text=U" 
                        }} 
                        style={styles.avatar}
                        onError={() => {
                            // Handle image error if needed
                        }}
                    />
                    <View style={styles.listItemContent}>
                        <Text style={styles.headline}>{user.username}</Text>
                        <Text style={styles.description}>
                            {(user as any).lastMessage || "Нет сообщений"}
                        </Text>
                    </View>
                    {(user as any).unreadCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{(user as any).unreadCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    listItemContent: {
        flex: 1,
    },
    headline: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    description: {
        fontSize: 14,
        color: '#666',
    },
    badge: {
        backgroundColor: '#f44336',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
});
