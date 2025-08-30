import { ChatMainHeader } from "./ChatMainHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatInputWrapper } from "./ChatInputWrapper";

export function ChatMain() {
    return (
        <div className="chat-main" id="chat-inner">
            <ChatMainHeader />
            <ChatMessages />
            <ChatInputWrapper />
        </div>
    );
}
