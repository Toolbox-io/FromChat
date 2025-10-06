import { Message } from "./Message";
import { useAppState } from "../../state";
import type { Message as MessageType } from "../../../core/types";
import type { UserProfile } from "../../../core/types";
import { UserProfileDialog } from "./UserProfileDialog";
import { MessageContextMenu, type ContextMenuState } from "./MessageContextMenu";
import { EmojiMenu } from "./EmojiMenu";
import { fetchUserProfile } from "../../../api/profileApi";
import { useEffect, useState, type ReactNode } from "react";
import { delay } from "../../../utils/utils";
import { MaterialDialog } from "../core/Dialog";
import { request } from "../../../core/websocket";
import type { AddReactionRequest, AddDmReactionRequest } from "../../../core/types";

interface ChatMessagesProps {
    messages?: MessageType[];
    isDm?: boolean;
    children?: ReactNode;
    onReplySelect?: (message: MessageType) => void;
    onEditSelect?: (message: MessageType) => void;
    onDelete?: (id: number) => void;
    onRetryMessage?: (messageId: number) => void;
    dmRecipientPublicKey?: string;
}

export function ChatMessages({ messages = [], children, isDm = false, onReplySelect, onEditSelect, onDelete, onRetryMessage, dmRecipientPublicKey }: ChatMessagesProps) {
    const { user } = useAppState();
    
    // Use prop messages (panels provide their own messages)
    const [profileDialogOpen, setProfileDialogOpen] = useState(false);
    const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    
    // Context menu state
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        isOpen: false,
        message: null,
        position: { x: 0, y: 0 }
    });

    // Delete dialog
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [toBeDeleted, setToBeDeleted] = useState<{ id: number; isDm: boolean } | null>(null);

    // Emoji menu state (for expanded emoji picker)
    const [emojiMenu, setEmojiMenu] = useState<{
        isOpen: boolean;
        message: MessageType | null;
        position: { x: number; y: number };
    }>({
        isOpen: false,
        message: null,
        position: { x: 0, y: 0 }
    });

    useEffect(() => {
        if (!deleteDialogOpen) {
            setToBeDeleted(null);
        }
    }, [deleteDialogOpen]);

    async function handleProfileClick(username: string) {
        if (!user.authToken) return;
        
        setIsLoadingProfile(true);
        try {
            const profile = await fetchUserProfile(user.authToken, username);
            if (profile) {
                setSelectedUserProfile(profile);
                setProfileDialogOpen(true);
            }
        } catch (error) {
            console.error("Failed to fetch user profile:", error);
        } finally {
            setIsLoadingProfile(false);
        }
    };

    function handleContextMenu(e: React.MouseEvent, message: MessageType) {
        e.preventDefault();
        setContextMenu({
            isOpen: true,
            message,
            position: { x: e.clientX, y: e.clientY }
        });
    };

    function handleContextMenuOpenChange(isOpen: boolean) {
        setContextMenu(prev => ({
            ...prev,
            isOpen
        }));
    };

    function handleEdit(message: MessageType) {
        if (onEditSelect) onEditSelect(message);
    };

    function handleReply(message: MessageType) {
        if (onReplySelect) onReplySelect(message);
    };

    async function confirmDelete() {
        if (!toBeDeleted || !user.authToken) return;
        try {
            onDelete?.(toBeDeleted.id);
        } catch (error) {
            console.error("Failed to delete message:", error);
        }
        setDeleteDialogOpen(false);
    }

    async function handleDelete(message: MessageType) {
        setToBeDeleted({ id: message.id, isDm });
        setDeleteDialogOpen(true);
    }

    function handleRetry(message: MessageType) {
        if (onRetryMessage) {
            onRetryMessage(message.id);
        }
    }

    async function handleReactionClick(messageId: number, emoji: string) {
        if (!user.authToken) return;
        
        try {
            if (isDm) {
                // For DM messages, we need to find the dm_envelope_id from the message
                const message = messages.find(m => m.id === messageId);
                const dmEnvelopeId = message?.runtimeData?.dmEnvelope?.id;
                
                if (dmEnvelopeId) {
                    await request<AddDmReactionRequest["data"], any>({
                        type: "addDmReaction",
                        credentials: { scheme: "Bearer", credentials: user.authToken },
                        data: {
                            dm_envelope_id: dmEnvelopeId,
                            emoji: emoji
                        }
                    });
                }
            } else {
                // For regular chat messages
                await request<AddReactionRequest["data"], any>({
                    type: "addReaction",
                    credentials: { scheme: "Bearer", credentials: user.authToken },
                    data: {
                        message_id: messageId,
                        emoji: emoji
                    }
                });
            }
        } catch (error) {
            console.error("Failed to add reaction:", error);
        }
    }


    function handleEmojiMenuClose() {
        setEmojiMenu(prev => ({ ...prev, isOpen: false }));
    }

    function handleExpandEmojiMenu(message: MessageType) {
        const messageElement = document.querySelector(`[data-id="${message.id}"]`);
        if (messageElement) {
            const rect = messageElement.getBoundingClientRect();
            setEmojiMenu({
                isOpen: true,
                message,
                position: { x: rect.left + rect.width / 2, y: rect.bottom + 10 }
            });
        }
    }

    function handleEmojiSelect(emoji: string) {
        if (emojiMenu.message) {
            handleReactionClick(emojiMenu.message.id, emoji);
        }
    }

    return (
        <>
            <div className="chat-messages" id="chat-messages">
                {messages.map((message: MessageType) => (
                    <Message
                        key={message.id}
                        message={message}
                        isAuthor={message.username === user.currentUser?.username}
                        onProfileClick={handleProfileClick}
                        onContextMenu={handleContextMenu}
                        onReactionClick={handleReactionClick}
                        isLoadingProfile={isLoadingProfile}
                        isDm={isDm}
                        dmRecipientPublicKey={dmRecipientPublicKey} />
                ))}
                {children}
            </div>
            
            <UserProfileDialog
                isOpen={profileDialogOpen}
                onOpenChange={async (value) => {
                    setProfileDialogOpen(value);
                    if (!value) {
                        await delay(1000);
                        setSelectedUserProfile(null);
                    }
                }}
                userProfile={selectedUserProfile}
            />

            <MaterialDialog
                headline="Удалить сообщение?"
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}>
                <mdui-button slot="action" variant="tonal" onClick={() => setDeleteDialogOpen(false)}>Отменить</mdui-button>
                <mdui-button slot="action" variant="filled" onClick={confirmDelete}>Удалить</mdui-button>
            </MaterialDialog>
            
            {/* Context Menu */}
            {contextMenu.message && (
                <MessageContextMenu
                    message={contextMenu.message}
                    isAuthor={contextMenu.message.username === user.currentUser?.username}
                    onEdit={handleEdit}
                    onReply={handleReply}
                    onDelete={handleDelete}
                    onRetry={handleRetry}
                    onReactionClick={handleReactionClick}
                    onExpandEmojiMenu={handleExpandEmojiMenu}
                    position={contextMenu.position}
                    isOpen={contextMenu.isOpen}
                    onOpenChange={handleContextMenuOpenChange}
                />
            )}


            {/* Emoji Menu */}
            <EmojiMenu
                isOpen={emojiMenu.isOpen}
                onClose={handleEmojiMenuClose}
                onEmojiSelect={handleEmojiSelect}
                position={emojiMenu.position}
            />
        </>
    );
}
