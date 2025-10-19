/**
 * @fileoverview Online status component for showing user online status
 * @description Displays online/offline status with last seen timestamp
 * @author Cursor
 * @version 1.0.0
 */

import { useAppState } from "@/pages/chat/state";

interface OnlineStatusProps {
    userId: number;
    showLastSeen?: boolean;
}

export function OnlineStatus({ userId, showLastSeen = false }: OnlineStatusProps) {
    const { chat, user } = useAppState();
    const status = userId === user.currentUser?.id ? { online: true, lastSeen: new Date().toISOString() } : chat.onlineStatuses.get(userId);

    function formatLastSeen(lastSeen: string): string {
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
    }

    return (
        <div className="online-status">
            <div className={`status-dot ${status?.online ? "online" : "offline"}`}></div>
            <span className="status-text">
                {!status ? "Загрузка..." : status?.online ? "В сети" : "Не в сети"}
            </span>
            {showLastSeen && status && !status.online && (
                <span className="last-seen">
                    {formatLastSeen(status.lastSeen)}
                </span>
            )}
        </div>
    );
}
