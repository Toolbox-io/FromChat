import { LeftPanel } from "../components/chat/LeftPanel";
import { RightPanel } from "../components/chat/RightPanel";
import { CallWindow } from "../components/chat/CallWindow";

export default function ChatScreen() {
    return (
        <div id="chat-interface">
            <div className="all-container">
                <LeftPanel />
                <RightPanel />
            </div>
            <CallWindow />
        </div>
    );
}