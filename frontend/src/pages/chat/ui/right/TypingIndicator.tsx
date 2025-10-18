/**
 * @fileoverview Typing indicator component for showing who is typing
 * @description Displays a list of users who are currently typing
 * @author Cursor
 * @version 1.0.0
 */

import { useMemo } from "react";

interface TypingIndicatorProps {
    typingUsers: string[]; // Array of usernames who are typing
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
    // Format the typing text based on number of users
    const typingText = useMemo(() => {
        switch (typingUsers.length) {
            case 0: return "печатает...";
            case 1: return `${typingUsers[0]} печатает...`;
            case 2: return `${typingUsers[0]} и ${typingUsers[1]} печатают...`;
            default: return `${typingUsers[0]}, ${typingUsers[1]} и еще ${typingUsers.length - 2} печатают...`;
        }
    }, [typingUsers]);

    return (
        <div className="typing-indicator">
            <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <span className="typing-text">{typingText}</span>
        </div>
    );
}

