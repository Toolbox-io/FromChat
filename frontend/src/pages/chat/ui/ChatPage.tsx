import { LeftPanel } from "./left/LeftPanel";
import { RightPanel } from "./right/RightPanel";
import "../css/chat.scss";

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
