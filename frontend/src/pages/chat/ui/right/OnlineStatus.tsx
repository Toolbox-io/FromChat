/**
 * @fileoverview Online status component for showing user online status
 * @description Displays online/offline status with last seen timestamp
 * @author Cursor
 * @version 1.0.0
 */

import { useAppState } from "@/pages/chat/state";

interface OnlineStatusProps {
    userId: number;
    className?: string;
    showLastSeen?: boolean;
}

export function OnlineStatus({ userId, className = "", showLastSeen = false }: OnlineStatusProps) {
    const { chat } = useAppState();
    const status = chat.onlineStatuses.get(userId);

    if (!status) {
        return null;
    }

    const formatLastSeen = (lastSeen: string): string => {
        const date = new Date(lastSeen);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) {
            return "только что";
        } else if (diffMins < 60) {
            return `${diffMins} мин. назад`;
        } else if (diffHours < 24) {
            return `${diffHours} ч. назад`;
        } else if (diffDays < 7) {
            return `${diffDays} дн. назад`;
        } else {
            return date.toLocaleDateString();
        }
    };

    return (
        <div className={`online-status ${className}`}>
            <div className={`status-dot ${status.online ? "online" : "offline"}`}></div>
            <span className="status-text">
                {status.online ? "В сети" : "Не в сети"}
            </span>
            {showLastSeen && !status.online && (
                <span className="last-seen">
                    {formatLastSeen(status.lastSeen)}
                </span>
            )}
        </div>
    );
}
