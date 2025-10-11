import { useAppState } from "@/pages/chat/state";
import * as WebRTC from "@/core/calls/webrtc";
import { CallSignalingHandler } from "@/core/calls/signaling";
import { setCallSignalingHandler } from "@/core/websocket";
import { generateCallSessionKey, generateCallEmojis } from "@/core/calls/encryption";
import { createRef, useEffect } from "react";

// Global audio ref shared across all instances
let globalRemoteAudioRef = createRef<HTMLAudioElement>();

export default function useAudioCall() {
    const { chat, startCall, endCall, setCallStatus, toggleMute, setCallEncryption, setCallSessionKeyHash, user } = useAppState();
    const remoteAudioRef = globalRemoteAudioRef;

    useEffect(() => {
        if (user.authToken) {
            WebRTC.setAuthToken(user.authToken);
        }

        // Initialize call signaling handler
        const signalingHandler = new CallSignalingHandler(() => ({ 
            receiveCall: (userId: number, username: string) => {
                // Use the receiveCall function from state
                const state = useAppState.getState();
                state.receiveCall(userId, username);
            }, 
            endCall,
            setCallSessionKeyHash,
            setRemoteVideoEnabled: (enabled: boolean) => {
                const state = useAppState.getState();
                state.setRemoteVideoEnabled(enabled);
            },
            setRemoteScreenSharing: (enabled: boolean) => {
                const state = useAppState.getState();
                state.setRemoteScreenSharing(enabled);
            }
        }));
        setCallSignalingHandler(signalingHandler);

        // Set up call state change handler
        WebRTC.setCallStateChangeHandler((userId: number, state: string) => {
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
        WebRTC.setRemoteStreamHandler((_userId: number, stream: MediaStream) => {
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
            WebRTC.cleanup();
            setCallSignalingHandler(null);
        };
    }, [user.authToken, chat.call.remoteUserId, setCallStatus, endCall, startCall]);

    // Watch for session key hash changes and generate emojis
    useEffect(() => {
        if (chat.call.sessionKeyHash && chat.call.encryptionEmojis.length === 0) {
            const emojis = generateCallEmojis(chat.call.sessionKeyHash);
            setCallEncryption(chat.call.sessionKeyHash, emojis);
        }
    }, [chat.call.sessionKeyHash, chat.call.encryptionEmojis.length, setCallEncryption]);

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


        let sessionKey;
        try {
            // Generate call session key and emojis
            sessionKey = await generateCallSessionKey();
            const emojis = generateCallEmojis(sessionKey.hash);
            
            // Start the call in state
            startCall(userId, username);
            setCallStatus("calling");
            setCallEncryption(sessionKey.hash, emojis);
        } catch (error) {
            console.error("Failed to generate call encryption:", error);
            endCall();
            return;
        }

        // Initiate WebRTC call
        const success = await WebRTC.initiateCall(userId, username);
        
        if (success && sessionKey) {
            // Set the session key for ourselves (initiator)
            await WebRTC.setSessionKey(userId, sessionKey.key);
            
            // Send session key hash to the receiver for visual verification
            await WebRTC.sendCallSessionKey(userId, sessionKey.hash);
            // Also wrap and send the actual session key for E2EE media
            await WebRTC.sendWrappedCallSessionKey(userId, sessionKey.key, sessionKey.hash);
        } else {
            endCall();
        }
    };

    async function acceptCall() {
        if (!chat.call.remoteUserId) {
            return;
        }

        setCallStatus("connecting");
        const success = await WebRTC.acceptCall(chat.call.remoteUserId);
        
        if (!success) {
            endCall();
        }
    };

    async function rejectCall() {
        if (!chat.call.remoteUserId) {
            return;
        }

        await WebRTC.rejectCall(chat.call.remoteUserId);
        endCall();
    };

    async function handleEndCall() {
        if (chat.call.remoteUserId) {
            await WebRTC.endCall(chat.call.remoteUserId);
        }
        endCall();
    };

    function handleToggleMute() {
        if (chat.call.remoteUserId) {
            const isMuted = WebRTC.toggleMute(chat.call.remoteUserId);
            // Update mute state in store
            if (isMuted !== chat.call.isMuted) {
                toggleMute();
            }
        }
    };

    async function handleIncomingCall(userId: number, username: string) {
        // Don't generate session key here - wait for it from the caller
        await WebRTC.handleIncomingCall(userId, username);
    };

    async function handleCallOffer(userId: number, offer: RTCSessionDescriptionInit) {
        await WebRTC.handleCallOffer(userId, offer);
    };

    async function handleCallAnswer(userId: number, answer: RTCSessionDescriptionInit) {
        await WebRTC.handleCallAnswer(userId, answer);
    };

    async function handleIceCandidate(userId: number, candidate: RTCIceCandidateInit) {
        await WebRTC.handleIceCandidate(userId, candidate);
    };

    async function handleCallSessionKey(sessionKeyHash: string) {
        try {
            // Just generate and display the emojis from the hash
            // The actual session key will arrive via the wrapped key mechanism
            const emojis = generateCallEmojis(sessionKeyHash);
            setCallEncryption(sessionKeyHash, emojis);
        } catch (error) {
            console.error("Failed to generate call emojis from hash:", error);
        }
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
        handleCallSessionKey,
        remoteAudioRef
    };
}
