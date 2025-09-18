import { useState } from "react";
import { RichTextArea } from "../core/RichTextArea";
import type { Message } from "../../../core/types";

interface ChatInputWrapperProps {
    onSendMessage: (message: string) => void | ((message: string) => void);
    replyTo?: Message | null;
    onClearReply?: () => void;
}

export function ChatInputWrapper({ onSendMessage, replyTo, onClearReply }: ChatInputWrapperProps) {
    const [message, setMessage] = useState("");

    const handleSubmit = async (e: React.FormEvent | Event) => {
        e.preventDefault();
        if (message.trim()) {
            onSendMessage(message);
            setMessage("");
            if (onClearReply) onClearReply();
        }
    };

    return (
        <div className="chat-input-wrapper">
            <form className="input-group" id="message-form" onSubmit={handleSubmit}>
                <div className="chat-input">
                    {replyTo && (
                        <div className="reply-preview">
                            <div className="reply-content">
                                <span className="reply-username">{replyTo.username}</span>
                                <span className="reply-text">{replyTo.content}</span>
                            </div>
                            <button type="button" className="reply-cancel" onClick={onClearReply}>
                                <span className="material-symbols">close</span>
                            </button>
                        </div>
                    )}
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
                        <span className="material-symbols filled">send</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
