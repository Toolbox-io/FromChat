import { useAppState } from "@/pages/chat/state";
import { MessagePanelRenderer } from "./MessagePanelRenderer";

export function RightPanel() {
    const { chat } = useAppState();

    return <MessagePanelRenderer panel={chat.activePanel} />
}