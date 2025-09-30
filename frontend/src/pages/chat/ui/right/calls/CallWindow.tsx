import { useState, useEffect } from "react";
import { useAppState } from "@/pages/chat/state";
import useAudioCall from "@/pages/chat/hooks/useAudioCall";
import defaultAvatar from "@/images/default-avatar.png";

export function CallWindow() {
    const { chat, toggleMute, toggleCallMinimize } = useAppState();
    const { call } = chat;
    const { acceptCall, rejectCall, remoteAudioRef, endCall } = useAudioCall();
    const [position, setPosition] = useState({ x: 100, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [callDuration, setCallDuration] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const [callData, setCallData] = useState<{
        remoteUsername: string | null;
        status: "calling" | "connecting" | "active" | "ended";
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
                                <mdui-button-icon onClick={endCall} icon="call_end" />
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
