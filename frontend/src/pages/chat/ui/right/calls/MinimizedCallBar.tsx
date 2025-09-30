import { useAppState } from "@/pages/chat/state";
import useAudioCall from "@/pages/chat/hooks/useAudioCall";
import defaultAvatar from "@/images/default-avatar.png";

export function MinimizedCallBar() {
    const { chat, toggleCallMinimize } = useAppState();
    const { call } = chat;
    const { endCall, toggleMute } = useAudioCall();

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

    return (
        <div className={`minimized-call-bar ${getGradientClass()}`} onClick={toggleCallMinimize}>
            <div className="call-info">
                <img src={defaultAvatar} alt="Avatar" className="avatar" />
                <div className="user-details">
                    <span className="username">{call.remoteUsername}</span>
                    <span className="status">{getStatusText()}</span>
                </div>
            </div>
            
            <div className="call-actions" onClick={(e) => e.stopPropagation()}>
                {call.status === "calling" && !call.isInitiator ? (
                    <mdui-button-icon onClick={endCall} icon="call_end" />
                ) : (
                    <>
                        <mdui-button-icon onClick={toggleMute} icon={call.isMuted ? "mic_off" : "mic"} />
                        <mdui-button-icon onClick={endCall} icon="call_end" />
                    </>
                )}
            </div>
        </div>
    );
}
