import { LeftPanel } from "./left/LeftPanel";
import { RightPanel } from "./right/RightPanel";
import "@/pages/chat/css/chat.scss";
import useDownloadAppScreen from "@/core/hooks/useDownloadAppScreen";

export default function ChatPage() {
    const { navigate: navigateDownloadApp } = useDownloadAppScreen();
    if (navigateDownloadApp) return navigateDownloadApp;

    return (
        <div id="chat-interface">
            <div className="all-container">
                <LeftPanel />
                <RightPanel />
            </div>
        </div>
    );
}
