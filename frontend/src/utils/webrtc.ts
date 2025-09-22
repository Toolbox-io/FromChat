import { request } from "../core/websocket";

export interface CallSignalingMessage {
    type: "call_offer" | "call_answer" | "call_ice_candidate" | "call_end" | "call_invite" | "call_accept" | "call_reject";
    fromUserId: number;
    toUserId: number;
    data?: any;
}

export interface WebRTCCall {
    peerConnection: RTCPeerConnection;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    isInitiator: boolean;
    remoteUserId: number;
    remoteUsername: string;
}

export class WebRTCService {
    private static instance: WebRTCService;
    private calls: Map<number, WebRTCCall> = new Map();
    private authToken: string | null = null;
    private onCallStateChange: ((userId: number, state: string) => void) | null = null;
    private onRemoteStream: ((userId: number, stream: MediaStream) => void) | null = null;

    private constructor() {}

    static getInstance(): WebRTCService {
        if (!WebRTCService.instance) {
            WebRTCService.instance = new WebRTCService();
        }
        return WebRTCService.instance;
    }

    setAuthToken(token: string) {
        this.authToken = token;
    }

    setCallStateChangeHandler(handler: (userId: number, state: string) => void) {
        this.onCallStateChange = handler;
    }

    setRemoteStreamHandler(handler: (userId: number, stream: MediaStream) => void) {
        this.onRemoteStream = handler;
    }

    private async sendSignalingMessage(message: CallSignalingMessage) {
        if (!this.authToken) {
            throw new Error("No auth token available");
        }

        try {
            await request({
                type: "call_signaling",
                credentials: {
                    scheme: "Bearer",
                    credentials: this.authToken
                },
                data: message
            });
        } catch (error) {
            console.error("Failed to send signaling message:", error);
            throw error;
        }
    }

    private createPeerConnection(userId: number): RTCPeerConnection {
        const configuration: RTCConfiguration = {
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" }
            ]
        };

