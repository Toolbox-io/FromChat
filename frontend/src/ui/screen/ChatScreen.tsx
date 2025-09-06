import { LeftPanel } from "../components/chat/LeftPanel";
import { RightPanel } from "../components/chat/RightPanel";

export default function ChatScreen() {
    return (
        <div id="chat-interface">
            <div className="all-container">
                <LeftPanel />
                <RightPanel />
            </div>
        </div>
    );
}