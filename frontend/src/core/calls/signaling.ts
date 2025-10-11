import type { CallInvite, CallSignalingMessage } from "@/core/types";
import * as WebRTC from "./webrtc";

export interface CallState {
    receiveCall: (userId: number, username: string) => void;
    endCall: () => void;
    setCallSessionKeyHash: (sessionKeyHash: string) => void;
    setRemoteVideoEnabled: (enabled: boolean) => void;
    setRemoteScreenSharing: (enabled: boolean) => void;
}

export class CallSignalingHandler {
    private getState: () => CallState;

    constructor(getState: () => CallState) {
        this.getState = getState;
    }

    handleWebSocketMessage(message: CallSignalingMessage) {
        if (message.type !== "call_signaling") {
            return;
        }

        const { data } = message;
        if (!data) {
            console.warn("Received call_signaling message with no data:", message);
            return;
        }

        console.log("Received signaling message:", data.type, "from user", data.fromUserId, "full data:", data);

        switch (data.type) {
            case "call_invite":
                this.handleCallInvite(data as CallInvite);
                break;
            case "call_accept":
                this.handleCallAccept(data);
                break;
            case "call_reject":
                this.handleCallReject(data);
                break;
            case "call_offer":
                this.handleCallOffer(data);
                break;
            case "call_answer":
                this.handleCallAnswer(data);
                break;
            case "call_ice_candidate":
                this.handleIceCandidate(data);
                break;
            case "call_end":
                this.handleCallEnd(data);
                break;
            case "call_session_key":
                this.handleCallSessionKey(data);
                break;
            case "call_video_toggle":
                this.handleVideoToggle(data);
                break;
            case "call_screen_share_toggle":
                this.handleScreenShareToggle(data);
                break;
        }
    }

    private async handleCallInvite(data: CallInvite) {
        const { fromUserId, fromUsername } = data;
        const state = this.getState();
        
        // First, create the peer connection in WebRTC service
        await WebRTC.handleIncomingCall(fromUserId, fromUsername);
        
        // Then show incoming call UI
        state.receiveCall(fromUserId, fromUsername);
    }

    private async handleCallAccept(data: any) {
        const { fromUserId } = data;
        // Initiator should create and send offer now
        try {
            await WebRTC.onRemoteAccepted(fromUserId);
        } catch (error) {
            console.error("Failed to proceed after accept:", error);
        }
    }

    private handleCallReject(data: any) {
        const state = this.getState();
        const { fromUserId } = data;
        
        // Clean up WebRTC connection first
        if (fromUserId) {
            WebRTC.cleanupCall(fromUserId);
        }
        
        // End the call
        state.endCall();
    }

    private async handleCallOffer(data: any) {
        const { fromUserId, data: offer } = data;
        await WebRTC.handleCallOffer(fromUserId, offer);
    }

    private async handleCallAnswer(data: any) {
        const { fromUserId, data: answer } = data;
        await WebRTC.handleCallAnswer(fromUserId, answer);
    }

    private async handleIceCandidate(data: any) {
        const { fromUserId, data: candidate } = data;
        await WebRTC.handleIceCandidate(fromUserId, candidate);
    }

    private handleCallEnd(data: any) {
        const state = this.getState();
        const { fromUserId } = data;
        
        // Clean up WebRTC connection first
        if (fromUserId) {
            WebRTC.cleanupCall(fromUserId);
        }
        
        // End the call
        state.endCall();
    }

    private handleCallSessionKey({ sessionKeyHash, data, ...message }: CallSignalingMessage) {
        const state = this.getState();
        if (sessionKeyHash) {
            state.setCallSessionKeyHash(sessionKeyHash);
        }
        if (data?.wrappedSessionKey && message.fromUserId) {
            WebRTC.receiveWrappedSessionKey(message.fromUserId, data.wrappedSessionKey, sessionKeyHash);
        }
    }

    private handleVideoToggle(data: any) {
        console.log("handleVideoToggle called with data:", data);
        const state = this.getState();
        const { data: toggleData } = data;
        
        if (toggleData && typeof toggleData.enabled === "boolean") {
            console.log("Setting remote video enabled to:", toggleData.enabled);
            state.setRemoteVideoEnabled(toggleData.enabled);
        } else {
            console.warn("Invalid toggle data:", toggleData);
        }
    }

    private handleScreenShareToggle(data: any) {
        console.log("handleScreenShareToggle called with data:", data);
        const state = this.getState();
        const { data: toggleData } = data;
        
        if (toggleData && typeof toggleData.enabled === "boolean") {
            console.log("Setting remote screen sharing to:", toggleData.enabled);
            state.setRemoteScreenSharing(toggleData.enabled);
        } else {
            console.warn("Invalid toggle data:", toggleData);
        }
    }
}
