import { MessagePanel } from "./MessagePanel";
import api from "@/core/api";
import { decryptDm, sendDMViaWebSocket, sendDmWithFiles } from "@/core/api/dm";
import type { DmEncryptedJSON, DmEnvelope, DMWebSocketMessage, EncryptedMessageJson, Message } from "@/core/types";
import type { UserState, ProfileDialogData } from "@/state/types";
import { formatDMUsername } from "@/pages/chat/hooks/useDM";
import { onlineStatusManager } from "@/core/onlineStatusManager";
import { typingManager } from "@/core/typingManager";
import { SignalProtocolService } from "@/utils/crypto/signalProtocol";

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
    private signalService: SignalProtocolService | null = null;

    constructor(
        user: UserState
    ) {
        super("dm", user);
        // Initialize Signal Protocol service if user is available
        if (user.currentUser?.id) {
            this.signalService = new SignalProtocolService(user.currentUser.id.toString());
        }
    }

    isDm(): boolean {
        return true;
    }

    getRecipientId(): number | null {
        return this.dmData?.userId || null;
    }

    async activate(): Promise<void> {
        // Don't load messages immediately during activation to prevent animation freeze
        // Messages will be loaded after the animation completes

        // Subscribe to recipient's online status
        if (this.dmData?.userId) {
            onlineStatusManager.subscribe(this.dmData.userId);
        }
    }

    deactivate(): void {
        // Unsubscribe from recipient's online status
        if (this.dmData?.userId) {
            onlineStatusManager.unsubscribe(this.dmData.userId);
        }
    }

    clearMessages(): void {
        super.clearMessages();
        this.messagesLoaded = false;
        this.processedMessageIds.clear();
        this.failedDecryptionIds.clear();
    }

    private async parseTextPayload(env: DmEnvelope, decryptedMessages: Message[], plaintextOverride?: string) {
        // Check if this is a message sent by the current user
        const isSentByUs = env.senderId === this.currentUser.currentUser?.id;
        
        let plaintext: string;
        if (isSentByUs) {
            // Can't decrypt our own sent messages in Signal Protocol
            // The plaintext should be passed in from loadMessages (fetched from server)
            if (plaintextOverride) {
                plaintext = plaintextOverride;
            } else {
                // Try to fetch from server as fallback
                try {
                    const { fetchMessagePlaintextsForRecipient } = await import("@/utils/crypto/messagePlaintextSync");
                    const plaintexts = await fetchMessagePlaintextsForRecipient(this.dmData!.userId);
                    const cached = plaintexts.get(env.id);
                    if (cached) {
                        plaintext = cached;
                    } else {
                        // Not on server - skip this message
                        throw new Error("Cannot decrypt own sent message - plaintext not available on server");
                    }
                } catch (error) {
                    throw new Error("Cannot decrypt own sent message - plaintext must be fetched from server first");
                }
            }
        } else {
            // Decrypt incoming messages
            plaintext = await decryptDm(env, env.senderId);
        }
        
        const username = formatDMUsername(
            env.senderId,
            env.recipientId,
            this.currentUser.currentUser?.id!,
            this.dmData!.username
        );

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
            user_id: env.senderId,
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
            // Wait for session restoration to complete (if in progress)
            const { waitForSessionRestore } = await import("@/utils/crypto/sessionRestoreState");
            await waitForSessionRestore();
            console.log(`[DMPanel] Session restoration complete, proceeding with message load for user ${this.dmData.userId}`);
            
            // Ensure Signal Protocol session is established before fetching messages
            if (!this.signalService && this.currentUser.currentUser?.id) {
                this.signalService = new SignalProtocolService(this.currentUser.currentUser.id.toString());
            }
            if (this.signalService) {
                const hasSession = await this.signalService.hasSession(this.dmData.userId);
                if (!hasSession) {
                    try {
                        const bundle = await api.crypto.prekeys.fetchPreKeyBundle(this.dmData.userId, this.currentUser.authToken);
                        await this.signalService.processPreKeyBundle(this.dmData.userId, bundle);
                        console.log(`Established new Signal Protocol session for user ${this.dmData.userId} during history load.`);
                    } catch (error) {
                        console.warn(`Failed to establish Signal Protocol session for user ${this.dmData.userId} during history load:`, error);
                        // Continue loading history, but decryption will likely fail for new messages
                    }
                } else {
                    console.log(`[DMPanel] Signal Protocol session exists for user ${this.dmData.userId}`);
                }
            }
            
            // Fetch encrypted plaintexts from server for sent messages
            const { fetchMessagePlaintextsForRecipient } = await import("@/utils/crypto/messagePlaintextSync");
            const plaintexts = await fetchMessagePlaintextsForRecipient(this.dmData.userId);
            
            const limit = this.calculateMessageLimit();
            const { messages, has_more } = await api.chats.dm.fetchMessages(this.dmData.userId, this.currentUser.authToken, limit);
            const decryptedMessages: Message[] = [];
            let maxIncomingId = 0;

            for (const env of messages) {
                try {
                    // Mark as processed to prevent duplicates
                    if (env.id) {
                        this.processedMessageIds.add(env.id);
                    }
                    
                    // For sent messages, use plaintext from server
                    const isSentByUs = env.senderId === this.currentUser.currentUser?.id;
                    let dmMsg: Message;
                    if (isSentByUs) {
                        const cachedPlaintext = plaintexts.get(env.id);
                        if (!cachedPlaintext) {
                            // Not on server - skip this message
                            continue;
                        }
                        // Parse the plaintext as if it came from parseTextPayload
                        const username = formatDMUsername(
                            env.senderId,
                            env.recipientId,
                            this.currentUser.currentUser?.id!,
                            this.dmData!.username
                        );
                        let content = cachedPlaintext;
                        let reply_to_id: number | undefined = undefined;
                        try {
                            const obj = JSON.parse(cachedPlaintext) as DmEncryptedJSON;
                            if (obj && obj.type === "text" && obj.data) {
                                content = obj.data.content;
                                reply_to_id = Number(obj.data.reply_to_id) || undefined;
                            }
                        } catch {}
                        dmMsg = {
                            id: env.id,
                            user_id: env.senderId,
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
                    } else {
                        dmMsg = await this.parseTextPayload(env, decryptedMessages);
                    }
                    decryptedMessages.push(dmMsg);

                    if (env.senderId === this.dmData!.userId && env.id > maxIncomingId) {
                        maxIncomingId = env.id;
                    }
                } catch (error) {
                    // Log warning with deduplication to avoid console spam
                    if (env.id && !this.failedDecryptionIds.has(env.id)) {
                        this.failedDecryptionIds.add(env.id);
                        console.warn(`Failed to decrypt DM ${env.id}:`, error instanceof Error ? error.message : String(error));
                    }
                    // Remove from processed set if decryption failed
                    if (env.id) {
                        this.processedMessageIds.delete(env.id);
                    }
                }
            }

            // Only clear and replace if we actually decrypted something
            if (decryptedMessages.length > 0) {
                this.clearMessages();
                decryptedMessages.forEach(msg => this.addMessage(msg));
            } else {
                console.warn("[DMPanel] No messages decrypted; keeping existing messages to avoid empty state after reload.");
            }
            this.setHasMoreMessages(has_more);

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

    async loadMoreMessages(): Promise<void> {
        if (!this.currentUser.authToken || !this.dmData || !this.state.hasMoreMessages || this.state.isLoadingMore) return;

        const messages = this.getMessages();
        if (messages.length === 0) return;

        const oldestMessage = messages[0];
        const oldestEnvelope = oldestMessage.runtimeData?.dmEnvelope;
        if (!oldestEnvelope) return;

        this.setLoadingMore(true);
        try {
            // Ensure Signal Protocol session is established before fetching messages
            if (!this.signalService && this.currentUser.currentUser?.id) {
                this.signalService = new SignalProtocolService(this.currentUser.currentUser.id.toString());
            }
            if (this.signalService) {
                const hasSession = await this.signalService.hasSession(this.dmData.userId);
                if (!hasSession) {
                    try {
                        const bundle = await api.crypto.prekeys.fetchPreKeyBundle(this.dmData.userId, this.currentUser.authToken);
                        await this.signalService.processPreKeyBundle(this.dmData.userId, bundle);
                        console.log(`Established new Signal Protocol session for user ${this.dmData.userId} during more history load.`);
                    } catch (error) {
                        console.warn(`Failed to establish Signal Protocol session for user ${this.dmData.userId} during more history load:`, error);
                        // Continue loading history, but decryption will likely fail for new messages
                    }
                }
            }
            
            // Fetch encrypted plaintexts from server for sent messages
            const { fetchMessagePlaintextsForRecipient } = await import("@/utils/crypto/messagePlaintextSync");
            const plaintexts = await fetchMessagePlaintextsForRecipient(this.dmData.userId);
            
            const limit = this.calculateMessageLimit();
            const { messages: newEnvelopes, has_more } = await api.chats.dm.fetchMessages(
                this.dmData.userId,
                this.currentUser.authToken,
                limit,
                oldestEnvelope.id
            );
            
            if (newEnvelopes && newEnvelopes.length > 0) {
                const decryptedMessages: Message[] = [];
                for (const env of newEnvelopes) {
                    try {
                        // Mark as processed to prevent duplicates
                        if (env.id) {
                            this.processedMessageIds.add(env.id);
                        }
                        
                        // For sent messages, use plaintext from server
                        const isSentByUs = env.senderId === this.currentUser.currentUser?.id;
                        let dmMsg: Message;
                        if (isSentByUs) {
                            const cachedPlaintext = plaintexts.get(env.id);
                            if (!cachedPlaintext) {
                                // Not on server - skip this message
                                continue;
                            }
                            // Parse the plaintext as if it came from parseTextPayload
                            const username = formatDMUsername(
                                env.senderId,
                                env.recipientId,
                                this.currentUser.currentUser?.id!,
                                this.dmData!.username
                            );
                            let content = cachedPlaintext;
                            let reply_to_id: number | undefined = undefined;
                            try {
                                const obj = JSON.parse(cachedPlaintext) as DmEncryptedJSON;
                                if (obj && obj.type === "text" && obj.data) {
                                    content = obj.data.content;
                                    reply_to_id = Number(obj.data.reply_to_id) || undefined;
                                }
                            } catch {}
                            dmMsg = {
                                id: env.id,
                                user_id: env.senderId,
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
                        } else {
                            dmMsg = await this.parseTextPayload(env, decryptedMessages);
                        }
                        decryptedMessages.push(dmMsg);
                    } catch (error) {
                        // Silently skip messages that can't be decrypted
                    }
                }
                
                // Prepend older messages (they come in reverse chronological order)
                this.updateState({
                    messages: [...decryptedMessages.reverse(), ...messages]
                });
            }
            this.setHasMoreMessages(has_more);
        } catch (error) {
            console.error("Failed to load more DM messages:", error);
        } finally {
            this.setLoadingMore(false);
        }
    }

    protected async sendMessage(content: string, replyToId?: number, files: File[] = []): Promise<void> {
        if (!this.currentUser.authToken || !this.dmData || !content.trim()) return;

        const payload: DmEncryptedJSON = {
            type: "text",
            data: {
                content: content.trim(),
                reply_to_id: replyToId ?? undefined
            }
        }
        const json = JSON.stringify(payload);

        try {
            if (files.length === 0) {
                await sendDMViaWebSocket(
                    this.dmData.userId,
                    json,
                    this.currentUser.authToken
                );
            } else {
                await sendDmWithFiles(
                    this.dmData.userId,
                    json,
                    files,
                    this.currentUser.authToken
                );
            }
        } catch (error) {
            console.error("Failed to send DM:", error);
            
            // Check if it's a prekey exhaustion error
            const { PrekeyExhaustedError } = await import("@/core/api/crypto/prekeys");
            if (error instanceof PrekeyExhaustedError) {
                const { alert } = await import("@/core/components/AlertDialog");
                await alert("Cannot Send Message: The recipient's encryption keys are temporarily unavailable. They need to come online to refresh their keys. This ensures maximum privacy and security.");
            }
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


    // Track processed message IDs to prevent duplicates
    private processedMessageIds: Set<number> = new Set();
    private failedDecryptionIds: Set<number> = new Set(); // Track messages that failed decryption to avoid spam

    // Handle incoming WebSocket DM messages
    async handleWebSocketMessage(response: DMWebSocketMessage): Promise<void> {
        // Only process actual DM messages, not typing indicators or other events
        if (response.type === "dmNew" && this.dmData) {
            const envelope = response.data;

            // Validate envelope has required fields
            if (!envelope || !envelope.ciphertext || !envelope.senderId || !envelope.id) {
                console.warn("Invalid DM envelope received, skipping");
                return;
            }

            // Skip if we've already processed this message
            if (this.processedMessageIds.has(envelope.id)) {
                return;
            }

            // If this is for the active DM conversation
            if (envelope.senderId === this.dmData.userId || envelope.recipientId === this.dmData.userId) {
                try {
                    // Mark as processed before attempting decryption
                    this.processedMessageIds.add(envelope.id);
                    
                    // Check if this is a confirmation of a message we sent
                    const isOurMessage = envelope.senderId === this.currentUser.currentUser?.id;
                    
                    let dmMsg: Message;
                    if (isOurMessage) {
                        // For sent messages, fetch plaintext from server
                        const { fetchMessagePlaintextsForRecipient } = await import("@/utils/crypto/messagePlaintextSync");
                        const plaintexts = await fetchMessagePlaintextsForRecipient(this.dmData.userId);
                        const cachedPlaintext = plaintexts.get(envelope.id);
                        if (cachedPlaintext) {
                            // Parse the plaintext and create message
                            dmMsg = await this.parseTextPayload(envelope, this.getMessages(), cachedPlaintext);
                        } else {
                            // Plaintext not available yet - this might be a new message confirmation
                            // Try to get it from temp message content
                            const tempMessages = this.getMessages().filter(m => m.id === -1 && m.runtimeData?.sendingState?.tempId);
                            let tempMsgContent: string | null = null;
                            for (const tempMsg of tempMessages) {
                                if (tempMsg.runtimeData?.sendingState?.retryData?.content) {
                                    tempMsgContent = tempMsg.content;
                                    break;
                                }
                            }
                            if (tempMsgContent) {
                                dmMsg = await this.parseTextPayload(envelope, this.getMessages(), tempMsgContent);
                            } else {
                                // Can't display without plaintext - skip
                                console.warn(`Cannot display sent message ${envelope.id} - plaintext not available`);
                                return;
                            }
                        }
                    } else {
                        // Incoming message - decrypt normally
                        dmMsg = await this.parseTextPayload(envelope, this.getMessages());
                    }
                    
                    if (isOurMessage) {
                        // This is our message being confirmed, find the temp message and replace it
                        const tempMessages = this.getMessages().filter(m => m.id === -1 && m.runtimeData?.sendingState?.tempId);
                        let tempMsgContent: string | null = null;
                        for (const tempMsg of tempMessages) {
                            if ((tempMsg.runtimeData?.sendingState?.retryData?.content === dmMsg.content || 
                                tempMsg.content === dmMsg.content) && tempMsg.runtimeData?.sendingState?.tempId) {
                                tempMsgContent = tempMsg.content; // Get plaintext from temp message
                                this.handleMessageConfirmed(tempMsg.runtimeData.sendingState.tempId, dmMsg);
                                
                                // Upload the plaintext to server (encrypted) so we can display it in history
                                const { uploadMessagePlaintext } = await import("@/utils/crypto/messagePlaintextSync");
                                if (tempMsgContent) {
                                    await uploadMessagePlaintext(this.dmData.userId, envelope.id, tempMsgContent);
                                }
                                return;
                            }
                        }
                        
                        // If we didn't find a temp message, try to upload from dmMsg content
                        // (this might happen if the page was reloaded)
                        if (!tempMsgContent && dmMsg.content) {
                            const { uploadMessagePlaintext } = await import("@/utils/crypto/messagePlaintextSync");
                            await uploadMessagePlaintext(this.dmData.userId, envelope.id, dmMsg.content);
                        }
                        
                        // Add the message to the chat
                        this.addMessage(dmMsg);
                        return;
                    }
                    
                    // Incoming message - add to chat
                    this.addMessage(dmMsg);

                    this.addMessage(dmMsg);

                    // Update last read if it's from the other user
                    if (envelope.senderId === this.dmData.userId) {
                        this.setLastReadId(this.dmData.userId, Math.max(this.getLastReadId(this.dmData.userId), envelope.id));
                    }
                } catch (error) {
                    // Only log each failed message once to avoid console spam
                    if (envelope.id && !this.failedDecryptionIds.has(envelope.id)) {
                        this.failedDecryptionIds.add(envelope.id);
                        console.warn(`Failed to decrypt DM ${envelope.id}:`, error instanceof Error ? error.message : String(error));
                    }
                    // Remove from processed set so we can retry if needed
                    if (envelope.id) {
                        this.processedMessageIds.delete(envelope.id);
                    }
                }
            }
        }
        if (response.type === "dmEdited" && this.dmData) {
            const { id, senderId, recipientId, iv, ciphertext, salt, iv2, wrappedMk } = response.data;
            try {
                // Decrypt new content in-place
                const plaintext = await decryptDm(
                    {
                        id,
                        senderId,
                        recipientId,
                        iv,
                        ciphertext,
                        salt,
                        iv2,
                        wrappedMk,
                        timestamp: new Date().toISOString()
                    },
                    senderId
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
        // Unsubscribe from current recipient's status before switching
        if (this.dmData?.userId) {
            onlineStatusManager.unsubscribe(this.dmData.userId);
        }

        this.dmData = null;
        this.messagesLoaded = false;
        this.clearMessages();
        this.failedDecryptionIds.clear(); // Clear failed decryption tracking
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

    // Get DM user ID for call functionality
    getDMUserId(): number | null {
        return this.dmData?.userId || null;
    }

    // Get DM username for call functionality
    getDMUsername(): string | null {
        return this.dmData?.username || null;
    }

    // Handle typing in DM
    handleTyping(): void {
        if (this.dmData?.userId) {
            typingManager.sendDmTyping(this.dmData.userId);
        }
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
        await api.chats.dm.deleteMessage(messageId, this.dmData.userId, this.currentUser.authToken);
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
        api.chats.dm.edit(messageId, this.dmData.userId, JSON.stringify(payload), this.currentUser.authToken).catch((e) => {
            console.error("Failed to edit DM:", e);
        });
    }

    async getProfile(): Promise<ProfileDialogData | null> {
        if (!this.dmData || !this.currentUser.authToken) return null;

        try {
            const userProfile = await api.user.profile.fetchById(this.currentUser.authToken, this.dmData.userId);
            if (!userProfile) return null;

            return {
                userId: userProfile.id,
                username: userProfile.username,
                display_name: userProfile.display_name,
                profilePicture: userProfile.profile_picture,
                bio: userProfile.bio,
                memberSince: userProfile.created_at,
                online: userProfile.online,
                isOwnProfile: false
            };
        } catch (error) {
            console.error("Failed to fetch user profile:", error);
            return null;
        }
    }

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
