import { useState, useEffect, useRef } from "react";
import { useAppState, type CallStatus } from "../../state";
import { useAudioCall } from "../../hooks/useAudioCall";
import * as WebRTC from "../../../utils/webrtc";
import defaultAvatar from "../../../resources/images/default-avatar.png";
import { createPortal } from "react-dom";
import { id } from "../../../utils/utils";

export function CallWindow() {
    const { chat, toggleCallMinimize } = useAppState();
    const { call } = chat;
    const { acceptCall, rejectCall, remoteAudioRef, endCall, toggleMute, toggleVideo, toggleScreenShare } = useAudioCall();
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const [position, setPosition] = useState({ x: 100, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [callDuration, setCallDuration] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
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

    // Handle remote video stream with proper stream management
    useEffect(() => {
        if (call.isActive && call.remoteUserId) {
            console.log("Setting up video stream handler for user", call.remoteUserId);
            
            // Set up video stream handler
            const handleRemoteVideoStream = (userId: number, stream: MediaStream) => {
                console.log("🎥 Video stream handler called for user", userId, "stream:", stream);
                console.log("🎥 Expected user:", call.remoteUserId);
                console.log("🎥 Video ref available:", !!remoteVideoRef.current);
                
                if (userId === call.remoteUserId && remoteVideoRef.current) {
                    // Get the current call to check what streams are active
                    const currentCall = WebRTC.getCall(call.remoteUserId);
                    if (currentCall) {
                        let streamToDisplay: MediaStream | null = null;
                        
                        // Prioritize screen share over video for display
                        if (call.isScreenSharing && currentCall.remoteScreenStream) {
                            streamToDisplay = currentCall.remoteScreenStream;
                            console.log("🖥️ Displaying remote screen share stream");
                        } else if (call.isVideoEnabled && currentCall.remoteVideoStream) {
                            streamToDisplay = currentCall.remoteVideoStream;
                            console.log("🎥 Displaying remote video stream");
                        } else {
                            // No active streams - clear the video element
                            console.log("🎥 No active streams - clearing video element");
                            if (remoteVideoRef.current) {
                                remoteVideoRef.current.pause();
                                remoteVideoRef.current.srcObject = null;
                                remoteVideoRef.current.load();
                            }
                            return; // Exit early, don't try to play
                        }
                        
                        if (streamToDisplay && remoteVideoRef.current) {
                            console.log("🎥 Attaching video stream to element");
                            // Prevent multiple simultaneous play requests
                            remoteVideoRef.current.pause();
                            remoteVideoRef.current.srcObject = streamToDisplay;
                            
                            // Use a small delay to prevent AbortError
                            setTimeout(() => {
                                if (remoteVideoRef.current) {
                                    remoteVideoRef.current.play().then(() => {
                                        console.log("🎥 Video started playing successfully");
                                    }).catch((error) => {
                                        console.warn("🎥 Failed to play video:", error);
                                    });
                                }
                            }, 100);
                        }
                    }
                }
            };

            // Register the handler
            WebRTC.setRemoteVideoStreamHandler(handleRemoteVideoStream);

            return () => {
                console.log("🎥 Cleaning up video stream handler");
                // Cleanup
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = null;
                }
            };
        }
    }, [call.isActive, call.remoteUserId, call.isVideoEnabled, call.isScreenSharing]);

    // Clear remote video when streams are disabled
    useEffect(() => {
        if (remoteVideoRef.current) {
            if (!call.isVideoEnabled && !call.isScreenSharing) {
                console.log("🎥 Clearing remote video - no video/screen share active");
                // Pause first to stop any ongoing play requests
                remoteVideoRef.current.pause();
                remoteVideoRef.current.srcObject = null;
                remoteVideoRef.current.load(); // Force reload to clear any frozen frames
            } else if (!call.isVideoEnabled && call.isScreenSharing) {
                // Only video is disabled, but screen share is active - clear video stream
                console.log("🎥 Clearing remote video stream (screen share still active)");
                const currentCall = WebRTC.getCall(call.remoteUserId || 0);
                if (currentCall && currentCall.remoteVideoStream) {
                    // Check if current srcObject is the video stream
                    if (remoteVideoRef.current.srcObject === currentCall.remoteVideoStream) {
                        remoteVideoRef.current.pause();
                        remoteVideoRef.current.srcObject = null;
                        remoteVideoRef.current.load();
                    }
                }
            } else if (call.isVideoEnabled && !call.isScreenSharing) {
                // Only screen share is disabled, but video is active - clear screen share stream
                console.log("🎥 Clearing remote screen share stream (video still active)");
                const currentCall = WebRTC.getCall(call.remoteUserId || 0);
                if (currentCall && currentCall.remoteScreenStream) {
                    // Check if current srcObject is the screen share stream
                    if (remoteVideoRef.current.srcObject === currentCall.remoteScreenStream) {
                        remoteVideoRef.current.pause();
                        remoteVideoRef.current.srcObject = null;
                        remoteVideoRef.current.load();
                    }
                }
            }
        }
    }, [call.isVideoEnabled, call.isScreenSharing, call.remoteUserId]);

    // Clear local video preview when no streams are active
    useEffect(() => {
        if (!call.isVideoEnabled && !call.isScreenSharing && localVideoRef.current) {
            console.log("🎥 Clearing local video preview");
            // Pause first to stop any ongoing play requests
            localVideoRef.current.pause();
            localVideoRef.current.srcObject = null;
            localVideoRef.current.load(); // Force reload to clear any frozen frames
        }
    }, [call.isVideoEnabled, call.isScreenSharing]);

    // Handle local video stream for preview - prioritize screen share over video
    useEffect(() => {
        if (localVideoRef.current && (call.isVideoEnabled || call.isScreenSharing)) {
            console.log("🎥 Setting up local video preview");
            
            // Get the current call to access local streams
            const currentCall = WebRTC.getCall(call.remoteUserId || 0);
            if (currentCall) {
                let localStream: MediaStream | null = null;
                
                // Prioritize screen share over video for preview
                if (call.isScreenSharing && currentCall.localScreenStream) {
                    localStream = currentCall.localScreenStream;
                    console.log("🖥️ Using local screen stream for preview");
                } else if (call.isVideoEnabled && currentCall.localVideoStream) {
                    localStream = currentCall.localVideoStream;
                    console.log("🎥 Using local video stream for preview");
                }
                
                if (localStream && localVideoRef.current) {
                    localVideoRef.current.srcObject = localStream;
                    localVideoRef.current.play().catch((error) => {
                        console.warn("🎥 Failed to play local video preview:", error);
                    });
                }
            }
        } else if (localVideoRef.current) {
            // Clear local preview when no streams are active
            localVideoRef.current.pause();
            localVideoRef.current.srcObject = null;
            localVideoRef.current.load();
        }
        
        return () => {
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = null;
            }
        };
    }, [call.isVideoEnabled, call.isScreenSharing, call.remoteUserId]);

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
                
                <video
                    ref={remoteVideoRef}
                    className="remote-video"
                    autoPlay
                    playsInline
                    muted={false} />
                
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
                            
                            <div className="user-info-centered">
                                <img
                                    src={defaultAvatar}
                                    alt="Avatar"
                                    className="avatar" />
                                
                            <div className="user-details">
                                <h3 className="username">
                                    {remoteUsername}
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
                        </div>

                        {/* Video display area */}
                        <div className="video-container">
                            <video
                                ref={remoteVideoRef}
                                className="remote-video-display"
                                autoPlay
                                playsInline
                                muted={false}
                                style={{
                                    border: call.isVideoEnabled || call.isScreenSharing ? '2px solid green' : '2px solid red'
                                }}
                            />
                            
                            {/* Local video preview (small, bottom-right corner) */}
                            {(call.isVideoEnabled || call.isScreenSharing) && (
                                <video
                                    ref={localVideoRef}
                                    className="local-video-preview"
                                    autoPlay
                                    playsInline
                                    muted={true}
                                    style={{
                                        position: 'absolute',
                                        bottom: '8px',
                                        right: '8px',
                                        width: '120px',
                                        height: '90px',
                                        borderRadius: '8px',
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        objectFit: 'cover'
                                    }}
                                />
                            )}
                            
                            {/* Status indicators */}
                            {call.isVideoEnabled && (
                                <div style={{
                                    position: 'absolute',
                                    top: '8px',
                                    left: '8px',
                                    background: 'rgba(76, 175, 80, 0.8)',
                                    color: 'white',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                }}>
                                    📹 VIDEO
                                </div>
                            )}
                            
                            {call.isScreenSharing && (
                                <div style={{
                                    position: 'absolute',
                                    top: '8px',
                                    right: '8px',
                                    background: 'rgba(33, 150, 243, 0.8)',
                                    color: 'white',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                }}>
                                    🖥️ SCREEN
                                </div>
                            )}
                        </div>

                        <div className="call-controls">
                            {status === "calling" && !isInitiator ? (
                                <>
                                    <mdui-button-icon onClick={acceptCall} icon="call" />
                                    <mdui-button-icon onClick={rejectCall} icon="call_end" />
                                </>
                            ) : (
                                <>
                                    <mdui-button-icon 
                                        onClick={toggleMute} 
                                        icon={isMuted ? "mic_off" : "mic"} 
                                        className={isMuted ? "control-btn muted" : "control-btn"}
                                    />
                                    <mdui-button-icon 
                                        onClick={toggleVideo} 
                                        icon={call.isVideoEnabled ? "videocam" : "videocam_off"}
                                        className={call.isVideoEnabled ? "control-btn active" : "control-btn"}
                                        title={call.isVideoEnabled ? "Disable video" : "Enable video"}
                                    />
                                    <mdui-button-icon 
                                        onClick={toggleScreenShare} 
                                        icon={call.isScreenSharing ? "stop_screen_share" : "screen_share"}
                                        className={call.isScreenSharing ? "control-btn active" : "control-btn"}
                                        title={call.isScreenSharing ? "Stop screen sharing" : "Start screen sharing"}
                                    />
                                    <mdui-button-icon 
                                        onClick={endCall} 
                                        icon="call_end" 
                                        className="control-btn end-call"
                                    />
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
