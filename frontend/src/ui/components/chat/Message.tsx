import { formatTime } from "../../../utils/utils";
import type { Message as MessageType } from "../../../core/types";
import defaultAvatar from "../../../resources/images/default-avatar.png";

interface MessageProps {
    message: MessageType;
    isAuthor: boolean;
    onProfileClick: (username: string) => void;
    onContextMenu: (e: React.MouseEvent, message: MessageType) => void;
    isLoadingProfile?: boolean;
}

export function Message({ message, isAuthor, onProfileClick, onContextMenu, isLoadingProfile = false }: MessageProps) {
    return (
        <div 
            className={`message ${isAuthor ? "sent" : "received"}`}
            data-id={message.id}
            onContextMenu={(e) => onContextMenu(e, message)}
        >
            <div className="message-inner">
                {/* Add profile picture for received messages */}
                {!isAuthor && (
                    <div className="message-profile-pic">
                        <img
                            src={message.profile_picture || defaultAvatar}
                            alt={message.username}
                            onClick={() => !isLoadingProfile && onProfileClick(message.username)}
                            style={{ cursor: isLoadingProfile ? "default" : "pointer" }}
                            className={isLoadingProfile ? "loading" : ""}
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = defaultAvatar;
                            }}
                        />
                    </div>
                )}

                {!isAuthor && (
                    <div 
                        className={`message-username ${isLoadingProfile ? "loading" : ""}`}
                        onClick={() => !isLoadingProfile && onProfileClick(message.username)} 
                        style={{ cursor: isLoadingProfile ? "default" : "pointer" }}> {/* TODO extract to SCSS */}
                        {message.username}
                    </div>
                )}

                {/* Add reply preview if this is a reply */}
                {message.reply_to && (
                    <div className="message-reply">
                        <div className="reply-content">
                            <span className="reply-username">{message.reply_to.username}</span>
                            <span className="reply-text">{message.reply_to.content}</span>
                        </div>
                    </div>
                )}

                <div className="message-content">
                    {message.content}
                </div>

                <div className="message-time">
                    {formatTime(message.timestamp)}
                    {message.is_edited ? " (edited)" : undefined}
                    
                    {isAuthor && message.is_read ? (
                        <span className="material-symbols outlined"></span>
                    ) : undefined}
                </div>
            </div>
        </div>
    );
}
