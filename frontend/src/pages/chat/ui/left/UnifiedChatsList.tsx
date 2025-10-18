import { useState, useEffect, useCallback } from "react";
import { useAppState } from "@/pages/chat/state";
import { useDM, type DMUser } from "@/pages/chat/hooks/useDM";
import { API_BASE_URL } from "@/core/config";
import { getAuthHeaders } from "@/core/api/authApi";
import { fetchUserPublicKey } from "@/core/api/dmApi";
import type { Message } from "@/core/types";
import { websocket } from "@/core/websocket";
import defaultAvatar from "@/images/default-avatar.png";

interface PublicChat {
    id: string;
    name: string;
    type: "public";
    lastMessage?: Message;
}

interface DMConversation {
    id: number;
    username: string;
    profile_picture?: string;
    online?: boolean;
    type: "dm";
    lastMessage?: string;
    unreadCount: number;
    publicKey?: string | null;
}

type ChatItem = PublicChat | DMConversation;

export function UnifiedChatsList() {
    const { user, switchToPublicChat, switchToDM, chat } = useAppState();
    const { dmUsers, isLoadingUsers, loadUsers } = useDM();
    
    const [publicChats] = useState<PublicChat[]>([
        { id: "general", name: "Общий чат", type: "public" },
        { id: "general2", name: "Общий чат 2", type: "public" }
    ]);
    const [lastMessages, setLastMessages] = useState<Record<string, Message | undefined>>({});
    const [allChats, setAllChats] = useState<ChatItem[]>([]);

    // Load public chat last messages
    const loadLastMessages = useCallback(async () => {
        if (!user.authToken) return;

        try {
            const response = await fetch(`${API_BASE_URL}/get_messages`, {
                headers: getAuthHeaders(user.authToken)
            });

            if (response.ok) {
                const data = await response.json();
                if (data.messages && data.messages.length > 0) {
                    const lastMessage = data.messages[data.messages.length - 1];
                    
                    setLastMessages({
                        general: lastMessage,
                        general2: lastMessage
                    });
                }
            }
        } catch (error) {
            console.error("Error loading last messages:", error);
        }
    }, [user.authToken]);

    // Load DM users when chats tab is active
    useEffect(() => {
        if (chat.activeTab === "chats") {
            loadUsers();
            loadLastMessages();
        }
    }, [chat.activeTab, loadUsers, loadLastMessages]);

    // Combine public chats and DMs into one list
    useEffect(() => {
        const publicChatItems: ChatItem[] = publicChats.map(chat => ({
            ...chat,
            lastMessage: lastMessages[chat.id]
        }));

        const dmChatItems: ChatItem[] = dmUsers.map((user: DMUser) => ({
            id: user.id,
            username: user.username,
            profile_picture: user.profile_picture,
            online: user.online,
            type: "dm" as const,
            lastMessage: user.lastMessage,
            unreadCount: user.unreadCount,
            publicKey: user.publicKey
        }));

        // Combine and sort by last message timestamp (DMs first, then public chats)
        const combined = [...dmChatItems, ...publicChatItems];
        setAllChats(combined);
    }, [publicChats, lastMessages, dmUsers]);

    // WebSocket listener for public chat message updates
    useEffect(() => {
        if (!websocket) return;

        const handleWebSocketMessage = (e: MessageEvent) => {
            try {
                const msg = JSON.parse(e.data);
                
                if (msg.type === "newMessage") {
                    const newMessage = msg.data as Message;
                    // Update all public chats with the new message
                    setLastMessages(prev => {
                        const updated = { ...prev };
                        publicChats.forEach(chat => {
                            updated[chat.id] = newMessage;
                        });
                        return updated;
                    });
                } else if (msg.type === "messageEdited") {
                    const editedMessage = msg.data as Message;
                    // Update only if the edited message is the current last message
                    setLastMessages(prev => {
                        const updated = { ...prev };
                        publicChats.forEach(chat => {
                            if (updated[chat.id]?.id === editedMessage.id) {
                                updated[chat.id] = editedMessage;
                            }
                        });
                        return updated;
                    });
                } else if (msg.type === "messageDeleted") {
                    const deletedMessageId = msg.data?.message_id;
                    let needsReload = false;
                    
                    setLastMessages(prev => {
                        const updated = { ...prev };
                        publicChats.forEach(chat => {
                            if (updated[chat.id]?.id === deletedMessageId) {
                                updated[chat.id] = undefined;
                                needsReload = true;
                            }
                        });
                        return updated;
                    });
                    
                    if (needsReload) {
                        loadLastMessages();
                    }
                }
            } catch (error) {
                console.error("Failed to handle WebSocket message in UnifiedChatsList:", error);
            }
        };

        websocket.addEventListener("message", handleWebSocketMessage);
        return () => websocket.removeEventListener("message", handleWebSocketMessage);
    }, [publicChats, loadLastMessages]);

    const formatPublicChatMessage = (chatId: string): string => {
        const lastMessage = lastMessages[chatId];
        if (!lastMessage) {
            return "";
        }

        const isCurrentUser = lastMessage.username === user.currentUser?.username;
        const prefix = isCurrentUser ? "Вы: " : `${lastMessage.username}: `;
        
        const maxContentLength = 50 - prefix.length;
        const content = lastMessage.content.length > maxContentLength 
            ? lastMessage.content.substring(0, maxContentLength) + "..." 
            : lastMessage.content;
            
        return prefix + content;
    };


    const handlePublicChatClick = async (chatName: string) => {
        await switchToPublicChat(chatName);
    };

    const handleDMClick = async (dmConversation: DMConversation) => {
        if (!dmConversation.publicKey) {
            const authToken = useAppState.getState().user.authToken;
            if (!authToken) return;
            
            const publicKey = await fetchUserPublicKey(dmConversation.id, authToken);
            if (publicKey) {
                dmConversation.publicKey = publicKey;
            } else {
                console.error("Failed to get public key for user:", dmConversation.id);
                return;
            }
        }
        
        await switchToDM({
            userId: dmConversation.id,
            username: dmConversation.username,
            publicKey: dmConversation.publicKey,
            profilePicture: dmConversation.profile_picture,
            online: dmConversation.online || false
        });
    };

    if (isLoadingUsers) {
        return (
            <mdui-circular-progress />
        );
    }

    return (
        <mdui-list>
            {allChats.map((chat) => {
                if (chat.type === "public") {
                    return (
                        <mdui-list-item
                            key={`public-${chat.id}`}
                            headline={chat.name}
                            onClick={() => handlePublicChatClick(chat.name)}
                            style={{ cursor: "pointer" }}
                        >
                            {formatPublicChatMessage(chat.id) && (
                                <span slot="description" className="list-description">
                                    {formatPublicChatMessage(chat.id)}
                                </span>
                            )}
                            <img 
                                src={defaultAvatar} 
                                alt={chat.name} 
                                slot="icon"
                                style={{
                                    width: "40px",
                                    height: "40px",
                                    borderRadius: "50%",
                                    objectFit: "cover"
                                }}
                            />
                        </mdui-list-item>
                    );
                } else {
                    return (
                        <mdui-list-item
                            key={`dm-${chat.id}`}
                            headline={chat.username}
                            onClick={() => handleDMClick(chat)}
                            style={{ cursor: "pointer" }}
                        >
                            <span slot="description" className="list-description">
                                {chat.lastMessage || "Нет сообщений"}
                            </span>
                            <img 
                                src={chat.profile_picture || defaultAvatar} 
                                alt={chat.username} 
                                slot="icon"
                                style={{
                                    width: "40px",
                                    height: "40px",
                                    borderRadius: "50%",
                                    objectFit: "cover"
                                }}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = defaultAvatar;
                                }}
                            />
                            {chat.unreadCount > 0 && (
                                <mdui-badge slot="end-icon">
                                    {chat.unreadCount}
                                </mdui-badge>
                            )}
                        </mdui-list-item>
                    );
                }
            })}
        </mdui-list>
    );
}
