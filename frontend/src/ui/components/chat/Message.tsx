import { formatTime } from "../../../utils/utils";
import type { Message as MessageType } from "../../../core/types";
import defaultAvatar from "../../../resources/images/default-avatar.png";
import Quote from "../core/Quote";
import { parse } from "marked";
import { useEffect, useState } from "react";

interface MessageProps {
    message: MessageType;
    isAuthor: boolean;
    onProfileClick: (username: string) => void;
    onContextMenu: (e: React.MouseEvent, message: MessageType) => void;
    isLoadingProfile?: boolean;
    isDm?: boolean;
}

export function Message({ message, isAuthor, onProfileClick, onContextMenu, isLoadingProfile = false, isDm = false }: MessageProps) {
    const [formattedMessage, setFormattedMessage] = useState({ __html: "" });

    useEffect(() => {
        (async () => {
            const DOMPurify = await import("dompurify");

            setFormattedMessage({
                __html: DOMPurify.default.sanitize(
                    await parse(message.content.trim())
                ).trim()
            });
        })();
    }, [message]);

    function handleContextMenu(e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, message);
    }

    return (
        <div 
            className={`message ${isAuthor ? "sent" : "received"}`}
            data-id={message.id}
            onContextMenu={handleContextMenu}
        >
            <div className="message-inner">
                {/* Add profile picture for received messages */}
                {!isAuthor && !isDm && (
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

                {!isAuthor && !isDm && (
                    <div 
                        className={`message-username ${isLoadingProfile ? "loading" : ""}`}
                        onClick={() => !isLoadingProfile && onProfileClick(message.username)} 
                        style={{ cursor: isLoadingProfile ? "default" : "pointer" }}>
                        {message.username}
                    </div>
                )}

                {/* Add reply preview if this is a reply */}
                {message.reply_to && (
                    <Quote className="reply-preview contextual-content" background={isAuthor ? "primaryContainer" : "surfaceContainer"}>
                        <span className="reply-username">{message.reply_to.username}</span>
                        <span className="reply-text">{message.reply_to.content}</span>
                    </Quote>
                )}

                <div className="message-content" dangerouslySetInnerHTML={formattedMessage} />

                <div className="message-time">
                    {formatTime(message.timestamp)}
                    {message.is_edited ? " (edited)" : undefined}
                    
                    {isAuthor && message.is_read && (
                        <span className="material-symbols outlined"></span>
                    )}
                </div>
            </div>
        </div>
    );
}
