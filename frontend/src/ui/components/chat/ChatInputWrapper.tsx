import { useState, useEffect } from "react";
import { RichTextArea } from "../core/RichTextArea";
import type { Message } from "../../../core/types";
import Quote from "../core/Quote";
import AnimatedHeight from "../core/animations/AnimatedHeight";

interface ChatInputWrapperProps {
    onSendMessage: (message: string) => void;
    onSaveEdit?: (content: string) => void;
    replyTo?: Message | null;
    replyToVisible: boolean;
    onClearReply?: () => void;
    onCloseReply?: () => void;
    editingMessage?: Message | null;
    editVisible?: boolean;
    onClearEdit?: () => void;
    onCloseEdit?: () => void;
}

export function ChatInputWrapper({ onSendMessage, onSaveEdit, replyTo, replyToVisible, onClearReply, onCloseReply, editingMessage, editVisible = false, onClearEdit, onCloseEdit }: ChatInputWrapperProps) {
    const [message, setMessage] = useState("");

    // When entering edit mode, preload the message content
    useEffect(() => {
        if (editingMessage) {
            setMessage(editingMessage.content || "");
        }
    }, [editingMessage]);

    const handleSubmit = async (e: React.FormEvent | Event) => {
        e.preventDefault();
        if (message.trim()) {
            if (editingMessage && onSaveEdit) {
                onSaveEdit(message);
                setMessage("");
                if (onClearEdit) onClearEdit();
            } else {
                onSendMessage(message);
                setMessage("");
                if (onClearReply) onClearReply();
            }
        }
    };

    return (
        <div className="chat-input-wrapper">
            <form className="input-group" id="message-form" onSubmit={handleSubmit}>
                <AnimatedHeight visible={editVisible} onFinish={onCloseEdit}>
                    {editingMessage && (
                        <div className="reply-preview contextual-preview">
                            <mdui-icon name="edit" />
                            <Quote className="reply-content contextual-content" background="surfaceContainer">
                                <span className="reply-username">{editingMessage!.username}</span>
                                <span className="reply-text">{editingMessage!.content}</span>
                            </Quote>
                            <mdui-button-icon icon="close" className="reply-cancel" onClick={onClearEdit}></mdui-button-icon>
                        </div>
                    )}
                </AnimatedHeight>
                <AnimatedHeight visible={replyToVisible} onFinish={onCloseReply}>
                    {replyTo && (
                        <div className="reply-preview contextual-preview">
                            <mdui-icon name="reply" />
                            <Quote className="reply-content contextual-content" background="surfaceContainer">
                                <span className="reply-username">{replyTo!.username}</span>
                                <span className="reply-text">{replyTo!.content}</span>
                            </Quote>
                            <mdui-button-icon icon="close" className="reply-cancel" onClick={onClearReply}></mdui-button-icon>
                        </div>
                    )}
                </AnimatedHeight>
                <div className="chat-input">
                    <RichTextArea
                        className="message-input" 
                        id="message-input" 
                        placeholder="Напишите сообщение..." 
                        autoComplete="off"
                        text={message}
                        rows={1}
                        onTextChange={(value) => setMessage(value)}
                        onEnter={handleSubmit} />
                    <button type="submit" className="send-btn">
                        <span className="material-symbols filled">{editingMessage ? "check" : "send"}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
