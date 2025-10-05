import { useState, useEffect, useCallback, useRef } from "react";
import { useAppState } from "../state";
import { 
    fetchUsers, 
    fetchUserPublicKey, 
    fetchDMHistory, 
    decryptDm, 
    sendDMViaWebSocket 
} from "../../api/dmApi";
import type { User, Message, DmEncryptedJSON } from "../../core/types";
import { websocket } from "../../core/websocket";

export interface DMUser extends User {
    lastMessage?: string;
    unreadCount: number;
    publicKey?: string | null;
}

export function useDM() {
    const { user, chat, setDmUsers, setActiveDm, addMessage, clearMessages } = useAppState();
    const [dmUsers, setDmUsersState] = useState<DMUser[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const usersLoadedRef = useRef(false);

    // Load last message and unread count for a specific user
    const loadUserLastMessage = useCallback(async (dmUser: DMUser) => {
        if (!user.authToken) return;

        try {
            // Get public key
            const publicKey = await fetchUserPublicKey(dmUser.id, user.authToken);
            if (!publicKey) return;

            // Get message history
            const messages = await fetchDMHistory(dmUser.id, user.authToken, 50);
            if (messages.length === 0) return;

            // Find last message
            const lastMessage = messages[messages.length - 1];
            let lastPlaintext: string | null = null;
            
            try {
                lastPlaintext = (JSON.parse(await decryptDm(lastMessage, publicKey)) as DmEncryptedJSON).data.content;
                console.log(lastPlaintext);
            } catch (error) {
                console.error("Failed to decrypt last message:", error);
            }

            // Calculate unread count
            const lastReadId = getLastReadId(dmUser.id);
            let unreadCount = 0;
            for (const msg of messages) {
                if (msg.senderId === dmUser.id && msg.id > lastReadId) {
                    unreadCount++;
                }
            }

            // Update user state
            setDmUsersState(prev => prev.map(u => 
                u.id === dmUser.id 
                    ? { 
                        ...u, 
                        lastMessage: lastPlaintext ? lastPlaintext.split(/\r?\n/).slice(0, 2).join("\n") : undefined,
                        unreadCount,
                        publicKey
                    }
                    : u
            ));
        } catch (error) {
            console.error("Failed to load last message for user:", dmUser.id, error);
        }
    }, [user.authToken]);

    // Load users when DM tab is active
    const loadUsers = useCallback(async () => {
        if (!user.authToken || isLoadingUsers || usersLoadedRef.current) return;
        
        usersLoadedRef.current = true;
        setIsLoadingUsers(true);
        try {
            const users = await fetchUsers(user.authToken);
            console.log("Fetched users:", users);
            const dmUsersWithState: DMUser[] = users.map(user => ({
                ...user,
                unreadCount: 0,
                lastMessage: undefined,
                publicKey: null
            }));
            
            setDmUsersState(dmUsersWithState);
            setDmUsers(users);
            
            // Load last messages and unread counts for visible users
            // Call loadUserLastMessage directly without dependency
            for (const dmUser of dmUsersWithState) {
                await loadUserLastMessage(dmUser);
            }
        } catch (error) {
            console.error("Failed to load DM users:", error);
        } finally {
            setIsLoadingUsers(false);
        }
    }, [user.authToken, isLoadingUsers]);

    // Reset users loaded flag when user changes
    useEffect(() => {
        usersLoadedRef.current = false;
    }, [user.authToken]);

    // Load DM history for active conversation
    const loadDMHistory = useCallback(async (userId: number, publicKey: string) => {
        if (!user.authToken || isLoadingHistory) return;
        
        setIsLoadingHistory(true);
        try {
            const messages = await fetchDMHistory(userId, user.authToken, 50);
            const decryptedMessages: Message[] = [];
            let maxIncomingId = 0;

            for (const env of messages) {
                try {
                    const text = await decryptDm(env, publicKey);
                    const isAuthor = env.senderId !== userId;
                    const username = isAuthor ? (user.currentUser?.username || "Unknown") : "Other User";
                    
                    decryptedMessages.push({
                        id: env.id,
                        content: text,
                        username: username,
                        timestamp: env.timestamp,
                        is_read: false,
                        is_edited: false
                    });

                    if (env.senderId === userId && env.id > maxIncomingId) {
                        maxIncomingId = env.id;
                    }
                } catch (error) {
                    console.error("Error decrypting message:", error);
                }
            }

            clearMessages();
            decryptedMessages.forEach(msg => addMessage(msg));

            // Update last read ID
            if (maxIncomingId > 0) {
                setLastReadId(userId, maxIncomingId);
                // Clear unread count
                setDmUsersState(prev => prev.map(u => 
                    u.id === userId ? { ...u, unreadCount: 0 } : u
                ));
            }
        } catch (error) {
            console.error("Failed to load DM history:", error);
        } finally {
            setIsLoadingHistory(false);
        }
    }, [user.authToken, user.currentUser, isLoadingHistory, clearMessages, addMessage]);

    // Send DM message
    const sendDMMessage = useCallback(async (recipientId: number, publicKey: string, content: string) => {
        if (!user.authToken) return;

        try {
            await sendDMViaWebSocket(recipientId, publicKey, content, user.authToken);
        } catch (error) {
            console.error("Failed to send DM:", error);
        }
    }, [user.authToken]);

    // Start DM conversation
    const startDMConversation = useCallback(async (dmUser: DMUser) => {
        if (!user.authToken) return;

        try {
            // Get public key if not already loaded
            let publicKey = dmUser.publicKey;
            if (!publicKey) {
                publicKey = await fetchUserPublicKey(dmUser.id, user.authToken);
                if (!publicKey) return;
            }

            // Set active DM
            setActiveDm({
                userId: dmUser.id,
                username: dmUser.username,
                publicKey
            });

            // Load conversation history
            await loadDMHistory(dmUser.id, publicKey);
        } catch (error) {
            console.error("Failed to start DM conversation:", error);
        }
    }, [user.authToken, setActiveDm, loadDMHistory]);

    // WebSocket message handler
    useEffect(() => {
        const handleWebSocketMessage = async (e: MessageEvent) => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type === "dmNew") {
                    const { senderId, recipientId, ...envelope } = msg.data;
                    
                    // If this is for the active DM conversation
                    if (chat.activeDm && (senderId === chat.activeDm.userId || recipientId === chat.activeDm.userId)) {
                        try {
                            const plaintext = await decryptDm(envelope, chat.activeDm.publicKey!);
                            const isAuthor = senderId !== chat.activeDm.userId;
                            
                            addMessage({
                                id: envelope.id,
                                content: plaintext,
                                username: isAuthor ? (user.currentUser?.username || "Unknown") : (chat.activeDm.username || "Unknown"),
                                timestamp: envelope.timestamp,
                                is_read: false,
                                is_edited: false
                            });

                            // Update last read if it's from the other user
                            if (senderId === chat.activeDm.userId) {
                                setLastReadId(chat.activeDm.userId, Math.max(getLastReadId(chat.activeDm.userId), envelope.id));
                            }
                        } catch (error) {
                            console.error("Failed to decrypt incoming DM:", error);
                        }
                    } else {
                        // Update unread count for other users
                        const otherUserId = senderId;
                        setDmUsersState(prev => prev.map(u => 
                            u.id === otherUserId 
                                ? { ...u, unreadCount: u.unreadCount + 1 }
                                : u
                        ));

                        // Update last message preview
                        try {
                            const publicKey = await fetchUserPublicKey(otherUserId, user.authToken!);
                            if (publicKey) {
                                const plaintext = await decryptDm(envelope, publicKey);
                                setDmUsersState(prev => prev.map(u => 
                                    u.id === otherUserId 
                                        ? { 
                                            ...u, 
                                            lastMessage: plaintext.split(/\r?\n/).slice(0, 2).join("\n"),
                                            publicKey
                                        }
                                        : u
                                ));
                            }
                        } catch (error) {
                            console.error("Failed to update last message preview:", error);
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to handle WebSocket message:", error);
            }
        };

        websocket.addEventListener("message", handleWebSocketMessage);
        return () => websocket.removeEventListener("message", handleWebSocketMessage);
    }, [chat.activeDm, user.currentUser, addMessage]);

    // Force reload users (useful for refreshing the list)
    const reloadUsers = useCallback(() => {
        usersLoadedRef.current = false;
        loadUsers();
    }, [loadUsers]);

    return {
        dmUsers,
        isLoadingUsers,
        isLoadingHistory,
        loadUsers,
        reloadUsers,
        startDMConversation,
        sendDMMessage,
        loadUserLastMessage
    };
}

// Helper functions for localStorage
function getLastReadId(userId: number): number {
    try {
        const v = localStorage.getItem(`dmLastRead:${userId}`);
        return v ? Number(v) : 0;
    } catch {
        return 0;
    }
}

function setLastReadId(userId: number, id: number): void {
    try {
        localStorage.setItem(`dmLastRead:${userId}`, String(id));
    } catch {}
}
