import { useState, useEffect, useCallback, useRef } from "react";
import { useAppState } from "@/pages/chat/state";
import {
    fetchUserPublicKey,
    fetchDMHistory,
    decryptDm,
    sendDMViaWebSocket,
    fetchDMConversations,
    type DMConversationResponse
} from "@/core/api/dmApi";
import type { User, Message, DmEncryptedJSON } from "@/core/types";
import { websocket } from "@/core/websocket";

export interface DMUser extends User {
    lastMessage?: string;
    unreadCount: number;
    publicKey?: string | null;
}

// Utility function for consistent username formatting in DM messages
export function formatDMUsername(
    senderId: number,
    _recipientId: number,
    currentUserId: number,
    otherUsername: string
): string {
    const isFromCurrentUser = senderId === currentUserId;
    return isFromCurrentUser ? "Вы" : otherUsername;
}

// Utility function for consistent message content formatting
export function formatDMMessageContent(
    content: string,
    senderId: number,
    currentUserId: number
): string {
    const isFromCurrentUser = senderId === currentUserId;
    const prefix = isFromCurrentUser ? "Вы: " : "";
    const maxContentLength = 50 - prefix.length;
    const truncatedContent = content.length > maxContentLength
        ? content.substring(0, maxContentLength) + "..."
        : content;
    return prefix + truncatedContent;
}

