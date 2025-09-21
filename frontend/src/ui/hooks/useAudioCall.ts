import { useAppState } from "../state";
import { WebRTCService } from "../../utils/webrtc";
import { CallSignalingHandler } from "../../utils/callSignaling";
import { setCallSignalingHandler } from "../../core/websocket";
import { useEffect, useRef } from "react";

// Global audio ref shared across all instances
const globalRemoteAudioRef = { current: null as HTMLAudioElement | null };

export function useAudioCall() {
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
                console.log("[CALL] state", userId, state);
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
            console.log("[AUDIO] Remote stream handler called", {
                userId: _userId,
                streamId: stream.id,
                hasAudioTracks: stream.getAudioTracks().length > 0,
                hasAudioElement: !!remoteAudioRef.current
            });
            if (!remoteAudioRef.current) {
                console.warn("[AUDIO] No audio element available, stream will be lost");
                return;
            }
            const el = remoteAudioRef.current;
            try {
                const track = stream.getAudioTracks()[0];
                console.log("[AUDIO] attach remote stream", {
                    streamId: stream.id,
                    trackId: track?.id,
                    trackEnabled: track?.enabled,
                    trackReadyState: track?.readyState
                });

                el.srcObject = stream;
                el.muted = false;
                el.volume = 1.0;
                el.autoplay = true;
                // Helpful event logs
                const onPlaying = () => console.log("[AUDIO] element playing");
                const onPause = () => console.log("[AUDIO] element paused");
                const onError = () => console.warn("[AUDIO] element error", (el.error && el.error.message) || el.error);
                el.addEventListener("playing", onPlaying, { once: true });
                el.addEventListener("pause", onPause, { once: true });
                el.addEventListener("error", onError, { once: true });

                const p = el.play();
                if (p && typeof p.then === "function") {
                    p.then(() => console.log("[AUDIO] Remote audio playing successfully"))
                     .catch((e: any) => {
                        console.warn("[AUDIO] play() blocked:", e?.message || e);
                        // Try to play after user interaction
                        const playAfterInteraction = () => {
                            el.play().then(() => console.log("[AUDIO] Played after interaction"))
                                .catch(() => console.warn("[AUDIO] Still blocked after interaction"));
                            document.removeEventListener('click', playAfterInteraction);
                            document.removeEventListener('touchstart', playAfterInteraction);
                        };
                        document.addEventListener('click', playAfterInteraction);
                        document.addEventListener('touchstart', playAfterInteraction);
                    });
                }
            } catch (e: any) {
                console.warn("failed to attach remote stream:", e?.message || e);
            }
        });

        return () => {
            if (webrtcService.current) {
                webrtcService.current.cleanup();
            }
            setCallSignalingHandler(null);
        };
    }, [user.authToken, chat.call.remoteUserId, setCallStatus, endCall, startCall]);

    const requestAudioPermissions = async (): Promise<boolean> => {
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

    const initiateCall = async (userId: number, username: string) => {
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

    const acceptCall = async () => {
        if (!webrtcService.current || !chat.call.remoteUserId) {
            return;
        }

        setCallStatus("connecting");
        const success = await webrtcService.current.acceptCall(chat.call.remoteUserId);
        
        if (!success) {
            endCall();
        }
    };

    const rejectCall = async () => {
        if (!webrtcService.current || !chat.call.remoteUserId) {
            return;
        }

        await webrtcService.current.rejectCall(chat.call.remoteUserId);
        endCall();
    };

    const handleEndCall = async () => {
        if (webrtcService.current && chat.call.remoteUserId) {
            await webrtcService.current.endCall(chat.call.remoteUserId);
        }
        endCall();
    };

    const handleToggleMute = () => {
        if (webrtcService.current && chat.call.remoteUserId) {
            const isMuted = webrtcService.current.toggleMute(chat.call.remoteUserId);
            // Update mute state in store
            if (isMuted !== chat.call.isMuted) {
                toggleMute();
            }
        }
    };

    const handleIncomingCall = async (userId: number, username: string) => {
        if (!webrtcService.current) {
            return;
        }

        await webrtcService.current.handleIncomingCall(userId, username);
    };

    const handleCallOffer = async (userId: number, offer: RTCSessionDescriptionInit) => {
        if (!webrtcService.current) {
            return;
        }

        await webrtcService.current.handleCallOffer(userId, offer);
    };

    const handleCallAnswer = async (userId: number, answer: RTCSessionDescriptionInit) => {
        if (!webrtcService.current) {
            return;
        }

        await webrtcService.current.handleCallAnswer(userId, answer);
    };

    const handleIceCandidate = async (userId: number, candidate: RTCIceCandidateInit) => {
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
