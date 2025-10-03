import { useEffect, useCallback, useRef } from "react";
import { useAppState } from "../state";
import { request } from "../../core/websocket";
import { API_BASE_URL } from "../../core/config";
import type { Message } from "../../core/types";
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
        setIsChatSwitching,
        user
    } = useAppState();

    const messagesLoadedRef = useRef(false);

    // Load messages for the current chat
    const loadMessages = useCallback(async () => {
        if (!user.authToken || messagesLoadedRef.current) return;

        try {
            const response = await fetch(`${API_BASE_URL}/get_messages`, {
                headers: getAuthHeaders(user.authToken)
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

    // WebSocket messages are now handled by the active panel
    // No need for duplicate handling here

    // Load messages only once when component mounts and user is authenticated
    useEffect(() => {
        if (user.authToken && !messagesLoadedRef.current) {
            loadMessages();
        }
    }, [user.authToken, loadMessages]);

    // Reset messages loaded flag and clear messages when chat changes
    useEffect(() => {
        console.log("🔄 [DEBUG] useChat useEffect triggered for chat change:", chat.currentChat);
        console.log("📝 [DEBUG] useChat: Resetting messages loaded flag and clearing messages");
        messagesLoadedRef.current = false;
        clearMessages(); // Clear messages when switching chats
        console.log("📥 [DEBUG] useChat: Loading messages for new chat");
        loadMessages();
    }, [chat.currentChat, clearMessages]);

    return {
        messages: chat.messages,
        currentChat: chat.currentChat,
        activeTab: chat.activeTab,
        dmUsers: chat.dmUsers,
        activeDm: chat.activeDm,
        isChatSwitching: chat.isChatSwitching,
        setIsChatSwitching,
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
