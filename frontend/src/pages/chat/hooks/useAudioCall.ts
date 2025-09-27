import { useAppState } from "@/pages/chat/state";
import { WebRTCService } from "@/core/calls/webrtc";
import { CallSignalingHandler } from "@/core/calls/signaling";
import { setCallSignalingHandler } from "@/core/websocket";
import { createRef, useEffect, useRef } from "react";

// Global audio ref shared across all instances
let globalRemoteAudioRef = createRef<HTMLAudioElement>();

export default function useAudioCall() {
    const { chat, startCall, endCall, setCallStatus, toggleMute, user } = useAppState();
    const webrtcService = useRef<WebRTCService | null>(null);
    const remoteAudioRef = globalRemoteAudioRef;

    useEffect(() => {
        // Initialize WebRTC service
        webrtcService.current = WebRTCService.getInstance();
        
        if (user.authToken) {
            webrtcService.current.setAuthToken(user.authToken);
        }

        // Initialize call signaling handler
        const signalingHandler = new CallSignalingHandler(() => ({ 
            receiveCall: (userId: number, username: string) => {
                // Use the receiveCall function from state
                const state = useAppState.getState();
                state.receiveCall(userId, username);
            }, 
            endCall 
        }));
        setCallSignalingHandler(signalingHandler);

        // Set up call state change handler
        webrtcService.current.setCallStateChangeHandler((userId: number, state: string) => {
            const call = chat.call;
            if (call.remoteUserId === userId) {
                switch (state) {
                    case "connecting":
                        setCallStatus("connecting");
                        break;
                    case "connected":
                        setCallStatus("active");
                        break;
                    case "disconnected":
                    case "failed":
                    case "closed":
                        endCall();
                        break;
                }
            }
        });

        // Set up remote stream handler
        webrtcService.current.setRemoteStreamHandler((_userId: number, stream: MediaStream) => {
            if (!remoteAudioRef.current) {
                return;
            }
            const el = remoteAudioRef.current;
            try {
                el.srcObject = stream;
                el.muted = false;
                el.volume = 1.0;
                el.autoplay = true;

                // Handle audio events
                el.addEventListener("error", () => {
                    console.warn("[AUDIO] element error", (el.error?.message) || el.error);
                });

                el.play().catch(() => {
                    // Try to play after user interaction if autoplay is blocked
                    const playAfterInteraction = () => {
                        el.play().catch(() => {});
                        document.removeEventListener('click', playAfterInteraction);
                        document.removeEventListener('touchstart', playAfterInteraction);
                    };
                    document.addEventListener('click', playAfterInteraction);
                    document.addEventListener('touchstart', playAfterInteraction);
                });
            } catch (e) {
                console.warn("failed to attach remote stream:", e);
            }
        });

        return () => {
            webrtcService.current?.cleanup();
            setCallSignalingHandler(null);
        };
    }, [user.authToken, chat.call.remoteUserId, setCallStatus, endCall, startCall]);

    async function requestAudioPermissions(): Promise<boolean> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true,
                video: false 
            });
            
            // Stop the stream immediately as we just needed permission
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            console.error("Failed to get audio permissions:", error);
            return false;
        }
    };

    async function initiateCall(userId: number, username: string) {
        const hasPermission = await requestAudioPermissions();
        
        if (!hasPermission) {
            console.log("Audio permission denied");
            return;
        }

        if (!webrtcService.current) {
            console.error("WebRTC service not initialized");
            return;
        }

        // Start the call in state
        startCall(userId, username);
        setCallStatus("calling");

        // Initiate WebRTC call
        const success = await webrtcService.current.initiateCall(userId, username);
        
        if (!success) {
            endCall();
        }
    };

    async function acceptCall() {
        if (!webrtcService.current || !chat.call.remoteUserId) {
            return;
        }

        setCallStatus("connecting");
        const success = await webrtcService.current.acceptCall(chat.call.remoteUserId);
        
        if (!success) {
            endCall();
        }
    };

    async function rejectCall() {
        if (!webrtcService.current || !chat.call.remoteUserId) {
            return;
        }

        await webrtcService.current.rejectCall(chat.call.remoteUserId);
        endCall();
    };

    async function handleEndCall() {
        if (webrtcService.current && chat.call.remoteUserId) {
            await webrtcService.current.endCall(chat.call.remoteUserId);
        }
        endCall();
    };

    function handleToggleMute() {
        if (webrtcService.current && chat.call.remoteUserId) {
            const isMuted = webrtcService.current.toggleMute(chat.call.remoteUserId);
            // Update mute state in store
            if (isMuted !== chat.call.isMuted) {
                toggleMute();
            }
        }
    };

    async function handleIncomingCall(userId: number, username: string) {
        if (!webrtcService.current) {
            return;
        }

        await webrtcService.current.handleIncomingCall(userId, username);
    };

    async function handleCallOffer(userId: number, offer: RTCSessionDescriptionInit) {
        if (!webrtcService.current) {
            return;
        }

        await webrtcService.current.handleCallOffer(userId, offer);
    };

    async function handleCallAnswer(userId: number, answer: RTCSessionDescriptionInit) {
        if (!webrtcService.current) {
            return;
        }

        await webrtcService.current.handleCallAnswer(userId, answer);
    };

    async function handleIceCandidate(userId: number, candidate: RTCIceCandidateInit) {
        if (!webrtcService.current) {
            return;
        }

        await webrtcService.current.handleIceCandidate(userId, candidate);
    };

    return {
        call: chat.call,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall: handleEndCall,
        toggleMute: handleToggleMute,
        handleIncomingCall,
        handleCallOffer,
        handleCallAnswer,
        handleIceCandidate,
        remoteAudioRef
    };
}
