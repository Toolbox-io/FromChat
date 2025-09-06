import { useState } from "react";
import { useChat } from "../../hooks/useChat";

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
            <div className="chat-input">
                <form className="input-group" id="message-form" onSubmit={handleSubmit}>
                    <input 
                        type="text" 
                        className="message-input" 
                        id="message-input" 
                        placeholder="Напишите сообщение..." 
                        autoComplete="off"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    />
                    <button type="submit" className="send-btn">
                        <span className="material-symbols filled">send</span>
                    </button>
                </form>
            </div>
        </div>
    );
}
