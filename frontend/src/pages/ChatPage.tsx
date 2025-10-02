import { LeftPanel } from "./app/ui/components/chat/LeftPanel";
import { RightPanel } from "./app/ui/components/chat/RightPanel";

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
