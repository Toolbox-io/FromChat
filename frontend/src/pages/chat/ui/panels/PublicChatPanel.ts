import { MessagePanel } from "./MessagePanel";
import { API_BASE_URL } from "../../core/config";
import { getAuthHeaders } from "../../../../api/authApi";
import { request } from "../../core/websocket";
import type { ChatWebSocketMessage, Message, SendMessageRequest, ReactionUpdateWebSocketMessage } from "../../core/types";
import type { UserState } from "../state";

export class PublicChatPanel extends MessagePanel {
    private messagesLoaded: boolean = false;

    constructor(
        chatName: string,
        currentUser: UserState
    ) {
        super(`public-${chatName}`, currentUser);
        this.updateState({
            title: chatName,
            online: true // Public chats are always "online"
        });
    }

    isDm(): boolean {
        return false;
    }

    async activate(): Promise<void> {
        // Don't load messages immediately during activation to prevent animation freeze
        // Messages will be loaded after the animation completes
    }

    deactivate(): void {
        // Public chat doesn't need special cleanup
    }

    clearMessages(): void {
        super.clearMessages();
        this.messagesLoaded = false;
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

    protected async sendMessage(content: string, replyToId?: number, files: File[] = []): Promise<void> {
        if (!this.currentUser.authToken || !content.trim()) return;

        try {
            if (files.length === 0) {
                const response = await request({
                    data: {
                        content: content.trim(), 
                        reply_to_id: replyToId ?? null
                    },
                    credentials: {
                        scheme: "Bearer",
                        credentials: this.currentUser.authToken
                    },
                    type: "sendMessage"
                } satisfies SendMessageRequest);
                if (response.error) {
                    console.error("Error sending message:", response.error);
                }
            } else {
                const form = new FormData();
                form.append("payload", JSON.stringify({
                    content: content.trim(),
                    reply_to_id: replyToId ?? null 
                } satisfies SendMessageRequest["data"]));
                for (const f of files) form.append("files", f, f.name);
                const res = await fetch(`${API_BASE_URL}/send_message`, {
                    method: "POST",
                    headers: getAuthHeaders(this.currentUser.authToken, false),
                    body: form
                });
                if (!res.ok) {
                    console.error("Error sending message with files", await res.text());
                }
            }
        } catch (error) {
            console.error("Error sending message:", error);
        }
    }

    // Handle incoming WebSocket messages
    async handleWebSocketMessage(response: ChatWebSocketMessage | ReactionUpdateWebSocketMessage): Promise<void> {
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
                    const newMsg = response.data;
                    
                    // Check if this is a confirmation of a message we sent
                    const isOurMessage = newMsg.username === this.currentUser.currentUser?.username;
                    if (isOurMessage) {
                        // This is our message being confirmed, find the temp message and replace it
                        const tempMessages = this.getMessages().filter(m => m.id === -1 && m.runtimeData?.sendingState?.tempId);
                        for (const tempMsg of tempMessages) {
                            if (tempMsg.runtimeData?.sendingState?.retryData?.content === newMsg.content) {
                                this.handleMessageConfirmed(tempMsg.runtimeData.sendingState.tempId!, newMsg);
                                return;
                            }
                        }
                    }
                    
                    this.addMessage(newMsg);
                }
                break;
            case 'reactionUpdate':
                if (response.data) {
                    this.updateMessageReactions(response.data.message_id, response.data.reactions);
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

    async handleEditMessage(messageId: number, content: string): Promise<void> {
        if (!this.currentUser.authToken) return;
        try {
            await request({
                type: "editMessage",
                data: {
                    message_id: messageId,
                    content: content
                },
                credentials: {
                    scheme: "Bearer",
                    credentials: this.currentUser.authToken
                }
            });
        } catch (error) {
            console.error("Failed to edit message:", error);
        }
    }

    async handleDeleteMessage(id: number): Promise<void> {
        // Remove message immediately from UI
        this.deleteMessageImmediately(id);
        
        // Fire and forget server deletion; UI already updated
        await request({
            type: "deleteMessage",
            data: { message_id: id },
            credentials: { 
                scheme: "Bearer", 
                credentials: this.currentUser.authToken! 
            }
        });
    }
    
    handleProfileClick(): void {}
}