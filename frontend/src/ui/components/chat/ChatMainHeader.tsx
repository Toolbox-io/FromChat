export function ChatMainHeader() {
    return (
        <div className="chat-header">
            <img src="./src/resources/images/default-avatar.png" alt="Avatar" className="chat-header-avatar" />
            <div className="chat-header-info">
                <div className="info-chat">
                    <h4 id="chat-name">Общий чат</h4>
                    <p>
                        <span className="online-status"></span>
                        Онлайн
                    </p>
                </div>
                <a href="#" id="hide-chat">Свернуть чат</a>
            </div>
        </div>
    );
}
