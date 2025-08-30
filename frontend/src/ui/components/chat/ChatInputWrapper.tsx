export function ChatInputWrapper() {
    return (
        <div className="chat-input-wrapper">
            <div className="chat-input">
                <form className="input-group" id="message-form">
                    <input type="text" className="message-input" id="message-input" placeholder="Напишите сообщение..." autoComplete="off" />
                    <button type="submit" className="send-btn">
                        <span className="material-symbols filled">send</span>
                    </button>
                </form>
            </div>
        </div>
    );
}
