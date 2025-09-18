import { useState } from "react";
import { RichTextArea } from "../core/RichTextArea";
import type { Message } from "../../../core/types";
import Quote from "../core/Quote";
import AnimatedHeight from "../core/animations/AnimatedHeight";

interface ChatInputWrapperProps {
    onSendMessage: (message: string) => void;
    replyTo?: Message | null;
    replyToVisible: boolean;
    onClearReply?: () => void;
    onCloseReply?: () => void;
}

export function ChatInputWrapper({ onSendMessage, replyTo, replyToVisible, onClearReply, onCloseReply }: ChatInputWrapperProps) {
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
                <AnimatedHeight visible={replyToVisible} onFinish={onCloseReply}>
                    {replyTo && (
                        <div className="reply-preview">
                            <Quote className="reply-content" background="surfaceContainer">
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
                        <span className="material-symbols filled">send</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
