import { formatTime } from "../../../utils/utils";
import type { Attachment, Message as MessageType } from "../../../core/types";
import defaultAvatar from "../../../resources/images/default-avatar.png";
import Quote from "../core/Quote";
import { parse } from "marked";
import DOMPurify from "dompurify";
import { useEffect, useState, useRef } from "react";
import { getCurrentKeys } from "../../../auth/crypto";
import { ecdhSharedSecret, deriveWrappingKey } from "../../../utils/crypto/asymmetric";
import { importAesGcmKey, aesGcmDecrypt } from "../../../utils/crypto/symmetric";
import { getAuthHeaders } from "../../../auth/api";
import { useAppState } from "../../state";
import { ub64 } from "../../../utils/utils";
import { useImmer } from "use-immer";

interface MessageProps {
    message: MessageType;
    isAuthor: boolean;
    onProfileClick: (username: string) => void;
    onContextMenu: (e: React.MouseEvent, message: MessageType) => void;
    isLoadingProfile?: boolean;
    isDm?: boolean;
    dmRecipientPublicKey?: string;
}

interface Rect {
    left: number; 
    top: number; 
    width: number; 
    height: number
}

export function Message({ message, isAuthor, onProfileClick, onContextMenu, isLoadingProfile = false, isDm = false, dmRecipientPublicKey }: MessageProps) {
    const [formattedMessage, setFormattedMessage] = useState({ __html: "" });
    const [decryptedFiles, updateDecryptedFiles] = useImmer<Map<string, string>>(new Map());
    const [loadedImages, updateLoadedImages] = useImmer<Set<string>>(new Set());
    const [downloadingPaths, updateDownloadingPaths] = useImmer<Set<string>>(new Set());
    const [isDownloadingFullscreen, setIsDownloadingFullscreen] = useState(false);
    const [fullscreenImage, setFullscreenImage] = useState<{
        src: string;
        name: string;
        element: HTMLImageElement;
        startRect: Rect;
        endRect: Rect;
    } | null>(null);
    const [isAnimatingOpen, setIsAnimatingOpen] = useState(false);
    const { user } = useAppState();
    const imageRefs = useRef<Map<string, HTMLImageElement>>(new Map());
    const dmEnvelope = message.runtimeData?.dmEnvelope;

    useEffect(() => {
        (async () => {
            setFormattedMessage({
                __html: DOMPurify.sanitize(
                    await parse(message.content)
                ).trim()
            });
        })();
    }, [message]);

    // Auto-decrypt images in DMs
    useEffect(() => {
        if (isDm && message.files) {
            message.files.forEach(async (file) => {
                console.log(file);
                const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(file.name || "");
                if (isImage && file.encrypted && !decryptedFiles.has(file.path)) {
                    console.log("Decrypting...");
                    const decryptedUrl = await decryptFile(file);
                    console.log(decryptedUrl);
                    if (decryptedUrl) {
                        updateDecryptedFiles(draft => {
                            draft.set(file.path, decryptedUrl);
                        });
                    }
                }
            });
        }
    }, [message.files, isDm, decryptedFiles]);

    const decryptFile = async (file: Attachment): Promise<string | null> => {
        if (!file.encrypted || !isDm || !user.authToken || !dmRecipientPublicKey || !dmEnvelope) {
            debugger;
            console.warn("Conditions not met")
            return null;
        }
        
        // Check if already decrypted
        if (decryptedFiles.has(file.path)) {
            return decryptedFiles.get(file.path) || null;
        }
        
        try {
            // no-op decrypt indicator removed from UI
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
            
            updateDecryptedFiles(draft => {
                draft.set(file.path, url);
            });
            return url;
        } catch (error) {
            console.error("Failed to decrypt file:", error);
            return null;
        } finally {
            // no-op decrypt indicator removed from UI
        }
    };

    const handleImageClick = async (file: Attachment, imageElement: HTMLImageElement) => {
        // Use decrypted URL if available, otherwise decrypt first
        const decryptedUrl = decryptedFiles.get(file.path);
        if (decryptedUrl) {
            openFullscreenFromThumb(imageElement, decryptedUrl, file.name || "image");
        } else if (file.encrypted && isDm) {
            const newDecryptedUrl = await decryptFile(file);
            if (newDecryptedUrl) {
                openFullscreenFromThumb(imageElement, newDecryptedUrl, file.name || "image");
            }
        } else {
            openFullscreenFromThumb(imageElement, file.path, file.name || "image");
        }
    };

    const computeEndRect = (naturalWidth: number, naturalHeight: number): Rect => {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const maxWidth = Math.floor(viewportWidth * 0.9);
        const maxHeight = Math.floor(viewportHeight * 0.9);
        const widthRatio = maxWidth / naturalWidth;
        const heightRatio = maxHeight / naturalHeight;
        const scale = Math.min(widthRatio, heightRatio, 1);
        const width = Math.round(naturalWidth * scale);
        const height = Math.round(naturalHeight * scale);
        const left = Math.round((viewportWidth - width) / 2);
        const top = Math.round((viewportHeight - height) / 2);
        return { left, top, width, height };
    };

    const openFullscreenFromThumb = (imgEl: HTMLImageElement, src: string, name: string) => {
        const rect = imgEl.getBoundingClientRect();
        const startRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
        const tempImg = new Image();
        tempImg.src = src;
        // Hide original while animating
        imgEl.style.visibility = "hidden";
        tempImg.onload = () => {
            const endRect = computeEndRect(tempImg.naturalWidth, tempImg.naturalHeight);
            setFullscreenImage({
                src,
                name,
                element: imgEl,
                startRect,
                endRect
            });
            // Start animation on next frame to ensure DOM has overlay mounted
            requestAnimationFrame(() => setIsAnimatingOpen(true));
        };
    };

    const closeFullscreen = () => {
        // Reverse animation
        setIsAnimatingOpen(false);
        // Wait for transition to finish
        setTimeout(() => {
            if (fullscreenImage?.element) {
                fullscreenImage.element.style.visibility = "visible";
            }
            setFullscreenImage(null);
        }, 300);
    };

    const downloadImage = async () => {
        if (!fullscreenImage) return;
        const { src, name } = fullscreenImage;
        try {
            setIsDownloadingFullscreen(true);
            if (src.startsWith("blob:")) {
                const link = document.createElement("a");
                link.href = src;
                link.download = name;
                link.click();
                setIsDownloadingFullscreen(false);
                return;
            }

            // Fetch with credentials/headers when not a blob URL
            const response = await fetch(src, {
                headers: user.authToken ? getAuthHeaders(user.authToken) : undefined,
                credentials: "include"
            });
            if (!response.ok) throw new Error("Failed to download image");
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = name;
            link.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
        } finally {
            setIsDownloadingFullscreen(false);
        }
    };

    const downloadFile = async (file: Attachment) => {
        try {
            updateDownloadingPaths(draft => {
                draft.add(file.path);
            });
            // Prefer decrypted URL if present (DM encrypted case)
            const decrypted = decryptedFiles.get(file.path);
            if (decrypted) {
                const link = document.createElement("a");
                link.href = decrypted;
                link.download = file.name || "file";
                link.click();
                updateDownloadingPaths(draft => {
                    draft.delete(file.path);
                });
                return;
            }

            // If not decrypted or public file, fetch with credentials/headers
            const response = await fetch(file.path, {
                headers: user.authToken ? getAuthHeaders(user.authToken) : undefined,
                credentials: "include"
            });
            if (!response.ok) throw new Error("Failed to download file");
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = file.name || "file";
            link.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
        } finally {
            updateDownloadingPaths(draft => {
                draft.delete(file.path);
            });
        }
    };

    function handleContextMenu(e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, message);
    }

    return (
        <>
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
                                const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(file.name || "");
                                const isEncryptedDm = Boolean(isDm && file.encrypted);
                                const decryptedUrl = decryptedFiles.get(file.path);
                                const imageSrc = isImage ? (isEncryptedDm ? decryptedUrl : file.path) : undefined;
                                const isDownloading = downloadingPaths.has(file.path);

                                return (
                                    <div className="attachment" key={idx}>
                                        {isImage ? (
                                            <div className="image-wrapper">
                                                <img 
                                                    ref={(el) => {
                                                        if (el) imageRefs.current.set(file.path, el);
                                                    }}
                                                    src={imageSrc} 
                                                    alt={file.name || "image"}
                                                    onClick={(e) => handleImageClick(file, e.currentTarget)}
                                                    onLoad={() => updateLoadedImages(draft => { draft.add(file.path); })}
                                                    className={`attachement-image ${loadedImages.has(file.path) ? "" : "loading"}`}
                                                />
                                                {!loadedImages.has(file.path) && (
                                                    <div className="loading-overlay">
                                                        <mdui-circular-progress />
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <a 
                                                href="#" 
                                                onClick={async (e) => {
                                                    e.preventDefault();
                                                    await downloadFile(file);
                                                }}
                                            >
                                                <mdui-list-item>
                                                    <span className="with-icon-gap">
                                                        {isDownloading ? <mdui-circular-progress /> : null}
                                                        {(file.name || file.path.split("/").pop() || "Имя файла неизвестно").replace(/\d+_\d+_/, "")}
                                                    </span>
                                                </mdui-list-item>
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

            {/* Fullscreen Image Viewer with shared-element like transition */}
            {fullscreenImage && (
                <div 
                    className={`fullscreen-image-overlay ${isAnimatingOpen ? "open" : "closing"}`}
                    onClick={closeFullscreen}>
                    <img
                        src={fullscreenImage.src}
                        alt={fullscreenImage.name}
                        className={`fullscreen-animated-image ${isAnimatingOpen ? "to-end" : "to-start"}`}
                        style={{
                            left: `${isAnimatingOpen ? fullscreenImage.endRect.left : fullscreenImage.startRect.left}px`,
                            top: `${isAnimatingOpen ? fullscreenImage.endRect.top : fullscreenImage.startRect.top}px`,
                            width: `${isAnimatingOpen ? fullscreenImage.endRect.width : fullscreenImage.startRect.width}px`,
                            height: `${isAnimatingOpen ? fullscreenImage.endRect.height : fullscreenImage.startRect.height}px`
                        }}
                        onClick={e => e.stopPropagation()}
                    />
                    <div className="fullscreen-controls top-right" onClick={e => e.stopPropagation()}>
                        <mdui-button-icon icon="close" onClick={closeFullscreen} />
                        {isDownloadingFullscreen ? (
                            <div className="progress-wrapper">
                                <mdui-circular-progress />
                            </div>
                        ) : (
                            <mdui-button-icon icon="download" onClick={downloadImage} />
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
