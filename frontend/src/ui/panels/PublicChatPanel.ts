import { MessagePanel, type MessagePanelCallbacks } from "./MessagePanel";
import { API_BASE_URL } from "../../core/config";
import { getAuthHeaders } from "../../auth/api";
import { request } from "../../websocket";
import type { Message, WebSocketMessage } from "../../core/types";
import type { UserState } from "../state";

export class PublicChatPanel extends MessagePanel {
    private messagesLoaded: boolean = false;

    constructor(
        chatName: string,
        currentUser: UserState,
        callbacks: MessagePanelCallbacks,
        onStateChange: (state: any) => void
    ) {
        super(`public-${chatName}`, currentUser, callbacks, onStateChange);
        this.updateState({
            title: chatName,
            online: true // Public chats are always "online"
        });
    }

    isDm(): boolean {
        return false;
    }

    async activate(): Promise<void> {
        if (!this.messagesLoaded) {
            await this.loadMessages();
        }
    }

    deactivate(): void {
        // Public chat doesn't need special cleanup
    }

    async loadMessages(): Promise<void> {
        if (!this.currentUser.authToken || this.messagesLoaded) return;

        this.setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/get_messages`, {
                headers: getAuthHeaders(this.currentUser.authToken)
            });

            if (response.ok) {
                const data = await response.json();
                if (data.messages && data.messages.length > 0) {
                    this.clearMessages();
                    data.messages.forEach((msg: Message) => {
                        this.addMessage(msg);
                    });
                }
            }
            this.messagesLoaded = true;
        } catch (error) {
            console.error("Error loading public chat messages:", error);
        } finally {
            this.setLoading(false);
        }
    }

    async sendMessage(content: string): Promise<void> {
        if (!this.currentUser.authToken || !content.trim()) return;

        try {
            const response = await request({
                data: { content: content.trim() },
                credentials: {
                    scheme: "Bearer",
                    credentials: this.currentUser.authToken
                },
                type: "sendMessage"
            });

            if (response.error) {
                console.error("Error sending message:", response.error);
            }
        } catch (error) {
            console.error("Error sending message:", error);
        }
    }

    // Handle incoming WebSocket messages
    handleWebSocketMessage = (response: WebSocketMessage): void => {
        switch (response.type) {
            case 'messageEdited':
                if (response.data) {
                    this.updateMessage(response.data.id, response.data);
                }
                break;
            case 'messageDeleted':
                if (response.data && response.data.message_id) {
                    this.removeMessage(response.data.message_id);
                }
                break;
            case 'newMessage':
                if (response.data) {
                    this.addMessage(response.data);
                }
                break;
        }
    };

    // Reset for chat switching
    reset(): void {
        this.messagesLoaded = false;
        this.clearMessages();
    }

    // Update chat name
    setChatName(chatName: string): void {
        this.updateState({
            id: `public-${chatName}`,
            title: chatName
        });
    }

    // Update auth token
    setAuthToken(authToken: string): void {
        this.currentUser.authToken = authToken;
    }
}