export function useDM() {
    const { user, setDmUsers, setActiveDm, addMessage, clearMessages } = useAppState();
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

    // Load DM conversations when chats tab is active
    const loadUsers = useCallback(async () => {
        if (!user.authToken || isLoadingUsers || usersLoadedRef.current) return;

        usersLoadedRef.current = true;
        setIsLoadingUsers(true);
        try {
            const conversations = await fetchDMConversations(user.authToken);

            // Process conversations and decrypt last messages
            const dmUsersWithState: DMUser[] = await Promise.all(
                conversations.map(async (conv: DMConversationResponse) => {
                    let lastMessageContent: string | undefined = undefined;

                    if (conv.lastMessage) {
                        try {
                            // Get the public key for the other user
                            const otherUserId = conv.lastMessage.senderId === user.currentUser?.id
                                ? conv.lastMessage.recipientId
                                : conv.lastMessage.senderId;

                            const publicKey = await fetchUserPublicKey(otherUserId, user.authToken!);
                            if (publicKey) {
                                // Decrypt the last message
                                const decryptedJson = await decryptDm(conv.lastMessage, publicKey!);
                                const decryptedData = JSON.parse(decryptedJson) as DmEncryptedJSON;
                                lastMessageContent = formatDMMessageContent(decryptedData.data.content, conv.lastMessage.senderId, user.currentUser?.id!);
                            }
                        } catch (error) {
                            console.error("Failed to decrypt last message for user", conv.user.id, error);
                        }
                    }

                    return {
                        ...conv.user,
                        unreadCount: conv.unreadCount,
                        lastMessage: lastMessageContent,
                        publicKey: null
                    };
                })
            );

            setDmUsersState(dmUsersWithState);
            setDmUsers(conversations.map((conv: DMConversationResponse) => conv.user));

        } catch (error) {
            console.error("Failed to load DM conversations:", error);
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
                        user_id: env.senderId,
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

    // Force reload users (useful for refreshing the list)
    const reloadUsers = useCallback(() => {
        usersLoadedRef.current = false;
        loadUsers();
    }, [loadUsers]);

    // Reload a specific user's conversation data
    const reloadUserConversation = useCallback(async (userId: number) => {
        if (!user.authToken) return;

        try {
            const conversations = await fetchDMConversations(user.authToken);
            const userConversation = conversations.find(conv => conv.user.id === userId);

            if (userConversation) {
                let lastMessageContent: string | undefined = undefined;

                if (userConversation.lastMessage) {
                    try {
                        // Get the public key for the other user
                        const otherUserId = userConversation.lastMessage.senderId === user.currentUser?.id
                            ? userConversation.lastMessage.recipientId
                            : userConversation.lastMessage.senderId;

                        const publicKey = await fetchUserPublicKey(otherUserId, user.authToken!);
                        if (publicKey) {
                            // Decrypt the last message
                            const decryptedJson = await decryptDm(userConversation.lastMessage, publicKey!);
                            const decryptedData = JSON.parse(decryptedJson) as DmEncryptedJSON;
                            lastMessageContent = formatDMMessageContent(decryptedData.data.content, userConversation.lastMessage.senderId, user.currentUser?.id!);
                        }
                    } catch (error) {
                        console.error("Failed to decrypt last message for user", userId, error);
                    }
                }

                // Update the specific user in the state
                setDmUsersState(prev => prev.map(u => {
                    if (u.id === userId) {
                        return {
                            ...u,
                            lastMessage: lastMessageContent,
                            unreadCount: userConversation.unreadCount
                        };
                    }
                    return u;
                }));
            } else {
                // If conversation no longer exists, remove the user from the list
                setDmUsersState(prev => prev.filter(u => u.id !== userId));
                // Get current dmUsers and filter out the removed user
                const currentDmUsers = useAppState.getState().chat.dmUsers;
                setDmUsers(currentDmUsers.filter((u: User) => u.id !== userId));
            }
        } catch (error) {
            console.error("Failed to reload user conversation:", error);
        }
    }, [user.authToken]);


    // WebSocket message handler for conversation list updates
    useEffect(() => {
        async function handleWebSocketMessage(e: MessageEvent) {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type === "dmNew") {
                    const { senderId, recipientId, ...envelope } = msg.data;

                    // Update conversation list (not active conversation - that's handled by DMPanel)
                    if (!user.currentUser?.id) {
                        return;
                    }
                    const otherUserId = senderId === user.currentUser.id ? recipientId : senderId;

                    // Update unread count and last message preview
                    try {
                        const publicKey = await fetchUserPublicKey(otherUserId, user.authToken!);
                        if (publicKey) {
                            const decryptedJson = await decryptDm(envelope, publicKey);
                            const decryptedData = JSON.parse(decryptedJson) as DmEncryptedJSON;
                            const messageContent = decryptedData.data.content;
                            const formattedMessage = formatDMMessageContent(messageContent, senderId, user.currentUser.id);

                            setDmUsersState(prev => prev.map(u =>
                                u.id === otherUserId
                                    ? {
                                        ...u,
                                        unreadCount: senderId !== user.currentUser?.id ? u.unreadCount + 1 : u.unreadCount,
                                        lastMessage: formattedMessage,
                                        publicKey
                                    }
                                    : u
                            ));
                        }
                    } catch (error) {
                        console.error("Failed to update last message preview:", error);
                    }
                } else if (msg.type === "dmEdited") {
                    const { id, senderId, recipientId, ...envelope } = msg.data;

                    // Update last message preview for conversation list
                    if (!user.currentUser?.id) {
                        return;
                    }
                    const otherUserId = senderId === user.currentUser.id ? recipientId : senderId;
                    try {
                        const publicKey = await fetchUserPublicKey(otherUserId, user.authToken!);
                        if (publicKey) {
                            const decryptedJson = await decryptDm(envelope, publicKey);
                            const decryptedData = JSON.parse(decryptedJson) as DmEncryptedJSON;
                            const messageContent = decryptedData.data.content;
                            const formattedMessage = formatDMMessageContent(messageContent, senderId, user.currentUser.id);
                            setDmUsersState(prev => prev.map(u =>
                                u.id === otherUserId
                                    ? {
                                        ...u,
                                        lastMessage: formattedMessage,
                                        publicKey
                                    }
                                    : u
                            ));
                        }
                    } catch (error) {
                        console.error("Failed to update edited message preview:", error);
                    }
                } else if (msg.type === "dmDeleted") {
                    const { senderId, recipientId } = msg.data;

                    // Reload only the specific user's conversation
                    if (!user.currentUser?.id) return;
                    const otherUserId = senderId === user.currentUser.id ? recipientId : senderId;
                    reloadUserConversation(otherUserId);
                }
            } catch (error) {
                console.error("Failed to handle WebSocket message:", error);
            }
        }

        websocket.addEventListener("message", handleWebSocketMessage);

        return () => websocket.removeEventListener("message", handleWebSocketMessage);
    }, [user.currentUser, user.authToken, reloadUserConversation]);

    return {
        dmUsers,
        isLoadingUsers,
        isLoadingHistory,
        loadUsers,
        reloadUsers,
        reloadUserConversation,
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
