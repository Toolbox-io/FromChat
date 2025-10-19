/**
 * @fileoverview Online indicator component for profile pictures
 * @description Shows a small dot at the bottom right of profile pictures to indicate online status
 * @author Cursor
 * @version 1.0.0
 */

import { useAppState } from "@/pages/chat/state";

interface OnlineIndicatorProps {
    userId: number;
    className?: string;
}

export function OnlineIndicator({ userId, className = "" }: OnlineIndicatorProps) {
    const { chat } = useAppState();
    const status = chat.onlineStatuses.get(userId);

    // Only show indicator when user is online
    if (!status || !status.online) {
        return null;
    }

    return (
        <div className={`online-indicator ${className}`}>
            <div className="indicator-dot online"></div>
        </div>
    );
}
