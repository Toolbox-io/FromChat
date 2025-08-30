import { useState } from "react";
import { useChat } from "../../hooks/useChat";

export function ChatInputWrapper() {
    const [message, setMessage] = useState("");
    const { sendMessage } = useChat();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim()) {
            await sendMessage(message);
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