        const peerConnection = new RTCPeerConnection(configuration);

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignalingMessage({
                    type: "call_ice_candidate",
                    fromUserId: 0, // Will be set by server
                    toUserId: userId,
                    data: event.candidate
                });
            }
        };

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            const [remoteStream] = event.streams;
            const call = this.calls.get(userId);
            if (call) {
                call.remoteStream = remoteStream;
                if (this.onRemoteStream) {
                    this.onRemoteStream(userId, remoteStream);
                }
            }
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            const call = this.calls.get(userId);
            if (call) {
                console.log(`Connection state for user ${userId}:`, peerConnection.connectionState);
                
                if (this.onCallStateChange) {
                    this.onCallStateChange(userId, peerConnection.connectionState);
                }

                // Clean up if connection failed or closed
                if (peerConnection.connectionState === "failed" || 
                    peerConnection.connectionState === "closed" ||
                    peerConnection.connectionState === "disconnected") {
                    this.endCall(userId);
                }
            }
        };

        // Optional: log negotiation events
        peerConnection.onnegotiationneeded = async () => {
            console.log("negotiationneeded for", userId);
        };

        return peerConnection;
    }

    async initiateCall(userId: number, username: string): Promise<boolean> {
        try {
            // Get user media
            const localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });

            // Create peer connection
            const peerConnection = this.createPeerConnection(userId);

            // Add local stream to peer connection (ensure audio track enabled)
            localStream.getAudioTracks().forEach(t => (t.enabled = true));
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            // Store call info
            const call: WebRTCCall = {
                peerConnection,
                localStream,
                remoteStream: null,
                isInitiator: true,
                remoteUserId: userId,
                remoteUsername: username
            };

            this.calls.set(userId, call);

            // Send call invitation
            await this.sendSignalingMessage({
                type: "call_invite",
                fromUserId: 0, // Will be set by server
                toUserId: userId,
                data: { username }
            });

            return true;
        } catch (error) {
            console.error("Failed to initiate call:", error);
            this.cleanupCall(userId);
            return false;
        }
    }

    async acceptCall(userId: number): Promise<boolean> {
        try {
            let call = this.calls.get(userId);
            if (!call) {
                // In case signaling invite UI was shown but call not created yet
                await this.handleIncomingCall(userId, "");
                call = this.calls.get(userId);
                if (!call) throw new Error("No call found to accept");
            }

            // Get user media and attach
            const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            call.localStream = localStream;
            localStream.getTracks().forEach(track => call!.peerConnection.addTrack(track, localStream));

            // Notify initiator that callee accepted; initiator will generate offer
            await this.sendSignalingMessage({
                type: "call_accept",
                fromUserId: 0, // Will be set by server
                toUserId: userId,
                data: {}
            });

            return true;
        } catch (error) {
            console.error("Failed to accept call:", error);
            this.cleanupCall(userId);
            return false;
        }
    }

    async rejectCall(userId: number): Promise<void> {
        await this.sendSignalingMessage({
            type: "call_reject",
            fromUserId: 0, // Will be set by server
            toUserId: userId,
            data: {}
        });

        this.cleanupCall(userId);
    }

    async endCall(userId: number): Promise<void> {
        const call = this.calls.get(userId);
        if (call) {
            // Send call end message
            await this.sendSignalingMessage({
                type: "call_end",
                fromUserId: 0, // Will be set by server
                toUserId: userId,
                data: {}
            });

            this.cleanupCall(userId);
        }
    }

    async handleIncomingCall(userId: number, username: string): Promise<void> {
        try {
            // Create peer connection for incoming call
            const peerConnection = this.createPeerConnection(userId);

            const call: WebRTCCall = {
                peerConnection,
                localStream: null,
                remoteStream: null,
                isInitiator: false,
                remoteUserId: userId,
                remoteUsername: username
            };

            this.calls.set(userId, call);
        } catch (error) {
            console.error("Failed to handle incoming call:", error);
        }
    }

    async handleCallOffer(userId: number, offer: RTCSessionDescriptionInit): Promise<void> {
        const call = this.calls.get(userId);
        if (!call) {
            throw new Error("No call found for offer");
        }

        await call.peerConnection.setRemoteDescription(offer);

        // If we are the callee (not initiator), generate and send answer now
        if (!call.isInitiator) {
            const answer = await call.peerConnection.createAnswer();
            await call.peerConnection.setLocalDescription(answer);
            await this.sendSignalingMessage({
                type: "call_answer",
                fromUserId: 0,
                toUserId: userId,
                data: answer
            });
        }
    }

    async handleCallAnswer(userId: number, answer: RTCSessionDescriptionInit): Promise<void> {
        const call = this.calls.get(userId);
        if (!call) {
            throw new Error("No call found for answer");
        }

        await call.peerConnection.setRemoteDescription(answer);
    }

    // Invoked on initiator when remote accepted; create and send offer
    async onRemoteAccepted(userId: number): Promise<void> {
        const call = this.calls.get(userId);
        if (!call) {
            throw new Error("No call found to create offer");
        }

        const offer = await call.peerConnection.createOffer();
        await call.peerConnection.setLocalDescription(offer);
        await this.sendSignalingMessage({
            type: "call_offer",
            fromUserId: 0,
            toUserId: userId,
            data: offer
        });
    }

    async handleIceCandidate(userId: number, candidate: RTCIceCandidateInit): Promise<void> {
        const call = this.calls.get(userId);
        if (!call) {
            throw new Error("No call found for ICE candidate");
        }

        await call.peerConnection.addIceCandidate(candidate);
    }

    toggleMute(userId: number): boolean {
        const call = this.calls.get(userId);
        if (!call || !call.localStream) {
            return false;
        }

        const audioTrack = call.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            return !audioTrack.enabled; // Return true if muted
        }

        return false;
    }

    getCall(userId: number): WebRTCCall | undefined {
        return this.calls.get(userId);
    }

    private cleanupCall(userId: number): void {
        const call = this.calls.get(userId);
        if (call) {
            // Close peer connection
            if (call.peerConnection) {
                call.peerConnection.close();
            }

            // Stop local stream
            if (call.localStream) {
                call.localStream.getTracks().forEach(track => track.stop());
            }

            this.calls.delete(userId);
        }
    }

    cleanup(): void {
        // Clean up all calls
        for (const userId of this.calls.keys()) {
            this.cleanupCall(userId);
        }
        this.calls.clear();
    }
}
