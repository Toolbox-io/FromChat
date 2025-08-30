import { ChatHeader } from "./ChatHeader";
import { ChatTabs } from "./ChatTabs";
import { BottomAppBar } from "./BottomAppBar";

export function ChatList() {
    return (
        <div className="chat-list" id="chat-list">
            <ChatHeader />
            <ChatTabs />
            <BottomAppBar />
        </div>
    );
}
