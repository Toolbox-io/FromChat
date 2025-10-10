import { useState, useEffect } from "react";
import { useAppState, type CallStatus } from "@/pages/chat/state";
import useCall from "@/pages/chat/hooks/useCall";
import defaultAvatar from "@/images/default-avatar.png";
import { createPortal } from "react-dom";
import { id } from "@/utils/utils";

function ParticipantTile({ 
    participant, 
    isLocal = false, 
    localVideoRef, 
    globalRemoteVideoRefs,
    localMedia
}: { 
    participant: ReturnType<typeof useCall>['call']['participants'][number], 
    isLocal?: boolean,
    localVideoRef: React.RefObject<HTMLVideoElement | null>,
    globalRemoteVideoRefs: Map<number, React.RefObject<HTMLVideoElement | null>>,
    localMedia?: { isMuted: boolean }
}) {
    const videoRef = isLocal ? localVideoRef : globalRemoteVideoRefs.get(participant.userId);
    
    console.log("ParticipantTile render:", {
        isLocal,
        userId: participant.userId,
        username: participant.username,
        hasVideo: participant.hasVideo,
        videoDisplay: participant.hasVideo ? 'block' : 'none'
    });
    
    return (
        <div className="participant-tile">
            <video
                key={`video-${isLocal ? 'local' : participant.userId}`}
                ref={videoRef}
                autoPlay
                playsInline
                muted={isLocal}
                className="participant-video"
                style={{ display: participant.hasVideo ? 'block' : 'none' }}
            />
            {!participant.hasVideo && (
                <div className="participant-placeholder">
                    <img src={defaultAvatar} alt="Avatar" className="participant-avatar" />
                    <span className="participant-name">{participant.username}</span>
                </div>
            )}
            
            {/* Audio indicator */}
            <div className={`audio-indicator ${participant.hasAudio ? 'speaking' : 'muted'}`}>
                <mdui-icon name={participant.hasAudio ? "mic" : "mic_off"} />
            </div>
            
            {/* Mute indicator for local participant */}
            {isLocal && localMedia?.isMuted && (
                <div className="mute-indicator">
                    <mdui-icon name="mic_off" />
                </div>
            )}
        </div>
    );
}

