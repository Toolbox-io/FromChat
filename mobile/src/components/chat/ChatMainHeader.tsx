import { useChat } from "../../hooks/useChat";
// Mobile doesn't need default avatar import

export function ChatMainHeader() {
    const { currentChat } = useChat();

    return (
        <div className="chat-header">
            <img src="https://via.placeholder.com/40x40/cccccc/ffffff?text=U" alt="Avatar" className="chat-header-avatar" />
            <div className="chat-header-info">
                <div className="info-chat">
                    <h4 id="chat-name">{currentChat}</h4>
                    <p>
                        <span className="online-status"></span>
                        Онлайн
                    </p>
                </div>
            </div>
        </div>
    );
}
