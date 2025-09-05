import { useChat } from "../../hooks/useChat";
import { ChatInputWrapper } from "./ChatInputWrapper";
import { ChatMainHeader } from "./ChatMainHeader";
import { ChatMessages } from "./ChatMessages";

export function RightPanel() {
    const { isChatSwitching } = useChat();

    return (
        <div className={`chat-container ${!isChatSwitching && "chat-switch-in"} chat-switch-out`}>
            <div className="chat-main" id="chat-inner">
                <ChatMainHeader />
                <ChatMessages />
                <ChatInputWrapper />
            </div>
        </div>
    );
}
