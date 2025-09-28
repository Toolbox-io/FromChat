import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { formatTime } from "../../utils/utils";
import type { Attachment, Message as MessageType } from "../../core/types";
// Mobile doesn't need default avatar import
import Quote from "../core/Quote";
import { parse } from "marked";
import DOMPurify from "dompurify";
import { getCurrentKeys } from "../../auth/crypto";
import { ecdhSharedSecret, deriveWrappingKey } from "../../utils/crypto/asymmetric";
import { importAesGcmKey, aesGcmDecrypt } from "../../utils/crypto/symmetric";
import { getAuthHeaders } from "../../auth/api";
import { useAppState } from "../../state";
import { ub64 } from "../../utils/utils";
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

    async function decryptFile(file: Attachment): Promise<string | null> {
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

    async function handleImageClick(file: Attachment, imageElement: HTMLImageElement) {
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

    function computeEndRect(naturalWidth: number, naturalHeight: number): Rect {
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

    function openFullscreenFromThumb(imgEl: HTMLImageElement, src: string, name: string) {
        const rect = imgEl.getBoundingClientRect();
        const startRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
        // For React Native, we'll use a simplified approach
        const endRect = { left: 0, top: 0, width: 300, height: 300 };
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

    function closeFullscreen() {
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

    async function downloadImage() {
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

    async function downloadFile(file: Attachment) {
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
                    {!isAuthor && !isDm && (
                        <View style={styles.messageProfilePic}>
                            <TouchableOpacity
                                onPress={() => !isLoadingProfile && onProfileClick(message.username)}
                                disabled={isLoadingProfile}
                            >
                                <Image
                                    source={{ uri: message.profile_picture || "https://via.placeholder.com/40x40/cccccc/ffffff?text=U" }}
                                    style={[styles.profileImage, isLoadingProfile && styles.loading]}
                                    onError={() => {
                                        // Handle image error if needed
                                    }}
                                />
                            </TouchableOpacity>
                        </View>
                    )}

                    {!isAuthor && !isDm && (
                        <div 
                            className={`message-username ${isLoadingProfile ? "loading" : ""}`}
                            onClick={() => !isLoadingProfile && onProfileClick(message.username)} 
                            style={{ cursor: isLoadingProfile ? "default" : "pointer" }}>
                            {message.username}
                        </div>
                    )}

                    {message.reply_to && (
                        <Quote className="reply-preview contextual-content" background={isAuthor ? "primaryContainer" : "surfaceContainer"}>
                            <span className="reply-username">{message.reply_to.username}</span>
                            <span className="reply-text">{message.reply_to.content}</span>
                        </Quote>
                    )}

                    <div className="message-content" dangerouslySetInnerHTML={formattedMessage} />

                    {message.files && message.files.length > 0 && (
                        <View style={styles.messageAttachments}>
                            {message.files.map((file, idx) => {
                                const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(file.name || "");
                                const isEncryptedDm = Boolean(isDm && file.encrypted);
                                const decryptedUrl = decryptedFiles.get(file.path);
                                const imageSrc = isImage ? (isEncryptedDm ? decryptedUrl : file.path) : undefined;
                                const isDownloading = downloadingPaths.has(file.path);
                                const isSending = message.runtimeData?.sendingState?.status === 'sending';

                                return (
                                    <View style={styles.attachment} key={idx}>
                                        {isImage ? (
                                            <View style={styles.imageWrapper}>
                                                <TouchableOpacity 
                                                    onPress={() => handleImageClick(file, null as any)}
                                                >
                                                    <Image 
                                                        source={{ uri: imageSrc }}
                                                        style={styles.attachmentImage}
                                                        onLoad={() => updateLoadedImages(draft => { draft.add(file.path); })}
                                                    />
                                                </TouchableOpacity>
                                                {(!loadedImages.has(file.path) || isSending) && (
                                                    <View style={styles.loadingOverlay}>
                                                        <Text>⏳</Text>
                                                    </View>
                                                )}
                                            </View>
                                        ) : (
                                            <TouchableOpacity 
                                                onPress={async () => {
                                                    await downloadFile(file);
                                                }}
                                            >
                                                <View style={styles.listItem}>
                                                    <Text style={styles.withIconGap}>
                                                        {isDownloading ? <Text>⏳</Text> : null}
                                                        {(file.name || file.path.split("/").pop() || "Имя файла неизвестно").replace(/\d+_\d+_/, "")}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    <div className="message-time">
                        {formatTime(message.timestamp)}
                        {message.is_edited ? " (edited)" : undefined}
                        
                        {isAuthor && message.is_read && (
                            <span className="material-symbols outlined"></span>
                        )}
                        
                        {isAuthor && message.runtimeData?.sendingState && (
                            <span className="message-status-indicator">
                                {message.runtimeData.sendingState.status === 'sending' && (
                                    <Text style={{ fontSize: 16 }}>⏳</Text>
                                )}
                                {message.runtimeData.sendingState.status === 'failed' && (
                                    <span className="material-symbols error-icon">error</span>
                                )}
                                {message.runtimeData.sendingState.status === 'sent' && (
                                    <span className="material-symbols success-icon">check</span>
                                )}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Fullscreen Image Viewer with shared-element like transition */}
            {fullscreenImage && (
                <div 
                    className={`fullscreen-image-overlay ${isAnimatingOpen ? "open" : "closing"}`}
                    onClick={closeFullscreen}>
                    <Image
                        source={{ uri: fullscreenImage.src }}
                        style={[
                            styles.fullscreenAnimatedImage,
                            {
                                left: isAnimatingOpen ? fullscreenImage.endRect.left : fullscreenImage.startRect.left,
                                top: isAnimatingOpen ? fullscreenImage.endRect.top : fullscreenImage.startRect.top,
                                width: isAnimatingOpen ? fullscreenImage.endRect.width : fullscreenImage.startRect.width,
                                height: isAnimatingOpen ? fullscreenImage.endRect.height : fullscreenImage.startRect.height
                            }
                        ]}
                    />
                    <View style={styles.fullscreenControls} onTouchEnd={e => e.stopPropagation()}>
                        <TouchableOpacity onPress={closeFullscreen}>
                            <Text>✕</Text>
                        </TouchableOpacity>
                        {isDownloadingFullscreen ? (
                            <View style={styles.progressWrapper}>
                                <Text>⏳</Text>
                            </View>
                        ) : (
                            <TouchableOpacity onPress={downloadImage}>
                                <Text>⬇️</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </div>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    messageAttachments: {
        marginTop: 8,
    },
    attachment: {
        marginBottom: 8,
    },
    imageWrapper: {
        position: 'relative',
    },
    attachmentImage: {
        width: 200,
        height: 200,
        borderRadius: 8,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fileContainer: {
        padding: 8,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
    },
    encryptedFilePlaceholder: {
        padding: 16,
        backgroundColor: '#fff3cd',
        borderRadius: 8,
        alignItems: 'center',
    },
    listItem: {
        padding: 12,
        backgroundColor: '#e3f2fd',
        borderRadius: 8,
    },
    withIconGap: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    fullscreenControls: {
        position: 'absolute',
        top: 20,
        right: 20,
        flexDirection: 'row',
        gap: 10,
    },
    progressWrapper: {
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 4,
    },
    messageProfilePic: {
        marginRight: 8,
    },
    profileImage: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    loading: {
        opacity: 0.5,
    },
    fullscreenAnimatedImage: {
        position: 'absolute',
    },
});
