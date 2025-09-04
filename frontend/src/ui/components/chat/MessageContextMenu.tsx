import { useState } from "react";
import type { Message } from "../../../core/types";
import { EditMessageDialog } from "./EditMessageDialog";
import { ReplyMessageDialog } from "./ReplyMessageDialog";

interface MessageContextMenuProps {
    message: Message;
    isAuthor: boolean;
    onEdit: (message: Message) => void;
    onReply: (message: Message) => void;
    onDelete: (message: Message) => void;
    onClose: () => void;
    position: { x: number; y: number };
    isClosing: boolean;
}

export interface ContextMenuState {
    isOpen: boolean;
    message: Message | null;
    position: { x: number; y: number };
}

export function MessageContextMenu({ 
    message, 
    isAuthor, 
    onEdit, 
    onReply, 
    onDelete, 
    onClose, 
    position,
    isClosing
}: MessageContextMenuProps) {
    console.log("MessageContextMenu rendered with position:", position, "message:", message.id);
    
    // Internal state for dialogs
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [replyDialogOpen, setReplyDialogOpen] = useState(false);
    
    const handleAction = (action: string) => {
        console.log("Context menu action triggered:", action);
        switch (action) {
            case "reply":
                setReplyDialogOpen(true);
                break;
            case "edit":
                if (isAuthor) {
                    setEditDialogOpen(true);
                }
                break;
            case "delete":
                if (isAuthor) {
                    onDelete(message);
                    onClose();
                }
                break;
        }
    };

    const handleEditSave = (messageId: number, newContent: string) => {
        // Create a temporary message object with the updated content
        const updatedMessage = { ...message, content: newContent };
        onEdit(updatedMessage);
        setEditDialogOpen(false);
    };

    const handleSendReply = (content: string, replyToId: number) => {
        // Create a temporary message object with the reply content
        const replyMessage = { ...message, content, id: replyToId };
        onReply(replyMessage);
        setReplyDialogOpen(false);
    };

    return (
        <>
            <div 
                className={`context-menu ${isClosing ? 'closing' : 'entering'}`}
                style={{
                    position: "fixed",
                    display: "block",
                    top: position.y,
                    left: position.x,
                    zIndex: 1000
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="context-menu-item" onClick={() => handleAction("reply")}>
                    <span className="material-symbols">reply</span>
                    Reply
                </div>
                {isAuthor && (
                    <>
                        <div className="context-menu-item" onClick={() => handleAction("edit")}>
                            <span className="material-symbols">edit</span>
                            Edit
                        </div>
                        <div className="context-menu-item" onClick={() => handleAction("delete")}>
                            <span className="material-symbols">delete</span>
                            Delete
                        </div>
                    </>
                )}
            </div>
            
            {/* Edit Dialog */}
            <EditMessageDialog
                isOpen={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                message={message}
                onSave={handleEditSave}
            />
            
            {/* Reply Dialog */}
            <ReplyMessageDialog
                isOpen={replyDialogOpen}
                onOpenChange={setReplyDialogOpen}
                replyToMessage={message}
                onSendReply={handleSendReply}
            />
        </>
    );
}
