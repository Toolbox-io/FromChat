import { useEffect, useState } from "react";
import { useChat } from "../../hooks/useChat";
import { useAppState } from "../../state";
import { ChatInputWrapper } from "./ChatInputWrapper";
import { ChatMainHeader } from "./ChatMainHeader";
import { ChatMessages } from "./ChatMessages";
import { DMPanel } from "./DMPanel";
import { delay } from "../../../utils/utils";

export function RightPanel() {
    const { isChatSwitching } = useChat();
    const { chat } = useAppState();
    const [switchIn, setSwitchIn] = useState(false);
    const [switchOut, setSwitchOut] = useState(false);

    useEffect(() => {
        (async () => {
            if (isChatSwitching) {
                setSwitchOut(true);
            } else {
                setSwitchIn(true);
                await delay(200);
                setSwitchIn(false);
                setSwitchOut(false);
            }
        })();
    }, [isChatSwitching])

    let content: React.ReactNode;

    if (chat.activeTab === "dms") {
        content = <DMPanel />
    } else {
        content = (
            <div className="chat-main" id="chat-inner">
                <ChatMainHeader />
                <ChatMessages />
                <ChatInputWrapper />
            </div>
        )
    }

    return (
        <div className={`chat-container ${switchIn ? "chat-switch-in" : ""} ${switchOut ? "chat-switch-out" : ""}`}>
            {content}
        </div>
    );
}
