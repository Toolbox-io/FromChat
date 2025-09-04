import { useState, useEffect } from "react";
import type { Message } from "../../../core/types";
import { EditMessageDialog } from "./EditMessageDialog";
import { ReplyMessageDialog } from "./ReplyMessageDialog";

interface MessageContextMenuProps {
    message: Message;
    isAuthor: boolean;
    onEdit: (message: Message) => void;
    onReply: (message: Message) => void;
    onDelete: (message: Message) => void;
    position: { x: number; y: number };
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
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
    position,
    isOpen,
    onOpenChange
}: MessageContextMenuProps) {
    console.log("MessageContextMenu rendered with position:", position, "message:", message.id);
    
    // Internal state for dialogs and closing animation
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [replyDialogOpen, setReplyDialogOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    // Effect to handle clicks outside the context menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen && !isClosing && !editDialogOpen && !replyDialogOpen) {
                // Check if the click is on a context menu element
                const target = event.target as Element;
                if (!target.closest('.context-menu')) {
                    handleClose();
                }
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen && !isClosing && !editDialogOpen && !replyDialogOpen) {
                handleClose();
            }
        };

        const handleWindowBlur = () => {
            // Close context menu when browser window loses focus
            if (isOpen && !isClosing && !editDialogOpen && !replyDialogOpen) {
                handleClose();
            }
        };

        // Add event listeners
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('blur', handleWindowBlur);

        // Cleanup
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('blur', handleWindowBlur);
        };
    }, [isOpen, isClosing, editDialogOpen, replyDialogOpen]);
    
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
                    handleClose();
                }
                break;
        }
    };

    const handleClose = () => {
        setIsClosing(true);
        // Wait for animation to complete before calling onOpenChange
        setTimeout(() => {
            onOpenChange(false);
            setIsClosing(false);
        }, 200); // Match the animation duration from _animations.scss
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



    const content = (
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
    )

    // Don't render if not open
    if (!isOpen && !editDialogOpen && !replyDialogOpen) return null;

    return (
        <>
            {isOpen ? content : null}
            
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
