import { useAppState } from "@/pages/chat/state";
import * as WebRTC from "@/core/calls/webrtc";
import { CallSignalingHandler } from "@/core/calls/signaling";
import { setCallSignalingHandler } from "@/core/websocket";
import { generateCallSessionKey, generateCallEmojis, createCallSessionKeyFromHash } from "@/core/calls/encryption";
import { createRef, useEffect, useRef } from "react";

// Global refs shared across all instances
let globalRemoteAudioRef = createRef<HTMLAudioElement>();
let globalRemoteVideoRefs = new Map<number, React.RefObject<HTMLVideoElement | null>>();
let globalRemoteScreenshareRefs = new Map<number, React.RefObject<HTMLVideoElement | null>>();

export default function useCall() {
    const { 
        chat, 
        startCall, 
        endCall, 
        setCallStatus, 
        toggleMute, 
        setVideoState,
        setScreenshareState,
        updateParticipantMedia, 
        setPermissionError, 
        setCallEncryption, 
        setCallSessionKeyHash, 
        user 
    } = useAppState();
    const remoteAudioRef = globalRemoteAudioRef;
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const localScreenshareRef = useRef<HTMLVideoElement>(null);

    // Store the current video stream for reassignment
    const currentVideoStream = useRef<MediaStream | null>(null);

    // Function to assign video stream to element
    const assignVideoStreamToElement = (stream: MediaStream) => {
        if (!localVideoRef.current) {
            console.log("localVideoRef.current is null, retrying in 100ms");
            setTimeout(() => assignVideoStreamToElement(stream), 100);
            return;
        }

        try {
            // Check if the video element is actually in the DOM
            if (!localVideoRef.current.isConnected) {
                console.log("Video element not connected to DOM, retrying in 100ms");
                setTimeout(() => assignVideoStreamToElement(stream), 100);
                return;
            }
            
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.autoplay = true;
            localVideoRef.current.playsInline = true;
            localVideoRef.current.muted = true; // Always mute local video
            
            console.log("Successfully assigned local video stream to element", {
                hasStream: !!localVideoRef.current.srcObject,
                videoWidth: localVideoRef.current.videoWidth,
                videoHeight: localVideoRef.current.videoHeight,
                readyState: localVideoRef.current.readyState,
                isConnected: localVideoRef.current.isConnected
            });

            // Try to play immediately
            localVideoRef.current.play().catch(e => console.log("Immediate play failed:", e));
            
        } catch (e) {
            console.warn("failed to attach local video stream:", e);
        }
    };

    // Reassign video stream when video state changes (element becomes visible)
    useEffect(() => {
        if (chat.call.localMedia.hasVideo && currentVideoStream.current && localVideoRef.current) {
            console.log("Video state changed to true, reassigning stream");
            assignVideoStreamToElement(currentVideoStream.current);
        }
    }, [chat.call.localMedia.hasVideo]);

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
            setCallSessionKeyHash
        }));
        setCallSignalingHandler(signalingHandler);

        // Set up call state change handler
        WebRTC.setCallStateChangeHandler((userId: number, state: string) => {
            const call = chat.call;
            const participant = call.participants.find(p => p.userId === userId);
            if (participant) {
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
        WebRTC.setRemoteStreamHandler((userId: number, stream: MediaStream, type: 'audio' | 'video' | 'screenshare') => {
            if (type === 'audio') {
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
                    console.warn("failed to attach remote audio stream:", e);
                }
            } else if (type === 'video' || type === 'screenshare') {
                // Get or create video ref for this participant
                let videoRef = globalRemoteVideoRefs.get(userId);
                if (!videoRef) {
                    videoRef = createRef<HTMLVideoElement | null>();
                    globalRemoteVideoRefs.set(userId, videoRef);
                }

                const assignRemoteStream = () => {
                    if (videoRef && videoRef.current) {
                        try {
                            videoRef.current.srcObject = stream;
                            videoRef.current.autoplay = true;
                            videoRef.current.playsInline = true;
                            
                            // Add event listeners to debug video loading
                            videoRef.current.addEventListener('loadedmetadata', () => {
                                console.log(`Remote video metadata loaded for user ${userId}:`, {
                                    videoWidth: videoRef.current?.videoWidth,
                                    videoHeight: videoRef.current?.videoHeight,
                                    readyState: videoRef.current?.readyState
                                });
                            });
                            
                            videoRef.current.addEventListener('canplay', () => {
                                console.log(`Remote video can play for user ${userId}:`, {
                                    videoWidth: videoRef.current?.videoWidth,
                                    videoHeight: videoRef.current?.videoHeight,
                                    readyState: videoRef.current?.readyState
                                });
                            });
                            
                            videoRef.current.addEventListener('error', (e) => {
                                console.error(`Remote video error for user ${userId}:`, e);
                            });
                            
                            console.log(`Successfully assigned remote ${type} stream to element for user ${userId}`, {
                                hasStream: !!videoRef.current.srcObject,
                                videoWidth: videoRef.current.videoWidth,
                                videoHeight: videoRef.current.videoHeight,
                                readyState: videoRef.current.readyState
                            });
                        } catch (e) {
                            console.warn("failed to attach remote video stream:", e);
                        }
                    } else {
                        console.log(`Remote video ref for user ${userId} is null, retrying in 100ms`);
                        setTimeout(assignRemoteStream, 100);
                    }
                };
                assignRemoteStream();
            }
        });

        // Set up participant media change handler
        WebRTC.setParticipantMediaChangeHandler((userId: number, mediaState) => {
            updateParticipantMedia(userId, mediaState);
        });



        // Set up local stream handler
        WebRTC.setLocalStreamHandler((stream: MediaStream, type: 'audio' | 'video' | 'screenshare') => {
            console.log("Local stream received:", type, stream, "video ref:", localVideoRef.current);
            if (type === 'video') {
                // Store the stream for reassignment
                currentVideoStream.current = stream;
                
                // Debug the stream tracks
                console.log("Video stream tracks:", {
                    videoTracks: stream.getVideoTracks().map(t => ({
                        id: t.id,
                        label: t.label,
                        enabled: t.enabled,
                        muted: t.muted,
                        readyState: t.readyState
                    })),
                    audioTracks: stream.getAudioTracks().map(t => ({
                        id: t.id,
                        label: t.label,
                        enabled: t.enabled,
                        muted: t.muted,
                        readyState: t.readyState
                    })),
                    active: stream.active
                });
                
                // Assign the stream immediately
                assignVideoStreamToElement(stream);
            } else if (type === 'screenshare') {
                const assignScreenshareStream = () => {
                    if (localScreenshareRef.current) {
                        try {
                            localScreenshareRef.current.srcObject = stream;
                            localScreenshareRef.current.autoplay = true;
                            localScreenshareRef.current.playsInline = true;
                            localScreenshareRef.current.muted = true; // Always mute local screenshare
                            console.log("Successfully assigned local screenshare stream to element");
                        } catch (e) {
                            console.warn("failed to attach local screenshare stream:", e);
                        }
                    } else {
                        console.log("localScreenshareRef.current is null, retrying in 100ms");
                        setTimeout(assignScreenshareStream, 100);
                    }
                };
                assignScreenshareStream();
            }
        });

        // Set up call state change handler
        WebRTC.setCallStateChangeHandler((userId: number, state: string) => {
            console.log("Call state changed:", state, "for user", userId);
            if (state === "connected") {
                setCallStatus("active");
            } else if (state === "failed" || state === "disconnected" || state === "closed") {
                setCallStatus("ended");
            }
        });


        return () => {
            // Only cleanup when the component is actually unmounting, not when dependencies change
            // This prevents cleanup during active call setup
            if (!chat.call.isActive) {
            WebRTC.cleanup();
            setCallSignalingHandler(null);
            }
        };
    }, [user.authToken, setCallStatus, endCall, startCall]);

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
            // Send session key hash to the receiver for visual verification
            await WebRTC.sendCallSessionKey(userId, sessionKey.hash);
            // Also wrap and send the actual session key for E2EE media
            await WebRTC.sendWrappedCallSessionKey(userId, sessionKey.key, sessionKey.hash);
        } else {
            endCall();
        }
    };

    async function acceptCall() {
        const participant = chat.call.participants[0];
        if (!participant) {
            return;
        }

        setCallStatus("connecting");
        const success = await WebRTC.acceptCall(participant.userId);
        
        if (!success) {
            endCall();
        }
    };

    async function rejectCall() {
        const participant = chat.call.participants[0];
        if (!participant) {
            return;
        }

        await WebRTC.rejectCall(participant.userId);
        endCall();
    };

    async function handleEndCall() {
        await WebRTC.endCall();
        endCall();
    };

    async function handleToggleMute() {
        const isMuted = await WebRTC.toggleMute();
            // Update mute state in store
        if (isMuted !== chat.call.localMedia.isMuted) {
                toggleMute();
            }
    };

    async function handleToggleVideo() {
        try {
            const hasVideo = await WebRTC.toggleVideo();
            console.log("WebRTC.toggleVideo() returned:", hasVideo, "current state:", chat.call.localMedia.hasVideo);
            // Update video state in store to match WebRTC state
            setVideoState(hasVideo);
            console.log("Video state updated to:", hasVideo);
        } catch (error) {
            console.error("Failed to toggle video:", error);
            setPermissionError('video', true);
        }
    };

    async function handleToggleScreenshare() {
        try {
            const hasScreenshare = await WebRTC.toggleScreenshare();
            console.log("WebRTC.toggleScreenshare() returned:", hasScreenshare, "current state:", chat.call.localMedia.hasScreenshare);
            // Update screenshare state in store to match WebRTC state
            setScreenshareState(hasScreenshare);
        } catch (error) {
            console.error("Failed to toggle screenshare:", error);
            setPermissionError('screenshare', true);
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
            // Create session key from the hash provided by the caller
            const sessionKey = await createCallSessionKeyFromHash(sessionKeyHash);
            const emojis = generateCallEmojis(sessionKey.hash);
            setCallEncryption(sessionKey.hash, emojis);
        } catch (error) {
            console.error("Failed to create call session key from hash:", error);
        }
    };

    return {
        call: chat.call,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall: handleEndCall,
        toggleMute: handleToggleMute,
        toggleVideo: handleToggleVideo,
        toggleScreenshare: handleToggleScreenshare,
        handleIncomingCall,
        handleCallOffer,
        handleCallAnswer,
        handleIceCandidate,
        handleCallSessionKey,
        remoteAudioRef,
        localVideoRef,
        localScreenshareRef,
        globalRemoteVideoRefs,
        globalRemoteScreenshareRefs
    };
}
