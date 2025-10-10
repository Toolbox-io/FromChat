import { useAppState } from "@/pages/chat/state";
import useCall from "@/pages/chat/hooks/useCall";
import defaultAvatar from "@/images/default-avatar.png";

export function MinimizedCallBar() {
    const { chat, toggleCallMinimize } = useAppState();
    const { call } = chat;
    const { endCall, toggleMute } = useCall();

    function getGradientClass() {
        switch (call.status) {
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

    function getStatusText() {
        switch (call.status) {
            case "calling":
                return "Calling...";
            case "connecting":
                return "Connecting...";
            case "active":
                return "Active";
            default:
                return "";
        }
    }

    if (!call.isActive || !call.isMinimized) {
        return null;
    }

    const remoteParticipant = call.participants[0];

    return (
        <div className={`minimized-call-bar ${getGradientClass()}`} onClick={toggleCallMinimize}>
            <div className="call-info">
                <img src={defaultAvatar} alt="Avatar" className="avatar" />
                <div className="user-details">
                    <span className="username">{remoteParticipant?.username || "Call"}</span>
                    <span className="status">{getStatusText()}</span>
                </div>
            </div>
            
            <div className="call-actions" onClick={(e) => e.stopPropagation()}>
                {call.status === "calling" && call.participants.length > 0 ? (
                    <mdui-button-icon onClick={endCall} icon="call_end" />
                ) : (
                    <>
                        <mdui-button-icon onClick={toggleMute} icon={call.localMedia.isMuted ? "mic_off" : "mic"} />
                        <mdui-button-icon onClick={endCall} icon="call_end" />
                    </>
                )}
            </div>
        </div>
    );
}
