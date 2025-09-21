import type { WebSocketMessage } from "../core/types";
import { WebRTCService } from "./webrtc";

export class CallSignalingHandler {
    private webrtcService: WebRTCService;
    private getState: () => any;

    constructor(getState: () => any) {
        this.webrtcService = WebRTCService.getInstance();
        this.getState = getState;
    }

    handleWebSocketMessage(message: WebSocketMessage) {
        if (message.type !== "call_signaling") {
            return;
        }

        const { data } = message;
        if (!data) return;

        switch (data.type) {
            case "call_invite":
                this.handleCallInvite(data);
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
        }
    }

    private async handleCallInvite(data: any) {
        const { fromUserId, fromUsername } = data;
        const state = this.getState();
        
        // Show incoming call UI
        state.receiveCall(fromUserId, fromUsername);
        
        // Handle incoming call in WebRTC service
        await this.webrtcService.handleIncomingCall(fromUserId, fromUsername);
    }

    private async handleCallAccept(data: any) {
        const { fromUserId } = data;
        // Call was accepted, create offer
        const call = this.webrtcService.getCall(fromUserId);
        if (call && call.isInitiator) {
            try {
                const offer = await call.peerConnection.createOffer();
                await call.peerConnection.setLocalDescription(offer);
                
                // Send offer through WebSocket
                // This would be handled by the WebRTC service
            } catch (error) {
                console.error("Failed to create offer:", error);
            }
        }
    }

    private handleCallReject(_data: any) {
        const state = this.getState();
        
        // End the call
        state.endCall();
    }

    private async handleCallOffer(data: any) {
        const { fromUserId, data: offer } = data;
        await this.webrtcService.handleCallOffer(fromUserId, offer);
    }

    private async handleCallAnswer(data: any) {
        const { fromUserId, data: answer } = data;
        await this.webrtcService.handleCallAnswer(fromUserId, answer);
    }

    private async handleIceCandidate(data: any) {
        const { fromUserId, data: candidate } = data;
        await this.webrtcService.handleIceCandidate(fromUserId, candidate);
    }

    private handleCallEnd(_data: any) {
        const state = this.getState();
        
        // End the call
        state.endCall();
    }
}
