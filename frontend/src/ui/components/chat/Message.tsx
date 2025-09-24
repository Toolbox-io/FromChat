import { formatTime } from "../../../utils/utils";
import type { Message as MessageType } from "../../../core/types";
import defaultAvatar from "../../../resources/images/default-avatar.png";
import Quote from "../core/Quote";
import { parse } from "marked";
import DOMPurify from "dompurify";
import { useEffect, useState } from "react";
import { getCurrentKeys } from "../../../auth/crypto";
import { ecdhSharedSecret, deriveWrappingKey } from "../../../utils/crypto/asymmetric";
import { importAesGcmKey, aesGcmDecrypt } from "../../../utils/crypto/symmetric";
import { getAuthHeaders } from "../../../auth/api";
import { useAppState } from "../../state";
import { ub64 } from "../../../utils/utils";

interface MessageProps {
    message: MessageType;
    isAuthor: boolean;
    onProfileClick: (username: string) => void;
    onContextMenu: (e: React.MouseEvent, message: MessageType) => void;
    isLoadingProfile?: boolean;
    isDm?: boolean;
    dmRecipientPublicKey?: string;
    dmEnvelope?: {
        salt: string;
        iv2: string;
        wrappedMk: string;
    };
}

export function Message({ message, isAuthor, onProfileClick, onContextMenu, isLoadingProfile = false, isDm = false, dmRecipientPublicKey, dmEnvelope }: MessageProps) {
    const [formattedMessage, setFormattedMessage] = useState({ __html: "" });
    const [decryptedFiles, setDecryptedFiles] = useState<Map<string, string>>(new Map());
    const { user } = useAppState();

    useEffect(() => {
        (async () => {
            setFormattedMessage({
                __html: DOMPurify.sanitize(
                    await parse(message.content)
                ).trim()
            });
        })();
    }, [message]);

    const decryptFile = async (file: any): Promise<string | null> => {
        if (!file.encrypted || !isDm || !user.authToken || !dmRecipientPublicKey || !dmEnvelope) return null;
        
        // Check if already decrypted
        if (decryptedFiles.has(file.path)) {
            return decryptedFiles.get(file.path) || null;
        }
        
        try {
            // Fetch encrypted file
            const response = await fetch(file.path, {
                headers: getAuthHeaders(user.authToken!)
            });
            if (!response.ok) throw new Error("Failed to fetch file");
            
            const encryptedData = await response.arrayBuffer();
            
            // Get current user's keys
            const keys = getCurrentKeys();
            if (!keys) throw new Error("Keys not initialized");
            
            // Derive shared secret with the recipient's public key
            const shared = await ecdhSharedSecret(keys.privateKey, ub64(dmRecipientPublicKey));
            
            // Derive wrapping key using the salt from the DM envelope
            const wkRaw = await deriveWrappingKey(shared, ub64(dmEnvelope.salt), new Uint8Array([1]));
            const wk = await importAesGcmKey(wkRaw);
            
            // Unwrap the message key
            const mk = await aesGcmDecrypt(wk, ub64(dmEnvelope.iv2), ub64(dmEnvelope.wrappedMk));
            
            // Decrypt the file using the message key
            const iv = new Uint8Array(encryptedData, 0, 12);
            const ciphertext = new Uint8Array(encryptedData, 12);
            const decrypted = await aesGcmDecrypt(await importAesGcmKey(mk), iv, ciphertext);
            
            // Create blob URL for download
            const blob = new Blob([decrypted.buffer as ArrayBuffer]);
            const url = URL.createObjectURL(blob);
            
            setDecryptedFiles(prev => new Map(prev).set(file.path, url));
            return url;
        } catch (error) {
            console.error("Failed to decrypt file:", error);
            return null;
        }
    };

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

                {message.files && message.files.length > 0 && (
                    <mdui-list className="message-attachments">
                        {message.files.map((file, idx) => {
                            const isImage = !file.encrypted && (file.content_type?.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp)$/i.test(file.filename || ""));
                            const downloadUrl = decryptedFiles.get(file.path) || file.path;
                            return (
                                <div className="attachment" key={idx}>
                                    {isImage ? (
                                        <img src={file.path} alt={file.filename || "image"} style={{ maxWidth: "200px", borderRadius: "8px" }} />
                                    ) : (
                                        <a 
                                            href={downloadUrl} 
                                            download={file.filename || "file"} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            onClick={async (e) => {
                                                if (file.encrypted && !decryptedFiles.has(file.path)) {
                                                    e.preventDefault();
                                                    const decryptedUrl = await decryptFile(file);
                                                    if (decryptedUrl) {
                                                        const link = document.createElement('a');
                                                        link.href = decryptedUrl;
                                                        link.download = file.filename || "file";
                                                        link.click();
                                                    }
                                                }
                                            }}
                                        >
                                            <mdui-list-item icon="download--filled">{(file.filename || file.path.split("/").pop() || "Имя файла неизвестно").replace(/\d+_\d+_/, "")}</mdui-list-item>
                                        </a>
                                    )}
                                </div>
                            );
                        })}
                    </mdui-list>
                )}

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
