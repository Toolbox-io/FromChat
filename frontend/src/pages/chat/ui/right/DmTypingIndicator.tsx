/**
 * @fileoverview DM typing indicator component for showing when recipient is typing
 * @description Displays typing indicator for DM conversations
 * @author Cursor
 * @version 1.0.0
 */

import { useAppState } from "@/pages/chat/state";

interface DmTypingIndicatorProps {
    recipientId: number;
    className?: string;
}

export function DmTypingIndicator({ recipientId, className = "" }: DmTypingIndicatorProps) {
    const { chat } = useAppState();
    const isTyping = chat.dmTypingUsers.get(recipientId);

    if (!isTyping) {
        return null;
    }

    return (
        <div className={`dm-typing-indicator ${className}`}>
            <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <span className="typing-text">Печатает...</span>
        </div>
    );
}
