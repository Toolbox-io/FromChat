import { useState } from "react";
import { useChat } from "../../hooks/useChat";
import { RichTextArea } from "../core/RichTextArea";

interface ChatInputWrapperProps {
    onSendMessage?: (message: string) => void;
}

export function ChatInputWrapper({ onSendMessage }: ChatInputWrapperProps) {
    const [message, setMessage] = useState("");
    const { sendMessage } = useChat();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim()) {
            if (onSendMessage) {
                onSendMessage(message);
            } else {
                await sendMessage(message);
            }
            setMessage("");
        }
    };

    return (
        <div className="chat-input-wrapper">
            <form className="input-group" id="message-form" onSubmit={handleSubmit}>
                <div className="chat-input">
                    <RichTextArea
                        className="message-input" 
                        id="message-input" 
                        placeholder="Напишите сообщение..." 
                        autoComplete="off"
                        text={message}
                        rows={1}
                        onTextChange={(value) => setMessage(value)} />
                    <button type="submit" className="send-btn">
                        <span className="material-symbols filled">send</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
