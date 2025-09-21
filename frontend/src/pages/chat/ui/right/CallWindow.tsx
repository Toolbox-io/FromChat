import { useState, useEffect } from "react";
import { useAppState } from "@/pages/chat/state";
import useAudioCall from "@/pages/chat/hooks/useAudioCall";
import defaultAvatar from "@/images/default-avatar.png";

export function CallWindow() {
    const { chat, toggleMute } = useAppState();
    const { call } = chat;
    const { acceptCall, rejectCall, remoteAudioRef, endCall } = useAudioCall();
    const [position, setPosition] = useState({ x: 100, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [callDuration, setCallDuration] = useState(0);

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

    function formatDuration(seconds: number) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function getStatusText() {
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
    }


    return (
        <>
            <audio
                ref={remoteAudioRef}
                className="remote-audio"
                autoPlay
                playsInline
                controls />
            
            {call.isActive && (
                <div
                    className={`call-window ${isDragging ? 'dragging' : ''}`}
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
                        <div className="user-info">
                            <img
                                src={defaultAvatar}
                                alt="Avatar"
                                className="avatar" />
                            
                            <div className="user-details">
                                <h3 className="username">
                                    {call.remoteUsername}
                                </h3>
                                <p className="status">
                                    {getStatusText()}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="call-controls">
                        {call.status === "calling" && !call.isInitiator ? (
                            <>
                                <mdui-button-icon onClick={acceptCall} icon="call" />
                                <mdui-button-icon onClick={rejectCall} icon="call_end" />
                            </>
                        ) : (
                            <>
                                <mdui-button-icon onClick={toggleMute} icon={call.isMuted ? "mic_off" : "mic"} />
                                <mdui-button-icon onClick={endCall} icon="call_end" />
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
