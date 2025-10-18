/**
 * @fileoverview Typing indicator component for showing who is typing
 * @description Displays a list of users who are currently typing
 * @author Cursor
 * @version 1.0.0
 */

import { useAppState } from "@/pages/chat/state";

interface TypingIndicatorProps {
    className?: string;
}

export function TypingIndicator({ className = "" }: TypingIndicatorProps) {
    const { chat } = useAppState();
    const typingUsers = Array.from(chat.typingUsers);

    if (typingUsers.length === 0) {
        return null;
    }

    return (
        <div className={`typing-indicator ${className}`}>
            <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <span className="typing-text">
                {typingUsers.length === 1 
                    ? "Печатает..." 
                    : `${typingUsers.length} пользователя печатают...`
                }
            </span>
        </div>
    );
}
