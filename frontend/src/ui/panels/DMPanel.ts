import { MessagePanel, type MessagePanelCallbacks, type MessagePanelState } from "./MessagePanel";
import { 
    fetchDMHistory, 
    decryptDm, 
    sendDMViaWebSocket,
    sendDmWithFiles
} from "../../api/dmApi";
import type { Message, WebSocketMessage } from "../../core/types";
import type { UserState } from "../state";

export interface DMPanelData {
    userId: number;
    username: string;
    publicKey: string;
    profilePicture?: string;
    online: boolean;
}

export class DMPanel extends MessagePanel {
    private dmData: DMPanelData | null = null;
    private messagesLoaded: boolean = false;

    constructor(
        user: UserState,
        callbacks: MessagePanelCallbacks,
        onStateChange: (state: MessagePanelState) => void
    ) {
        super("dm", user, callbacks, onStateChange);
    }

    isDm(): boolean {
        return true;
    }

    async activate(): Promise<void> {
        if (this.dmData && !this.messagesLoaded) {
            await this.loadMessages();
        }
    }

    deactivate(): void {
        // DM doesn't need special cleanup
    }

    async loadMessages(): Promise<void> {
        if (!this.currentUser.authToken || !this.dmData || this.messagesLoaded) return;

        this.setLoading(true);
        try {
            const messages = await fetchDMHistory(this.dmData.userId, this.currentUser.authToken, 50);
            const decryptedMessages: Message[] = [];
            let maxIncomingId = 0;

            for (const env of messages) {
                try {
                    const text = await decryptDm(env, this.dmData!.publicKey);
                    const isAuthor = env.senderId !== this.dmData!.userId;
                    const username = isAuthor ? this.currentUser.currentUser?.username ?? "You" : this.dmData!.username;
                    
                    decryptedMessages.push({
                        id: env.id,
                        content: text,
                        username: username,
                        timestamp: env.timestamp,
                        is_read: false,
                        is_edited: false
                    });

                    if (env.senderId === this.dmData!.userId && env.id > maxIncomingId) {
                        maxIncomingId = env.id;
                    }
                } catch (error) {
                    console.error("Error decrypting message:", error);
                }
            }

            this.clearMessages();
            decryptedMessages.forEach(msg => this.addMessage(msg));

            // Update last read ID
            if (maxIncomingId > 0) {
                this.setLastReadId(this.dmData.userId, maxIncomingId);
            }
            this.messagesLoaded = true;
        } catch (error) {
            console.error("Failed to load DM history:", error);
        } finally {
            this.setLoading(false);
        }
    }

    async sendMessage(content: string, _replyToId?: number, files: File[] = []): Promise<void> {
        if (!this.currentUser.authToken || !this.dmData || !content.trim()) return;

        try {
            if (files.length === 0) {
                await sendDMViaWebSocket(
                    this.dmData.userId, 
                    this.dmData.publicKey, 
                    content, 
                    this.currentUser.authToken
                );
            } else {
                const json = JSON.stringify({ type: "text", data: { content: content.trim() } });
                await sendDmWithFiles(
                    this.dmData.userId,
                    this.dmData.publicKey,
                    json,
                    files,
                    this.currentUser.authToken
                );
            }
        } catch (error) {
            console.error("Failed to send DM:", error);
        }
    }

    // Set DM conversation data
    setDMData(dmData: DMPanelData): void {
        this.dmData = dmData;
        this.messagesLoaded = false;
        this.updateState({
            id: `dm-${dmData.userId}`,
            title: dmData.username,
            profilePicture: dmData.profilePicture,
            online: dmData.online
        });
    }

    // Handle incoming WebSocket DM messages
    handleWebSocketMessage = async (response: WebSocketMessage): Promise<void> => {
        if (response.type === "dmNew" && this.dmData) {
            const { senderId, recipientId, ...envelope } = response.data;
            
            // If this is for the active DM conversation
            if (senderId === this.dmData.userId || recipientId === this.dmData.userId) {
                try {
                    const plaintext = await decryptDm(envelope, this.dmData.publicKey);
                    const isAuthor = senderId !== this.dmData.userId;
                    
                    this.addMessage({
                        id: envelope.id,
                        content: plaintext,
                        username: isAuthor ? this.currentUser.currentUser?.username ?? "You" : this.dmData.username,
                        timestamp: envelope.timestamp,
                        is_read: false,
                        is_edited: false
                    });

                    // Update last read if it's from the other user
                    if (senderId === this.dmData.userId) {
                        this.setLastReadId(this.dmData.userId, Math.max(this.getLastReadId(this.dmData.userId), envelope.id));
                    }
                } catch (error) {
                    console.error("Failed to decrypt incoming DM:", error);
                }
            }
        }
    };

    // Reset for DM switching
    reset(): void {
        this.dmData = null;
        this.messagesLoaded = false;
        this.clearMessages();
        this.updateState({
            id: "dm",
            title: "Select a user",
            profilePicture: undefined,
            online: false
        });
    }

    // Update auth token
    setAuthToken(authToken: string): void {
        this.currentUser.authToken = authToken;
    }

    // Helper functions for localStorage
    private getLastReadId(userId: number): number {
        try {
            const v = localStorage.getItem(`dmLastRead:${userId}`);
            return v ? Number(v) : 0;
        } catch {
            return 0;
        }
    }

    private setLastReadId(userId: number, id: number): void {
        try {
            localStorage.setItem(`dmLastRead:${userId}`, String(id));
        } catch {}
    }
}
