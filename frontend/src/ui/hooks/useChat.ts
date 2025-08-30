import { useEffect, useCallback, useRef } from "react";
import { useAppState } from "../state";
import { request, websocket } from "../../websocket";
import { API_BASE_URL } from "../../core/config";
import type { Message, WebSocketMessage, User } from "../../core/types";
import { getAuthHeaders } from "../../auth/api";

export function useChat() {
    const { 
        chat, 
        addMessage, 
        updateMessage,
        removeMessage,
        clearMessages,
        setCurrentChat, 
        setActiveTab, 
        setDmUsers, 
        setActiveDm,
        user 
    } = useAppState();

    const messagesLoadedRef = useRef(false);

    // Load messages for the current chat
    const loadMessages = useCallback(async () => {
        if (!user.authToken || messagesLoadedRef.current) return;

        try {
            const response = await fetch(`${API_BASE_URL}/get_messages`, {
                headers: getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                if (data.messages && data.messages.length > 0) {
                    // Clear existing messages and add new ones
                    clearMessages();
                    data.messages.forEach((msg: Message) => {
                        addMessage(msg);
                    });
                }
            }
            messagesLoadedRef.current = true;
        } catch (error) {
            console.error("Error loading messages:", error);
        }
    }, [user.authToken, addMessage, clearMessages]);

    // Send a message
    const sendMessage = useCallback(async (content: string) => {
        if (!user.authToken || !content.trim()) return;

        try {
            const response = await request({
                data: { content: content.trim() },
                credentials: {
                    scheme: "Bearer",
                    credentials: user.authToken
                },
                type: "sendMessage"
            });

            if (response.error) {
                console.error("Error sending message:", response.error);
            }
        } catch (error) {
            console.error("Error sending message:", error);
        }
    }, [user.authToken]);

    // Handle WebSocket messages
    useEffect(() => {
        const handleWebSocketMessage = (event: MessageEvent) => {
            try {
                const response: WebSocketMessage = JSON.parse(event.data);
                
                switch (response.type) {
                    case 'messageEdited':
                        if (response.data) {
                            updateMessage(response.data.id, response.data);
                        }
                        break;
                    case 'messageDeleted':
                        if (response.data && response.data.message_id) {
                            removeMessage(response.data.message_id);
                        }
                        break;
                    case 'newMessage':
                        if (response.data) {
                            const isAuthor = response.data.username === user.currentUser?.username;
                            addMessage(response.data);
                        }
                        break;
                }
            } catch (error) {
                console.error("Error parsing WebSocket message:", error);
            }
        };

        websocket.addEventListener("message", handleWebSocketMessage);

        return () => {
            websocket.removeEventListener("message", handleWebSocketMessage);
        };
    }, [addMessage, updateMessage, removeMessage, user.currentUser]);

    // Load messages only once when component mounts and user is authenticated
    useEffect(() => {
        if (user.authToken && !messagesLoadedRef.current) {
            loadMessages();
        }
    }, [user.authToken, loadMessages]);

    // Reset messages loaded flag and clear messages when chat changes
    useEffect(() => {
        messagesLoadedRef.current = false;
        clearMessages(); // Clear messages when switching chats
    }, [chat.currentChat, clearMessages]);

    return {
        messages: chat.messages,
        currentChat: chat.currentChat,
        activeTab: chat.activeTab,
        dmUsers: chat.dmUsers,
        activeDm: chat.activeDm,
        sendMessage,
        updateMessage,
        removeMessage,
        clearMessages,
        setCurrentChat,
        setActiveTab,
        setDmUsers,
        setActiveDm
    };
}
