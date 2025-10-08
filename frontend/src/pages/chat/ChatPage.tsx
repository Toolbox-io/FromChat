import { LeftPanel } from "./ui/components/chat/LeftPanel";
import { RightPanel } from "./ui/components/chat/RightPanel";
import "./chat.scss";

export default function ChatPage() {
    return (
        <div id="chat-interface">
            <div className="all-container">
                <LeftPanel />
                <RightPanel />
            </div>
        </div>
    );
}
