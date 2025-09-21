import { useState, useEffect, useRef } from "react";
import { useAppState } from "@/pages/chat/state";
import useAudioCall from "@/pages/chat/hooks/useAudioCall";
import defaultAvatar from "@/images/default-avatar.png";

export function CallWindow() {
    const { chat, endCall, toggleMute } = useAppState();
    const { acceptCall, rejectCall, remoteAudioRef } = useAudioCall();
    const [position, setPosition] = useState({ x: 100, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const windowRef = useRef<HTMLDivElement>(null);
    const [callDuration, setCallDuration] = useState(0);

    const { call } = chat;

    // Update call duration timer
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

    // Handle drag functionality
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.target === windowRef.current || (e.target as HTMLElement).closest('.call-header')) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y
            });
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStart]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getStatusText = () => {
        switch (call.status) {
            case "calling":
                return "Calling...";
            case "connecting":
                return "Connecting...";
            case "active":
                return formatDuration(callDuration);
            default:
                return "";
        }
    };

    const handleAcceptCall = () => {
        acceptCall();
    };

    const handleRejectCall = () => {
        rejectCall();
    };

    return (
        <>
            {/* Always render audio element so remoteAudioRef is available */}
            <audio
                ref={remoteAudioRef}
                autoPlay
                playsInline
                controls
                style={{ 
                    position: "fixed", 
                    bottom: 8, 
                    right: 8, 
                    width: "200px", 
                    height: "40px", 
                    opacity: 0.8,
                    zIndex: 1001
                }}
            />
            
            {/* Only show call window when call is active */}
            {call.isActive && (
                <div
                    ref={windowRef}
                    className="call-window"
                    style={{
                        position: "fixed",
                        left: position.x,
                        top: position.y,
                        zIndex: 1000,
                        width: "300px",
                        backgroundColor: "var(--mdui-color-surface)",
                        border: "1px solid var(--mdui-color-outline)",
                        borderRadius: "12px",
                        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                        cursor: isDragging ? "grabbing" : "grab"
                    }}
                    onMouseDown={handleMouseDown}
                >
                    <div className="call-header" style={{
                        padding: "16px",
                        borderBottom: "1px solid var(--mdui-color-outline-variant)",
                        cursor: "grab"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <img
                                src={defaultAvatar}
                                alt="Avatar"
                                style={{
                                    width: "48px",
                                    height: "48px",
                                    borderRadius: "50%",
                                    objectFit: "cover"
                                }}
                            />
                            <div style={{ flex: 1 }}>
                                <h3 style={{
                                    margin: 0,
                                    fontSize: "16px",
                                    fontWeight: "500",
                                    color: "var(--mdui-color-on-surface)"
                                }}>
                                    {call.remoteUsername}
                                </h3>
                                <p style={{
                                    margin: "4px 0 0 0",
                                    fontSize: "14px",
                                    color: "var(--mdui-color-on-surface-variant)"
                                }}>
                                    {getStatusText()}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div style={{
                        padding: "16px",
                        display: "flex",
                        justifyContent: "center",
                        gap: "12px"
                    }}>
                        {call.status === "calling" && !call.isInitiator ? (
                            // Incoming call - show accept/reject buttons
                            <>
                                <button
                                    onClick={handleAcceptCall}
                                    style={{
                                        width: "48px",
                                        height: "48px",
                                        borderRadius: "50%",
                                        border: "none",
                                        backgroundColor: "var(--mdui-color-primary)",
                                        color: "var(--mdui-color-on-primary)",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "20px"
                                    }}
                                    title="Accept Call"
                                >
                                    <span className="material-symbols">call</span>
                                </button>

                                <button
                                    onClick={handleRejectCall}
                                    style={{
                                        width: "48px",
                                        height: "48px",
                                        borderRadius: "50%",
                                        border: "none",
                                        backgroundColor: "var(--mdui-color-error)",
                                        color: "var(--mdui-color-on-error)",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "20px"
                                    }}
                                    title="Reject Call"
                                >
                                    <span className="material-symbols">call_end</span>
                                </button>
                            </>
                        ) : (
                            // Active call - show mute and end call buttons
                            <>
                                <button
                                    onClick={toggleMute}
                                    style={{
                                        width: "48px",
                                        height: "48px",
                                        borderRadius: "50%",
                                        border: "none",
                                        backgroundColor: call.isMuted 
                                            ? "var(--mdui-color-error)" 
                                            : "var(--mdui-color-surface-variant)",
                                        color: call.isMuted 
                                            ? "var(--mdui-color-on-error)" 
                                            : "var(--mdui-color-on-surface-variant)",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "20px"
                                    }}
                                    title={call.isMuted ? "Unmute" : "Mute"}
                                >
                                    <span className="material-symbols">
                                        {call.isMuted ? "mic_off" : "mic"}
                                    </span>
                                </button>

                                <button
                                    onClick={endCall}
                                    style={{
                                        width: "48px",
                                        height: "48px",
                                        borderRadius: "50%",
                                        border: "none",
                                        backgroundColor: "var(--mdui-color-error)",
                                        color: "var(--mdui-color-on-error)",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "20px"
                                    }}
                                    title="End Call"
                                >
                                    <span className="material-symbols">call_end</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
