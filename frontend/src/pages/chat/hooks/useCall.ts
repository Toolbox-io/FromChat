import { useAppState } from "@/pages/chat/state";
import * as WebRTC from "@/core/calls/webrtc";
import { CallSignalingHandler } from "@/core/calls/signaling";
import { setCallSignalingHandler } from "@/core/websocket";
import { generateCallSessionKey, generateCallEmojis } from "@/core/calls/encryption";
import { createRef, useEffect } from "react";

// Global refs shared across all instances
let globalRemoteAudioRef = createRef<HTMLAudioElement>();
let globalLocalVideoRef = createRef<HTMLVideoElement>();
let globalRemoteVideoRef = createRef<HTMLVideoElement>();
let globalLocalScreenShareRef = createRef<HTMLVideoElement>();
let globalRemoteScreenShareRef = createRef<HTMLVideoElement>();

export default function useCall() {
    const { 
        chat, 
        startCall, 
        endCall, 
        setCallStatus, 
        toggleMute, 
        toggleVideo, 
        toggleScreenShare,
        setCallEncryption, 
        setCallSessionKeyHash, 
        setRemoteVideoEnabled,
        setRemoteScreenSharing,
        user 
    } = useAppState();
    
    const remoteAudioRef = globalRemoteAudioRef;
    const localVideoRef = globalLocalVideoRef;
    const remoteVideoRef = globalRemoteVideoRef;
    const localScreenShareRef = globalLocalScreenShareRef;
    const remoteScreenShareRef = globalRemoteScreenShareRef;

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
            setRemoteVideoEnabled,
            setRemoteScreenSharing
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

        // Set up remote audio stream handler
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
                        document.removeEventListener("click", playAfterInteraction);
                        document.removeEventListener("touchstart", playAfterInteraction);
                    };
                    document.addEventListener("click", playAfterInteraction);
                    document.addEventListener("touchstart", playAfterInteraction);
                });
            } catch (e) {
                console.warn("failed to attach remote stream:", e);
            }
        });

        // Set up local video stream handler
        WebRTC.setLocalVideoStreamHandler((_userId: number, stream: MediaStream | null) => {
            console.log("Local video stream handler called, stream:", stream, "ref exists:", !!localVideoRef.current);
            if (!localVideoRef.current) {
                console.warn("Local video ref not available yet");
                return;
            }
            const el = localVideoRef.current;
            try {
                el.srcObject = stream;
                el.muted = true; // Always mute local video to avoid feedback
                el.autoplay = true;
                if (stream) {
                    console.log("Playing local video stream");
                    el.play().catch((err) => {
                        console.error("Failed to play local video:", err);
                    });
                }
            } catch (e) {
                console.warn("failed to attach local video stream:", e);
            }
        });

        // Set up remote video stream handler
        WebRTC.setRemoteVideoStreamHandler((_userId: number, stream: MediaStream | null) => {
            console.log("Remote video stream handler called, stream:", stream, "ref exists:", !!remoteVideoRef.current);
            if (!remoteVideoRef.current) {
                console.warn("Remote video ref not available yet");
                return;
            }
            const el = remoteVideoRef.current;
            try {
                el.srcObject = stream;
                el.muted = false;
                el.autoplay = true;
                if (stream) {
                    console.log("Playing remote video stream");
                    el.play().catch((err) => {
                        console.error("Failed to play remote video:", err);
                        const playAfterInteraction = () => {
                            el.play().catch(() => {});
                            document.removeEventListener("click", playAfterInteraction);
                            document.removeEventListener("touchstart", playAfterInteraction);
                        };
                        document.addEventListener("click", playAfterInteraction);
                        document.addEventListener("touchstart", playAfterInteraction);
                    });
                }
            } catch (e) {
                console.warn("failed to attach remote video stream:", e);
            }
        });

        // Set up local screen share handler
        WebRTC.setLocalScreenShareHandler((_userId: number, stream: MediaStream | null) => {
            console.log("Local screen share handler called, stream:", stream, "ref exists:", !!localScreenShareRef.current);
            if (!localScreenShareRef.current) {
                console.warn("Local screen share ref not available yet");
                return;
            }
            const el = localScreenShareRef.current;
            try {
                el.srcObject = stream;
                el.muted = true;
                el.autoplay = true;
                if (stream) {
                    console.log("Playing local screen share");
                    el.play().catch((err) => {
                        console.error("Failed to play local screen share:", err);
                    });
                }
            } catch (e) {
                console.warn("failed to attach local screen share stream:", e);
            }
        });

        // Set up remote screen share handler
        WebRTC.setRemoteScreenShareHandler((_userId: number, stream: MediaStream | null) => {
            console.log("Remote screen share handler called, stream:", stream, "ref exists:", !!remoteScreenShareRef.current);
            if (!remoteScreenShareRef.current) {
                console.warn("Remote screen share ref not available yet");
                return;
            }
            const el = remoteScreenShareRef.current;
            try {
                el.srcObject = stream;
                el.muted = false;
                el.autoplay = true;
                if (stream) {
                    console.log("Playing remote screen share");
                    el.play().catch((err) => {
                        console.error("Failed to play remote screen share:", err);
                        const playAfterInteraction = () => {
                            el.play().catch(() => {});
                            document.removeEventListener("click", playAfterInteraction);
                            document.removeEventListener("touchstart", playAfterInteraction);
                        };
                        document.addEventListener("click", playAfterInteraction);
                        document.addEventListener("touchstart", playAfterInteraction);
                    });
                }
            } catch (e) {
                console.warn("failed to attach remote screen share stream:", e);
            }
        });

        return () => {
            WebRTC.cleanup();
            setCallSignalingHandler(null);
        };
    }, [user.authToken, chat.call.remoteUserId, setCallStatus, endCall, startCall, setRemoteVideoEnabled, setRemoteScreenSharing]);

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
    }

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
    }

    async function acceptCall() {
        if (!chat.call.remoteUserId) {
            return;
        }

        setCallStatus("connecting");
        const success = await WebRTC.acceptCall(chat.call.remoteUserId);
        
        if (!success) {
            endCall();
        }
    }

    async function rejectCall() {
        if (!chat.call.remoteUserId) {
            return;
        }

        await WebRTC.rejectCall(chat.call.remoteUserId);
        endCall();
    }

    async function handleEndCall() {
        if (chat.call.remoteUserId) {
            await WebRTC.endCall(chat.call.remoteUserId);
        }
        endCall();
    }

    function handleToggleMute() {
        if (chat.call.remoteUserId) {
            const isMuted = WebRTC.toggleMute(chat.call.remoteUserId);
            // Update mute state in store
            if (isMuted !== chat.call.isMuted) {
                toggleMute();
            }
        }
    }

    async function handleToggleVideo() {
        if (chat.call.remoteUserId) {
            const isEnabled = await WebRTC.toggleVideo(chat.call.remoteUserId);
            // Update video state in store
            if (isEnabled !== chat.call.isVideoEnabled) {
                toggleVideo();
            }
        }
    }

    async function handleToggleScreenShare() {
        if (chat.call.remoteUserId) {
            const isEnabled = await WebRTC.toggleScreenShare(chat.call.remoteUserId);
            // Update screen share state in store
            if (isEnabled !== chat.call.isSharingScreen) {
                toggleScreenShare();
            }
        }
    }

    async function handleIncomingCall(userId: number, username: string) {
        // Don't generate session key here - wait for it from the caller
        await WebRTC.handleIncomingCall(userId, username);
    }

    async function handleCallOffer(userId: number, offer: RTCSessionDescriptionInit) {
        await WebRTC.handleCallOffer(userId, offer);
    }

    async function handleCallAnswer(userId: number, answer: RTCSessionDescriptionInit) {
        await WebRTC.handleCallAnswer(userId, answer);
    }

    async function handleIceCandidate(userId: number, candidate: RTCIceCandidateInit) {
        await WebRTC.handleIceCandidate(userId, candidate);
    }

    async function handleCallSessionKey(sessionKeyHash: string) {
        try {
            // Just generate and display the emojis from the hash
            // The actual session key will arrive via the wrapped key mechanism
            const emojis = generateCallEmojis(sessionKeyHash);
            setCallEncryption(sessionKeyHash, emojis);
        } catch (error) {
            console.error("Failed to generate call emojis from hash:", error);
        }
    }

    return {
        call: chat.call,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall: handleEndCall,
        toggleMute: handleToggleMute,
        toggleVideo: handleToggleVideo,
        toggleScreenShare: handleToggleScreenShare,
        handleIncomingCall,
        handleCallOffer,
        handleCallAnswer,
        handleIceCandidate,
        handleCallSessionKey,
        remoteAudioRef,
        localVideoRef,
        remoteVideoRef,
        localScreenShareRef,
        remoteScreenShareRef
    };
}

