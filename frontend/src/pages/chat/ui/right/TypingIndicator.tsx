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
    const { chat, user } = useAppState();
    
    // Filter out current user and get usernames
    const otherTypingUsers = Array.from(chat.typingUsers.entries())
        .filter(([userId]) => userId !== user.currentUser?.id)
        .map(([, username]) => username);

    if (otherTypingUsers.length === 0) {
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
                {otherTypingUsers.length === 1 
                    ? `${otherTypingUsers[0]} печатает...` 
                    : `${otherTypingUsers.join(", ")} печатают...`
                }
            </span>
        </div>
    );
}
