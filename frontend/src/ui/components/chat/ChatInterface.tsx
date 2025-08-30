import { ChatList } from "./ChatList";
import { ChatContainer } from "./ChatContainer";

export function ChatInterface() {
    return (
        <div id="chat-interface">
            <div className="all-container">
                <ChatList />
                <ChatContainer />
            </div>
        </div>
    );
}
