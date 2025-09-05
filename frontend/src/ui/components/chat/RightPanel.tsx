import { useEffect, useState } from "react";
import { useChat } from "../../hooks/useChat";
import { ChatInputWrapper } from "./ChatInputWrapper";
import { ChatMainHeader } from "./ChatMainHeader";
import { ChatMessages } from "./ChatMessages";
import { delay } from "../../../utils/utils";

export function RightPanel() {
    const { isChatSwitching } = useChat();
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

    return (
        <div className={`chat-container ${switchIn ? "chat-switch-in" : ""} ${switchOut ? "chat-switch-out" : ""}`}>
            <div className="chat-main" id="chat-inner">
                <ChatMainHeader />
                <ChatMessages />
                <ChatInputWrapper />
            </div>
        </div>
    );
}
