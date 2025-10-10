import { MessagePanel } from "./MessagePanel";
import { 
    fetchDMHistory, 
    decryptDm, 
    sendDMViaWebSocket,
    sendDmWithFiles,
    editDmEnvelope,
    deleteDmEnvelope
} from "../../../../../core/api/dmApi";
import type { DmEncryptedJSON, DmEnvelope, DMWebSocketMessage, EncryptedMessageJson, Message } from "@/core/types";
import type { UserState } from "@/pages/chat/state";

export interface DMPanelData {
    userId: number;
    username: string;
    publicKey: string;
    profilePicture?: string;
    online: boolean;
}

export class DMPanel extends MessagePanel {
    public dmData: DMPanelData | null = null;
    private messagesLoaded: boolean = false;

    constructor(
        user: UserState
    ) {
        super("dm", user);
    }

    isDm(): boolean {
        return true;
    }

    async activate(): Promise<void> {
        // Don't load messages immediately during activation to prevent animation freeze
        // Messages will be loaded after the animation completes
    }

    deactivate(): void {
        // DM doesn't need special cleanup
    }

    clearMessages(): void {
        super.clearMessages();
        this.messagesLoaded = false;
    }

    private async parseTextPayload(env: DmEnvelope, decryptedMessages: Message[]) {
        const plaintext = await decryptDm(env, this.dmData!.publicKey);
        const isAuthor = env.senderId !== this.dmData!.userId;
        const username = isAuthor ? this.currentUser.currentUser?.username ?? "You" : this.dmData!.username;

        // Try parse JSON payload { type: "text", data: { content, files?, reply_to_id? } }
        let content = plaintext;
        let reply_to_id: number | undefined = undefined;
        try {
            const obj = JSON.parse(plaintext) as DmEncryptedJSON;
            if (obj && obj.type === "text" && obj.data) {
                content = obj.data.content;
                reply_to_id = Number(obj.data.reply_to_id) || undefined;
            }
        } catch {}

        const dmMsg: Message = {
            id: env.id,
            content: content,
            username: username,
            timestamp: env.timestamp,
            is_read: false,
            is_edited: false,
            files: env.files?.map(file => { return {"name": file.name, "encrypted": true, "path": file.path} }) || [],
            reactions: env.reactions || [],

            runtimeData: {
                dmEnvelope: env
            }
        };

        if (reply_to_id) {
            const referenced = decryptedMessages.find(m => m.id === reply_to_id);
            if (referenced) dmMsg.reply_to = referenced;
        }

        return dmMsg;
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
                    const dmMsg = await this.parseTextPayload(env, decryptedMessages);
                    decryptedMessages.push(dmMsg);

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

    protected async sendMessage(content: string, replyToId?: number, files: File[] = []): Promise<void> {
        if (!this.currentUser.authToken || !this.dmData || !content.trim()) return;

        try {
            const payload: DmEncryptedJSON = { 
                type: "text", 
                data: { 
                    content: content.trim(), 
                    reply_to_id: replyToId ?? undefined
                }
            }
            const json = JSON.stringify(payload);

            if (files.length === 0) {
                await sendDMViaWebSocket(
                    this.dmData.userId,
                    this.dmData.publicKey,
                    json,
                    this.currentUser.authToken
                );
            } else {
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
    async handleWebSocketMessage(response: DMWebSocketMessage): Promise<void> {
        if (response.type === "dmNew" && this.dmData) {
            const envelope = response.data;
            
            // If this is for the active DM conversation
            if (envelope.senderId === this.dmData.userId || envelope.recipientId === this.dmData.userId) {
                try {
                    const dmMsg = await this.parseTextPayload(envelope, this.getMessages());
                    
                    // Check if this is a confirmation of a message we sent
                    const isOurMessage = envelope.senderId !== this.dmData.userId;
                    if (isOurMessage) {
                        // This is our message being confirmed, find the temp message and replace it
                        const tempMessages = this.getMessages().filter(m => m.id === -1 && m.runtimeData?.sendingState?.tempId);
                        for (const tempMsg of tempMessages) {
                            if (tempMsg.runtimeData?.sendingState?.retryData?.content === dmMsg.content) {
                                this.handleMessageConfirmed(tempMsg.runtimeData.sendingState.tempId!, dmMsg);
                                return;
                            }
                        }
                    }
                    
                    this.addMessage(dmMsg);

                    // Update last read if it's from the other user
                    if (envelope.senderId === this.dmData.userId) {
                        this.setLastReadId(this.dmData.userId, Math.max(this.getLastReadId(this.dmData.userId), envelope.id));
                    }
                } catch (error) {
                    console.error("Failed to decrypt incoming DM:", error);
                }
            }
        }
        if (response.type === "dmEdited" && this.dmData) {
            const { id, iv, ciphertext, salt, iv2, wrappedMk } = response.data;
            try {
                // Decrypt new content in-place
                const plaintext = await decryptDm(
                    { 
                        id, 
                        senderId: 0, 
                        recipientId: 0, 
                        iv, 
                        ciphertext, 
                        salt, 
                        iv2, 
                        wrappedMk, 
                        timestamp: new Date().toISOString() 
                    }, 
                    this.dmData.publicKey
                );
                let content = plaintext;
                let files: Message["files"] | undefined = undefined;
                try {
                    const obj = JSON.parse(plaintext) as EncryptedMessageJson;
                    if (obj.type === "text" && obj.data) {
                        content = obj.data.content;
                        files = obj.data.files;
                    }
                } catch {}
                const updates: Partial<Message> = { content, is_edited: true, files };
                this.updateMessage(id, updates);
            } catch (e) {
                this.updateMessage(id, { is_edited: true });
            }
        }
        if (response.type === "dmDeleted" && this.dmData) {
            const { id } = response.data;
            this.removeMessage(id);
        }
        if (response.type === "dmReactionUpdate" && this.dmData) {
            const { dm_envelope_id, reactions } = response.data;
            this.updateMessageReactions(dm_envelope_id, reactions);
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

    async handleDeleteMessage(messageId: number): Promise<void> {
        if (!this.currentUser.authToken || !this.dmData) return;
        
        // Remove message immediately from UI
        this.deleteMessageImmediately(messageId);
        
        // Fire and forget server deletion; UI already updated
        await deleteDmEnvelope(messageId, this.dmData.userId, this.currentUser.authToken);
    }

    async handleEditMessage(messageId: number, content: string): Promise<void> {
        if (!this.currentUser.authToken || !this.dmData) return;
        const msg = this.getMessages().find(m => m.id === messageId);
        // Build encrypted JSON preserving files and reply_to if present
        const payload: EncryptedMessageJson = {
            type: "text",
            data: {
                content: content,
                files: msg?.files,
                reply_to_id: msg?.reply_to?.id ?? undefined
            }
        };
        editDmEnvelope(messageId, this.dmData.publicKey, JSON.stringify(payload), this.currentUser.authToken).catch((e) => {
            console.error("Failed to edit DM:", e);
        });
    }
    
    handleProfileClick(): void {}

    updateMessageReactions(dmEnvelopeId: number, reactions: any[]): void {
        const messages = this.getMessages();
        const messageIndex = messages.findIndex(msg => 
            msg.runtimeData?.dmEnvelope?.id === dmEnvelopeId
        );
        
        if (messageIndex !== -1) {
            const updatedMessage = { ...messages[messageIndex] };
            updatedMessage.reactions = reactions;
            this.updateMessage(updatedMessage.id, { reactions: reactions });
        }
    }
}
