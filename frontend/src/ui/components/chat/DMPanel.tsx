import { useState, useEffect, useRef } from "react";
import { useAppState } from "../../state";
import { useDM } from "../../hooks/useDM";
import { ChatMessages } from "./ChatMessages";
import defaultAvatar from "../../../resources/images/default-avatar.png";

export function DMPanel() {
    const { chat } = useAppState();
    const { sendDMMessage, isLoadingHistory } = useDM();
    const [message, setMessage] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const activeDm = chat.activeDm;

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat.messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !activeDm?.publicKey) return;

        try {
            await sendDMMessage(activeDm.userId, activeDm.publicKey, message);
            setMessage("");
        } catch (error) {
            console.error("Failed to send DM:", error);
        }
    };

    const handleProfileClick = () => {
        // TODO: Implement profile dialog for DM user
        console.log("Profile clicked for DM user:", activeDm?.username);
    };

    if (!activeDm) {
        return (
            <div className="chat-main" id="chat-inner">
                <div className="chat-header">
                    <img src={defaultAvatar} alt="Avatar" className="chat-header-avatar" />
                    <div className="chat-header-info">
                        <div className="info-chat">
                            <h4 id="chat-name">Выберите пользователя</h4>
                            <p>
                                <span className="online-status"></span>
                                Выберите пользователя для начала разговора
                            </p>
                        </div>
                    </div>
                </div>
                <div className="chat-messages" id="chat-messages">
                    <div style={{ 
                        display: "flex", 
                        justifyContent: "center", 
                        alignItems: "center", 
                        height: "100%",
                        color: "var(--mdui-color-on-surface-variant)"
                    }}>
                        Выберите пользователя из списка для начала личных сообщений
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-main" id="chat-inner">
            <div className="chat-header">
                <img 
                    src={defaultAvatar} 
                    alt="Avatar" 
                    className="chat-header-avatar"
                    onClick={handleProfileClick}
                    style={{ cursor: "pointer" }}
                />
                <div className="chat-header-info">
                    <div className="info-chat">
                        <h4 id="chat-name">{activeDm.username}</h4>
                        <p>
                            <span className="online-status"></span>
                            Личные сообщения
                        </p>
                    </div>
                    <a href="#" id="hide-chat">Свернуть чат</a>
                </div>
            </div>
            
            <div className="chat-messages" id="chat-messages">
                {isLoadingHistory ? (
                    <div style={{ 
                        display: "flex", 
                        justifyContent: "center", 
                        alignItems: "center", 
                        height: "100%",
                        color: "var(--mdui-color-on-surface-variant)"
                    }}>
                        Загрузка сообщений...
                    </div>
                ) : (
                    <>
                        <ChatMessages />
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>
            
            <div className="chat-input-wrapper">
                <div className="chat-input">
                    <form className="input-group" id="message-form" onSubmit={handleSendMessage}>
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
        </div>
    );
}
