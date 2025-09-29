import { useChat } from "../../hooks/useChat";
import { Message } from "./Message";
import { useAppState } from "../../state";
import type { Message as MessageType } from "../../../core/types";
import type { UserProfile } from "../../../core/types";
import { UserProfileDialog } from "./UserProfileDialog";
import { MessageContextMenu, type ContextMenuState } from "./MessageContextMenu";
import { fetchUserProfile } from "../../../api/profileApi";
import { useEffect, useState, type ReactNode } from "react";
import { delay } from "../../../utils/utils";
import { MaterialDialog } from "../core/Dialog";

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

export function ChatMessages({ messages: propMessages, children, isDm = false, onReplySelect, onEditSelect, onDelete, onRetryMessage, dmRecipientPublicKey }: ChatMessagesProps) {
    const { messages: hookMessages } = useChat();
    const { user } = useAppState();
    
    // Use prop messages if provided, otherwise use hook messages
    const messages = propMessages || hookMessages;
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
            // if (toBeDeleted.isDm) {
            //     // For DM, send dmDelete
            //     await request({
            //         type: "dmDelete",
            //         data: { id: toBeDeleted.id },
            //         credentials: { scheme: "Bearer", credentials: user.authToken }
            //     });
            // } else {
            //     await request({
            //         type: "deleteMessage",
            //         data: { message_id: toBeDeleted.id },
            //         credentials: { scheme: "Bearer", credentials: user.authToken }
            //     });
            // }
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

    return (
        <>
            <div className="chat-messages" id="chat-messages">
                {messages.map((message) => (
                    <Message
                        key={message.id}
                        message={message}
                        isAuthor={message.username === user.currentUser?.username}
                        onProfileClick={handleProfileClick}
                        onContextMenu={handleContextMenu}
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
                    position={contextMenu.position}
                    isOpen={contextMenu.isOpen}
                    onOpenChange={handleContextMenuOpenChange}
                />
            )}
        </>
    );
}
