import { useState, useEffect } from "react";
import type { Message } from "../../../core/types";
import { MaterialDialog } from "../Dialog";

interface EditMessageDialogProps {
    isOpen: boolean;
    onOpenChange: (value: boolean) => void;
    message: Message | null;
    onSave: (messageId: number, newContent: string) => void;
}

export function EditMessageDialog({ isOpen, onOpenChange, message, onSave }: EditMessageDialogProps) {
    const [editContent, setEditContent] = useState("");

    useEffect(() => {
        if (message) {
            setEditContent(message.content);
        }
    }, [message]);

    const handleSave = () => {
        if (message && editContent.trim()) {
            onSave(message.id, editContent.trim());
            onOpenChange(false);
        }
    };

    const handleCancel = () => {
        onOpenChange(false);
        setEditContent("");
    };

    if (!message) return null;

    return (
        <MaterialDialog open={isOpen} onOpenChange={onOpenChange} close-on-overlay-click close-on-esc>
            <div className="dialog-content">
                <h3>Edit Message</h3>
                <mdui-text-field 
                    value={editContent}
                    onInput={(e) => setEditContent((e.target as HTMLInputElement).value)}
                    label="Edit Message" 
                    variant="outlined" 
                    placeholder="Edit your message..."
                    maxlength={1000}>
                </mdui-text-field>
                <div className="dialog-actions">
                    <mdui-button onClick={handleCancel} variant="outlined">Cancel</mdui-button>
                    <mdui-button onClick={handleSave}>Save</mdui-button>
                </div>
            </div>
        </MaterialDialog>
    );
}
