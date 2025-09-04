import { useState, useEffect } from "react";
import type { Message } from "../../../core/types";
import { MaterialDialog } from "../Dialog";

interface ReplyMessageDialogProps {
    isOpen: boolean;
    onOpenChange: (value: boolean) => void;
    replyToMessage: Message | null;
    onSendReply: (content: string, replyToId: number) => void;
}

export function ReplyMessageDialog({ isOpen, onOpenChange, replyToMessage, onSendReply }: ReplyMessageDialogProps) {
    const [replyContent, setReplyContent] = useState("");

    useEffect(() => {
        if (replyToMessage) {
            setReplyContent("");
        }
    }, [replyToMessage]);

    const handleSendReply = () => {
        if (replyToMessage && replyContent.trim()) {
            onSendReply(replyContent.trim(), replyToMessage.id);
            onOpenChange(false);
        }
    };

    const handleCancel = () => {
        onOpenChange(false);
        setReplyContent("");
    };

    if (!replyToMessage) return null;

    return (
        <MaterialDialog open={isOpen} onOpenChange={onOpenChange} close-on-overlay-click close-on-esc>
            <div className="dialog-content">
                <h3>Reply to Message</h3>
                <div className="reply-preview">
                    <div className="reply-content">
                        <span className="reply-username">{replyToMessage.username}</span>
                        <span className="reply-text">{replyToMessage.content}</span>
                    </div>
                </div>
                <mdui-text-field 
                    value={replyContent}
                    onInput={(e) => setReplyContent((e.target as HTMLInputElement).value)}
                    label="Reply" 
                    variant="outlined" 
                    placeholder="Type your reply..."
                    maxlength={1000}>
                </mdui-text-field>
                <div className="dialog-actions">
                    <mdui-button onClick={handleCancel} variant="outlined">Cancel</mdui-button>
                    <mdui-button onClick={handleSendReply}>Send Reply</mdui-button>
                </div>
            </div>
        </MaterialDialog>
    );
}
