import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";

export function ChatInterface() {
    return (
        <div id="chat-interface">
            <div className="all-container">
                <LeftPanel />
                <RightPanel />
            </div>
        </div>
    );
}