export function CallWindow() {
    const { chat, toggleCallMinimize } = useAppState();
    const { call } = chat;
    const { 
        acceptCall, 
        rejectCall, 
        remoteAudioRef, 
        endCall, 
        toggleMute, 
        toggleVideo, 
        toggleScreenshare,
        localVideoRef,
        localScreenshareRef,
        globalRemoteVideoRefs
    } = useCall();
    const [position, setPosition] = useState({ x: 100, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [callDuration, setCallDuration] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const [callData, setCallData] = useState<{
        participants: typeof call.participants;
        status: CallStatus;
        localMedia: typeof call.localMedia;
        permissionErrors: typeof call.permissionErrors;
    } | null>(null);

    const status = callData?.status || call.status;
    const participants = callData?.participants || call.participants;
    const localMedia = callData?.localMedia || call.localMedia;
    const permissionErrors = callData?.permissionErrors || call.permissionErrors;

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
                participants: call.participants,
                status: call.status,
                localMedia: call.localMedia,
                permissionErrors: call.permissionErrors
            });
        }
    }, [call.isActive, call.participants, call.status, call.localMedia, call.permissionErrors]);

    // Handle visibility animation with entrance and exit delays
    useEffect(() => {
        if (call.isActive) {
            setShouldRender(true);
            if (!call.isMinimized) {
                // Call is active and not minimized - show window with entrance animation
                if (!isVisible) {
                    // Only animate in if not already visible (prevents animation on rapid calls)
                    requestAnimationFrame(() => {
                        setIsVisible(true);
                    });
                }
            } else {
                // Call is active but minimized - hide window but keep rendered
                setIsVisible(false);
            }
        } else {
            if (shouldRender) {
                // Call ended - start exit animation
                setIsVisible(false);
                // After animation completes, stop rendering
                const timer = setTimeout(() => {
                    setShouldRender(false);
                    setCallData(null);
                }, 300); // Match the CSS transition duration
                return () => clearTimeout(timer);
            } else {
                // Call not active and not rendered - ensure clean state
                setShouldRender(false);
                setIsVisible(false);
                setCallData(null);
            }
        }
    }, [call.isActive, call.isMinimized, shouldRender, isVisible]);

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


    // ParticipantTile component
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
                        className={`call-window ${isDragging ? 'dragging' : ''} ${getGradientClass()} ${isVisible ? 'visible' : 'hidden'}`}
                        style={{
                            left: position.x,
                            top: position.y
                        }}
                        onMouseDown={(e) => {
                            setIsDragging(true);
                            setDragStart({
                                x: e.clientX - position.x,
                                y: e.clientY - position.y
                            });
                        }}
                        onMouseMove={(e) => {
                            if (isDragging) {
                                setPosition({
                                    x: e.clientX - dragStart.x,
                                    y: e.clientY - dragStart.y
                                });
                            }
                        }}
                        onMouseUp={() => setIsDragging(false)}
                        onMouseLeave={() => setIsDragging(false)}
                    >
                        <div className="call-header">
                            <div className="window-controls">
                                <mdui-button-icon 
                                    onClick={toggleCallMinimize} 
                                    icon="minimize" 
                                    className="minimize-btn" 
                                />
                            </div>
                            
                            <div className="call-info">
                                <h3 className="call-title">
                                    {participants.length > 0 ? participants[0].username : "Call"}
                                </h3>
                                <p className="status">
                                    {getStatusText()}
                                </p>
                                {call.encryptionEmojis.length > 0 && (
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

                        <div className="call-content">
                            {/* Permission error messages */}
                            {permissionErrors.video && (
                                <div className="permission-error">
                                    <mdui-icon name="videocam_off" />
                                    <span>Video permission denied</span>
                                </div>
                            )}
                            {permissionErrors.screenshare && (
                                <div className="permission-error">
                                    <mdui-icon name="screen_share" />
                                    <span>Screenshare permission denied</span>
                                </div>
                            )}

                            {/* Screenshare tile (if active) */}
                            {localMedia.hasScreenshare && (
                                <div className="screenshare-tile">
                                    <video
                                        ref={localScreenshareRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="screenshare-video"
                                    />
                                    <div className="screenshare-label">
                                        <mdui-icon name="screen_share" />
                                        <span>You are sharing your screen</span>
                                    </div>
                                </div>
                            )}

                            {/* Participant grid */}
                            <div className="participants-grid">
                                {/* Local participant tile */}
                                <ParticipantTile 
                                    participant={{
                                        userId: 0,
                                        username: "You",
                                        hasAudio: localMedia.hasAudio,
                                        hasVideo: localMedia.hasVideo,
                                        hasScreenshare: localMedia.hasScreenshare
                                    }}
                                    isLocal={true}
                                    localVideoRef={localVideoRef}
                                    globalRemoteVideoRefs={globalRemoteVideoRefs}
                                    localMedia={localMedia}
                                />

                                {/* Remote participant tiles */}
                                {participants.map(participant => (
                                    <ParticipantTile 
                                        key={participant.userId}
                                        participant={participant}
                                        isLocal={false}
                                        localVideoRef={localVideoRef}
                                        globalRemoteVideoRefs={globalRemoteVideoRefs}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="call-controls">
                            {status === "calling" && participants.length > 0 ? (
                                <>
                                    <mdui-button-icon onClick={acceptCall} icon="call" />
                                    <mdui-button-icon onClick={rejectCall} icon="call_end" />
                                </>
                            ) : (
                                <>
                                    <mdui-button-icon 
                                        onClick={toggleMute} 
                                        icon={localMedia.isMuted ? "mic_off" : "mic"} 
                                    />
                                    <mdui-button-icon 
                                        onClick={toggleVideo} 
                                        icon={localMedia.hasVideo ? "videocam" : "videocam_off"}
                                        className={localMedia.hasVideo ? "active" : ""}
                                    />
                                    <mdui-button-icon 
                                        onClick={toggleScreenshare} 
                                        icon={localMedia.hasScreenshare ? "stop_screen_share" : "screen_share"}
                                        className={localMedia.hasScreenshare ? "active" : ""}
                                    />
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
