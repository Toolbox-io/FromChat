import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { PRODUCT_NAME } from "../../core/config";
import { useAppState } from "../../state";
import { ProfileDialog } from "../profile/ProfileDialog";
import { SettingsDialog } from "../settings/SettingsDialog";
import { DMUsersList } from "./DMUsersList";
import type { ChatTabs } from "../../state";

function BottomAppBar() {
    const [settingsOpen, onSettingsOpenChange] = useState(false);
    const { logout } = useAppState();

    const handleLogout = () => {
        logout();
    };

    return (
        <>
            <View style={styles.bottomAppBar}>
                <TouchableOpacity 
                    style={styles.iconButton}
                    onPress={() => onSettingsOpenChange(true)}
                >
                    <Text style={styles.iconText}>⚙️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton}>
                    <Text style={styles.iconText}>👥</Text>
                </TouchableOpacity>
                <View style={styles.spacer} />
                <TouchableOpacity 
                    style={styles.iconButton}
                    onPress={handleLogout}
                >
                    <Text style={styles.iconText}>🚪</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fab}>
                    <Text style={styles.fabText}>✏️</Text>
                </TouchableOpacity>
            </View>
            <SettingsDialog isOpen={settingsOpen} onOpenChange={onSettingsOpenChange} />
        </>
    );
}

function ChatTabs() {
    const { chat, switchToTab, switchToPublicChat } = useAppState();
    const { activeTab } = chat;

    const handleChatClick = async (chatName: string) => {
        await switchToPublicChat(chatName);
    };

    const handleTabChange = async (tab: ChatTabs) => {
        await switchToTab(tab);
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
                return <DMUsersList />;
            default:
                return null;
        }
    };

    return (
        <View style={styles.chatTabs}>
            <View style={styles.tabs}>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'chats' && styles.activeTab]}
                    onPress={() => handleTabChange('chats')}
                >
                    <Text style={[styles.tabText, activeTab === 'chats' && styles.activeTabText]}>
                        Чаты
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'channels' && styles.activeTab]}
                    onPress={() => handleTabChange('channels')}
                >
                    <Text style={[styles.tabText, activeTab === 'channels' && styles.activeTabText]}>
                        Каналы
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'contacts' && styles.activeTab]}
                    onPress={() => handleTabChange('contacts')}
                >
                    <Text style={[styles.tabText, activeTab === 'contacts' && styles.activeTabText]}>
                        Контакты
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'dms' && styles.activeTab]}
                    onPress={() => handleTabChange('dms')}
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

function ChatHeader() {
    const [isProfileOpen, setProfileOpen] = useState(false);

    return (
        <View style={styles.chatHeader}>
            <Text style={styles.productName}>{PRODUCT_NAME}</Text>
            <TouchableOpacity 
                style={styles.profile}
                onPress={() => setProfileOpen(true)}
            >
                <Image 
                    source={{ uri: "https://via.placeholder.com/40x40/cccccc/ffffff?text=U" }} 
                    style={styles.profileImage}
                />
            </TouchableOpacity>
            <ProfileDialog isOpen={isProfileOpen} onOpenChange={setProfileOpen} />
        </View>
    );
}

export function LeftPanel() {
    return (
        <View style={styles.chatList}>
            <ChatHeader />
            <ChatTabs />
            <BottomAppBar />
        </View>
    );
}

const styles = StyleSheet.create({
    chatList: {
        flex: 1,
        backgroundColor: '#fff',
    },
    chatHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    productName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1976d2',
    },
    profile: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
    },
    profileImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    chatTabs: {
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
    bottomAppBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        backgroundColor: '#fff',
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    iconText: {
        fontSize: 20,
    },
    spacer: {
        flex: 1,
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#1976d2',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    fabText: {
        color: 'white',
        fontSize: 20,
    },
});
