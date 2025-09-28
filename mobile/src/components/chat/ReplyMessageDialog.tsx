import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { Message } from "../../core/types";
import { MaterialDialog } from "../core/Dialog";
import { MaterialTextField } from "../core/TextField";

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
        <MaterialDialog open={isOpen} onOpenChange={onOpenChange} close-on-overlay-click close-on-esc className="reply-dialog">
            <div className="dialog-content">
                <h3>Ответить на сообщение</h3>
                <div className="reply-preview-dialog">
                    <div className="reply-content">
                        <span className="reply-username">{replyToMessage.username}</span>
                        <span className="reply-text">{replyToMessage.content}</span>
                    </div>
                </div>
                <MaterialTextField
                    value={replyContent}
                    onInput={(e) => setReplyContent((e.target as HTMLInputElement).value)}
                    label="Reply" 
                    variant="outlined" 
                    placeholder="Type your reply..."
                    maxlength={1000} />
                <View style={styles.dialogActions}>
                    <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancel}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.button, styles.sendButton]} onPress={handleSendReply}>
                        <Text style={styles.sendButtonText}>Send Reply</Text>
                    </TouchableOpacity>
                </View>
            </div>
        </MaterialDialog>
    );
}

const styles = StyleSheet.create({
    dialogActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        paddingTop: 16,
    },
    button: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 4,
        minWidth: 80,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#666',
    },
    sendButton: {
        backgroundColor: '#1976d2',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '500',
    },
    sendButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '500',
    },
});
