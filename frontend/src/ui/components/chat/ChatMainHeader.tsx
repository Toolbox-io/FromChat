import { useChat } from "../../hooks/useChat";
import { useState } from "react";

export function ChatMainHeader() {
    const { currentChat } = useChat();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleCollapse = () => {
        setIsCollapsed(!isCollapsed);
        // TODO: Implement chat collapse animation
    };

    return (
        <div className="chat-header">
            <img src="./src/resources/images/default-avatar.png" alt="Avatar" className="chat-header-avatar" />
            <div className="chat-header-info">
                <div className="info-chat">
                    <h4 id="chat-name">{currentChat}</h4>
                    <p>
                        <span className="online-status"></span>
                        Онлайн
                    </p>
                </div>
                <a href="#" id="hide-chat" onClick={handleCollapse}>Свернуть чат</a>
            </div>
        </div>
    );
}
