import { useState, useEffect } from "react";
import { useAppState, type CallStatus } from "@/pages/chat/state";
import useCall from "@/pages/chat/hooks/useCall";
import defaultAvatar from "@/images/default-avatar.png";
import { createPortal } from "react-dom";
import { id } from "@/utils/utils";

export function CallWindow() {
    const { chat, toggleCallMinimize, user } = useAppState();
    const { call } = chat;
    const {
        acceptCall,
        rejectCall,
        remoteAudioRef,
        endCall,
        toggleMute,
        toggleVideo,
        toggleScreenShare,
        localVideoRef,
        remoteVideoRef,
        localScreenShareRef,
        remoteScreenShareRef
    } = useCall();
    const [pipPosition, setPipPosition] = useState({ x: window.innerWidth - 420, y: window.innerHeight - 320 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [callDuration, setCallDuration] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const [wasMinimized, setWasMinimized] = useState(false);
    const [callData, setCallData] = useState<{
        remoteUsername: string | null;
        status: CallStatus;
        isInitiator: boolean;
        isMuted: boolean;
    } | null>(null);

    const status = callData?.status || call.status;
    const remoteUsername = callData?.remoteUsername || call.remoteUsername;
    const isInitiator = callData?.isInitiator || call.isInitiator;
    const isMuted = callData?.isMuted || call.isMuted;

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (call.status === "active" && call.startTime) {
            interval = setInterval(() => {
                setCallDuration(Math.floor((Date.now() - call.startTime!) / 1000));
            }, 1000);
        } else {
            setCallDuration(0);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [call.status, call.startTime]);

    // Preserve call data during exit animation
    useEffect(() => {
        if (call.isActive) {
            setCallData({
                remoteUsername: call.remoteUsername,
                status: call.status,
                isInitiator: call.isInitiator,
                isMuted: call.isMuted
            });
        }
    }, [call.isActive, call.remoteUsername, call.status, call.isInitiator, call.isMuted]);

    // Track minimized state for exit animation
    useEffect(() => {
        if (call.isActive) {
            setWasMinimized(call.isMinimized);
        }
    }, [call.isActive, call.isMinimized]);

    // Handle visibility animation with entrance and exit delays
    useEffect(() => {
        if (call.isActive) {
            setShouldRender(true);
            // Small delay to ensure DOM is ready, then trigger animation
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsVisible(true);
                });
            });
        } else {
            if (shouldRender) {
                // Call ended - start exit animation
                setIsVisible(false);
                // After animation completes, stop rendering
                const timer = setTimeout(() => {
                    setShouldRender(false);
                    setCallData(null);
                    setWasMinimized(false);
                }, 400); // Match the CSS transition duration
                return () => clearTimeout(timer);
            } else {
                // Call not active and not rendered - ensure clean state
                setShouldRender(false);
                setIsVisible(false);
                setCallData(null);
                setWasMinimized(false);
            }
        }
    }, [call.isActive, shouldRender, wasMinimized]);

    // Handle dragging for PiP mode
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging && call.isMinimized) {
                setPipPosition({
                    x: e.clientX - dragOffset.x,
                    y: e.clientY - dragOffset.y
                });
            }
        };

        const handleMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
            }
        };

        if (isDragging) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
        }

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging, call.isMinimized, dragOffset]);

    // Cleanup effect to reset state when component unmounts
    useEffect(() => {
        return () => {
            setIsVisible(false);
            setShouldRender(false);
            setCallData(null);
        };
    }, []);

    function formatDuration(seconds: number) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function getStatusText() {
        switch (status) {
            case "calling":
                return "Calling...";
            case "connecting":
                return "Connecting...";
            case "active":
                return formatDuration(callDuration);
            default:
                return "";
        }
    }

    function getGradientClass() {
        switch (status) {
            case "calling":
                return "gradient-calling";
            case "connecting":
                return "gradient-connecting";
            case "active":
                return "gradient-active";
            default:
                return "gradient-default";
        }
    }


    return (
        createPortal(
            <>
                <audio
                    ref={remoteAudioRef}
                    className="remote-audio"
                    autoPlay
                    playsInline
                    controls />

                {shouldRender && (
                    <div
                        className={`call-window ${(call.isActive ? call.isMinimized : wasMinimized) ? "minimized" : "maximized"} ${isDragging ? "dragging" : ""} ${getGradientClass()} ${isVisible ? "visible" : "hidden"}`}
                        style={(call.isActive ? call.isMinimized : wasMinimized) ? {
                            left: pipPosition.x,
                            top: pipPosition.y
                        } : undefined}
                        onMouseDown={(e) => {
                            if (call.isMinimized) {
                                // Only start dragging if not clicking on a button
                                const target = e.target as HTMLElement;
                                if (!target.closest("mdui-button-icon")) {
                                    setIsDragging(true);
                                    setDragOffset({
                                        x: e.clientX - pipPosition.x,
                                        y: e.clientY - pipPosition.y
                                    });
                                }
                            }
                        }}
                    >
                        <div className="call-header">
                            <div className="window-controls">
                                <mdui-button-icon
                                    onClick={toggleCallMinimize}
                                    icon={call.isMinimized ? "open_in_full" : "close_fullscreen"}
                                    className="window-control-btn"
                                />
                            </div>

                            <div className="call-header-info">
                                <h3 className="username">{remoteUsername}</h3>
                                <p className="status">{getStatusText()}</p>
                                {!call.isMinimized && call.encryptionEmojis.length > 0 && (
                                    <div className="encryption-emojis">
                                        {call.encryptionEmojis.map((emoji, index) => (
                                            <span key={index} className="encryption-emoji">
                                                {emoji}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={`call-content ${(call.isSharingScreen || call.isRemoteScreenSharing) ? "with-screen-share" : ""}`}>
                            {/* Main screen share area - takes most space when active */}
                            <div className="screen-share-area">
                                {/* Local screen share */}
                                <div
                                    className="video-tile screen-share-tile local-screen-share"
                                    style={{ display: call.isSharingScreen ? "flex" : "none" }}>
                                    <video
                                        ref={localScreenShareRef}
                                        className="video-element screen-share-video"
                                        autoPlay
                                        playsInline
                                        muted />
                                    <div className="tile-label">Your Screen</div>
                                </div>

                                {/* Remote screen share */}
                                <div
                                    className="video-tile screen-share-tile remote-screen-share"
                                    style={{ display: call.isRemoteScreenSharing ? "flex" : "none" }}>
                                    <video
                                        ref={remoteScreenShareRef}
                                        className="video-element screen-share-video"
                                        autoPlay
                                        playsInline />
                                    <div className="tile-label">{remoteUsername}&apos;s Screen</div>
                                </div>
                            </div>

                            {/* Video tiles sidebar - appears on right when screen share is active */}
                            <div className="video-tiles-sidebar">
                                {/* Local video tile */}
                                <div className="video-tile local-video">
                                    <video
                                        ref={localVideoRef}
                                        className="video-element"
                                        autoPlay
                                        playsInline
                                        muted
                                        style={{ display: call.isVideoEnabled ? "block" : "none" }} />
                                    {!call.isVideoEnabled && (
                                        <div className="video-placeholder">
                                            <img src={defaultAvatar} alt="Avatar" className="placeholder-avatar" />
                                            <span className="placeholder-username">{user.currentUser?.username || "You"}</span>
                                        </div>
                                    )}
                                    <div className="tile-label">You</div>
                                </div>

                                {/* Remote video tile */}
                                <div className="video-tile remote-video">
                                    <video
                                        ref={remoteVideoRef}
                                        className="video-element"
                                        autoPlay
                                        playsInline
                                        style={{ display: call.isRemoteVideoEnabled ? "block" : "none" }} />
                                    {!call.isRemoteVideoEnabled && (
                                        <div className="video-placeholder">
                                            <img src={defaultAvatar} alt="Avatar" className="placeholder-avatar" />
                                            <span className="placeholder-username">{remoteUsername}</span>
                                        </div>
                                    )}
                                    <div className="tile-label">{remoteUsername}</div>
                                </div>
                            </div>
                        </div>

                        <div className="call-controls">
                            {status === "calling" && !isInitiator ? (
                                <>
                                    <mdui-button-icon onClick={acceptCall} icon="call" />
                                    <mdui-button-icon onClick={rejectCall} icon="call_end" />
                                </>
                            ) : (
                                <>
                                    <mdui-button-icon onClick={toggleMute} icon={isMuted ? "mic_off" : "mic"} />
                                    <mdui-button-icon onClick={toggleVideo} icon={call.isVideoEnabled ? "videocam" : "videocam_off"} />
                                    <mdui-button-icon onClick={toggleScreenShare} icon={call.isSharingScreen ? "stop_screen_share" : "screen_share"} />
                                    <mdui-button-icon onClick={endCall} icon="call_end" />
                                </>
                            )}
                        </div>
                    </div>
                )}
            </>,
            id("root")
        )
    );
}