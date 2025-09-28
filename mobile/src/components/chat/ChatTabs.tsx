import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useChat } from "../../hooks/useChat";

export function ChatTabs() {
    const { activeTab, setActiveTab, setCurrentChat } = useChat();

    const handleChatClick = (chatName: string) => {
        setCurrentChat(chatName);
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'chats':
                return (
                    <View style={styles.tabContent}>
                        <TouchableOpacity 
                            style={styles.listItem}
                            onPress={() => handleChatClick("Общий чат")}
                        >
                            <Image 
                                source={{ uri: "https://via.placeholder.com/40x40/cccccc/ffffff?text=U" }} 
                                style={styles.avatar}
                            />
                            <View style={styles.listItemContent}>
                                <Text style={styles.headline}>Общий чат</Text>
                                <Text style={styles.description}>Вы: Последнее сообщение</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={styles.listItem}
                            onPress={() => handleChatClick("Общий чат 2")}
                        >
                            <Image 
                                source={{ uri: "https://via.placeholder.com/40x40/cccccc/ffffff?text=U" }} 
                                style={styles.avatar}
                            />
                            <View style={styles.listItemContent}>
                                <Text style={styles.headline}>Общий чат 2</Text>
                                <Text style={styles.description}>Вы: Последнее сообщение</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                );
            case 'channels':
                return <Text style={styles.placeholder}>Скоро будет...</Text>;
            case 'contacts':
                return <Text style={styles.placeholder}>Скоро будет...</Text>;
            case 'dms':
                return <View style={styles.tabContent} />;
            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.tabs}>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'chats' && styles.activeTab]}
                    onPress={() => setActiveTab('chats')}
                >
                    <Text style={[styles.tabText, activeTab === 'chats' && styles.activeTabText]}>
                        Чаты
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'channels' && styles.activeTab]}
                    onPress={() => setActiveTab('channels')}
                >
                    <Text style={[styles.tabText, activeTab === 'channels' && styles.activeTabText]}>
                        Каналы
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'contacts' && styles.activeTab]}
                    onPress={() => setActiveTab('contacts')}
                >
                    <Text style={[styles.tabText, activeTab === 'contacts' && styles.activeTabText]}>
                        Контакты
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'dms' && styles.activeTab]}
                    onPress={() => setActiveTab('dms')}
                >
                    <Text style={[styles.tabText, activeTab === 'dms' && styles.activeTabText]}>
                        ЛС
                    </Text>
                </TouchableOpacity>
            </View>
            {renderTabContent()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#1976d2',
    },
    tabText: {
        fontSize: 14,
        color: '#666',
    },
    activeTabText: {
        color: '#1976d2',
        fontWeight: 'bold',
    },
    tabContent: {
        flex: 1,
        padding: 16,
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
    placeholder: {
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16,
        color: '#666',
    },
});
