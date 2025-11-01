import { Message } from "./Message";
import { useAppState } from "@/pages/chat/state";
import type { Message as MessageType } from "@/core/types";
import { MessageContextMenu, type ContextMenuState } from "./MessageContextMenu";
import { useEffect, useState, type ReactNode } from "react";
import { MaterialDialog } from "@/core/components/Dialog";
import { request } from "@/core/websocket";
import type { AddReactionRequest, AddDmReactionRequest } from "@/core/types";
import { MaterialButton } from "@/utils/material";

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
                    await request<AddDmReactionRequest["data"]>({
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
                await request<AddReactionRequest["data"]>({
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



    return (
        <>
            <div className="chat-messages" id="chat-messages">
                {messages.map((message: MessageType) => (
                    <Message
                        key={message.id}
                        message={message}
                        isAuthor={isDm ?
                            (message.runtimeData?.dmEnvelope?.senderId === user.currentUser?.id) :
                            (message.user_id === user.currentUser?.id)
                        }
                        onContextMenu={handleContextMenu}
                        onReactionClick={handleReactionClick}
                        isDm={isDm}
                        dmRecipientPublicKey={dmRecipientPublicKey} />
                ))}
                {children}
            </div>

            <MaterialDialog
                headline="Удалить сообщение?"
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}>
                <MaterialButton slot="action" variant="tonal" onClick={() => setDeleteDialogOpen(false)}>Отменить</MaterialButton>
                <MaterialButton slot="action" variant="filled" onClick={confirmDelete}>Удалить</MaterialButton>
            </MaterialDialog>

            {/* Context Menu */}
            {contextMenu.message && (
                <MessageContextMenu
                    message={contextMenu.message}
                    isAuthor={isDm ?
                        (contextMenu.message.runtimeData?.dmEnvelope?.senderId === user.currentUser?.id) :
                        (contextMenu.message.user_id === user.currentUser?.id)
                    }
                    onEdit={handleEdit}
                    onReply={handleReply}
                    onDelete={handleDelete}
                    onRetry={handleRetry}
                    onReactionClick={handleReactionClick}
                    position={contextMenu.position}
                    isOpen={contextMenu.isOpen}
                    onOpenChange={handleContextMenuOpenChange}
                />
            )}


        </>
    );
}
