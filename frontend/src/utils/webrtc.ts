import { getAuthHeaders } from "../auth/api";
import type { CallSignalingMessage, IceServersResponse } from "../core/types";
import { request } from "../core/websocket";
import { wrapCallSessionKeyForRecipient, unwrapCallSessionKeyFromSender, createSharedSecretAndDeriveSessionKey, rotateCallSessionKey } from "./crypto/callEncryption";
import { fetchUserPublicKey } from "../api/dmApi";
import { importAesGcmKey } from "./crypto/symmetric";
import E2EEWorker from "../modules/e2eeWorker.ts?worker";


export interface WebRTCCall {
    peerConnection: RTCPeerConnection;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    remoteVideoStream?: MediaStream | null;
    remoteScreenStream?: MediaStream | null;
    isInitiator: boolean;
    remoteUserId: number;
    remoteUsername: string;
    isEnding?: boolean;
    isMuted?: boolean;
    // Video and Screen Share
    isVideoEnabled?: boolean;
    isScreenSharing?: boolean;
    localVideoStream?: MediaStream | null;
    localScreenStream?: MediaStream | null;
    // Insertable Streams E2EE
    sessionKey?: Uint8Array | null;
    sessionCryptoKey?: CryptoKey | null;
    sessionId: string;
    keyRotationTimer?: NodeJS.Timeout;
    lastKeyRotation?: number;
}

// Global state
export let authToken: string | null = null;
export let onCallStateChange: ((userId: number, state: string) => void) | null = null;
export let onRemoteStream: ((userId: number, stream: MediaStream) => void) | null = null;
export let onRemoteVideoStream: ((userId: number, stream: MediaStream) => void) | null = null;
const calls: Map<number, WebRTCCall> = new Map();

export function setAuthToken(token: string) {
    authToken = token;
}

export function setCallStateChangeHandler(handler: (userId: number, state: string) => void) {
    onCallStateChange = handler;
}

export function setRemoteStreamHandler(handler: (userId: number, stream: MediaStream) => void) {
    onRemoteStream = handler;
}

export function setRemoteVideoStreamHandler(handler: (userId: number, stream: MediaStream) => void) {
    onRemoteVideoStream = handler;
}

// Video quality constraints with adaptive resolution capped at 2K (both video and screen share)
const VIDEO_CONSTRAINTS: MediaStreamConstraints = {
    video: {
        width: { ideal: 1024, min: 320, max: 2048 },
        height: { ideal: 768, min: 240, max: 1152 },
        frameRate: { ideal: 30, max: 60 },
        facingMode: "user"
    },
    audio: false
};

const SCREEN_CONSTRAINTS: MediaStreamConstraints = {
    video: {
        width: { ideal: 1024, min: 320, max: 2048 },
        height: { ideal: 768, min: 240, max: 1152 },
        frameRate: { ideal: 30, max: 60 }
    },
    audio: false
};

async function sendSignalingMessage(message: CallSignalingMessage) {
    if (!authToken) {
        throw new Error("No auth token available");
    }

    console.log("Sending signaling message:", message.type, "to user", message.toUserId);
    
    await request({
        type: "call_signaling",
        credentials: {
            scheme: "Bearer",
            credentials: authToken
        },
        data: message
    });
}

async function getIceServers(): Promise<RTCIceServer[]> {
    const defaultIceServers = [{ urls: "stun:fromchat.ru:3478" }];
    
    if (!authToken) {
        console.warn("No auth token available for ICE servers");
        return defaultIceServers;
    }

    try {
        const response = await fetch("/api/webrtc/ice", {
            headers: getAuthHeaders(authToken)
        });
        
        if (response.ok) {
            const data = await response.json() as IceServersResponse;
            console.log("Received ICE servers:", data.iceServers);
            return data.iceServers || [];
        } else {
            console.warn("Failed to fetch ICE servers:", response.status, response.statusText);
        }
    } catch (error) {
        console.warn("Failed to fetch ICE servers:", error);
    }
    
    // Fallback to STUN only if backend fails
    return defaultIceServers;
}


async function createPeerConnection(userId: number): Promise<RTCPeerConnection> {
    const iceServers = await getIceServers();
    
    const peerConnection = new RTCPeerConnection({
        iceServers
    });

    const call: WebRTCCall = {
        peerConnection,
        localStream: null,
        remoteStream: null,
        isInitiator: false,
        remoteUserId: userId,
        remoteUsername: "",
        isMuted: false,
        isVideoEnabled: false,
        isScreenSharing: false,
        localVideoStream: null,
        localScreenStream: null,
        sessionKey: null,
        sessionCryptoKey: null,
        sessionId: crypto.randomUUID()
    };

    calls.set(userId, call);

    peerConnection.addEventListener("icegatheringstatechange", () => {
        console.log("ICE gathering state changed:", peerConnection.iceGatheringState);
    });

    // Add ICE candidate event listener for debugging and sending
    peerConnection.addEventListener("icecandidate", async (event) => {
        if (event.candidate) {
            console.log("Local ICE candidate:", event.candidate.candidate);
            
            // Send ICE candidate to remote peer
            try {
                await sendSignalingMessage({
                    type: "call_ice_candidate",
                    fromUserId: 0, // Will be set by server
                    toUserId: userId,
                    data: {
                        candidate: event.candidate.candidate,
                        sdpMLineIndex: event.candidate.sdpMLineIndex,
                        sdpMid: event.candidate.sdpMid
                    }
                });
            } catch (error) {
                console.error("Failed to send ICE candidate:", error);
            }
        } else {
            console.log("ICE gathering complete");
        }
    });

    peerConnection.addEventListener("iceconnectionstatechange", () => {
        console.log("ICE connection state changed:", peerConnection.iceConnectionState);
    });

    peerConnection.addEventListener("signalingstatechange", () => {
        // Signaling state changed
    });

    // Handle remote streams (audio and video)
    peerConnection.addEventListener("track", (event) => {
        console.log("🎵🎥 Remote track received:", event.track.kind, "id:", event.track.id, "label:", event.track.label);
        console.log("🎵🎥 Streams available:", event.streams.length);
        const [remoteStream] = event.streams;
        const call = calls.get(userId);
        if (call) {
            if (event.track.kind === 'audio') {
                console.log("🎵 Audio track processing for user", userId);
                call.remoteStream = remoteStream;
                if (onRemoteStream) {
                    onRemoteStream(userId, remoteStream);
                }
            } else if (event.track.kind === 'video') {
                // Handle video stream (both video and screen share)
                console.log("🎥 Video track processing for user", userId);
                console.log("🎥 Video track label:", event.track.label);
                console.log("🎥 Video stream tracks:", remoteStream.getVideoTracks().length);
                console.log("🎥 Video stream audio tracks:", remoteStream.getAudioTracks().length);
                console.log("🎥 onRemoteVideoStream handler available:", !!onRemoteVideoStream);
                
                // Store the remote video stream for this specific track type
                // Screen share tracks typically have different characteristics
                const isScreenShare = event.track.label.includes('screen') || 
                                    event.track.label.includes('display') ||
                                    event.track.label.includes('desktop') ||
                                    remoteStream.getVideoTracks().length > 1; // Multiple video tracks often indicates screen share
                
                if (isScreenShare) {
                    call.remoteScreenStream = remoteStream;
                    console.log("🖥️ Remote screen share stream stored, label:", event.track.label);
                } else {
                    call.remoteVideoStream = remoteStream;
                    console.log("🎥 Remote video stream stored, label:", event.track.label);
                }
                
                if (onRemoteVideoStream) {
                    onRemoteVideoStream(userId, remoteStream);
                } else {
                    console.warn("🎥 No video stream handler available!");
                }
            }
        } else {
            console.warn("🎵🎥 No call found for user", userId);
        }
    });

    // Handle connection state changes
    peerConnection.addEventListener("connectionstatechange", () => {
        console.log("WebRTC connection state changed:", peerConnection.connectionState);
        const call = calls.get(userId);
        if (call) {
            if (onCallStateChange) {
                onCallStateChange(userId, peerConnection.connectionState);
            }

            // Clean up if connection failed or closed
            if (peerConnection.connectionState === "failed" || 
                peerConnection.connectionState === "closed" ||
                peerConnection.connectionState === "disconnected") {
                // Only send end call message if we're not already cleaning up
                const call = calls.get(userId);
                if (call && !call.isEnding) {
                    call.isEnding = true;
                    endCall(userId);
                }
            }
        }
    });

    return peerConnection;
}

export async function initiateCall(userId: number, username: string): Promise<boolean> {
    try {
        // Get user media
        const localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });

        // Create peer connection
        await createPeerConnection(userId);
        const call = calls.get(userId);
        if (!call) return false;

        call.localStream = localStream;
        call.remoteUsername = username;
        call.isInitiator = true;

        // Add tracks to peer connection
        localStream.getTracks().forEach(track => call.peerConnection.addTrack(track, localStream));

        // Enable insertable streams encryption on sender side if supported
        try {
            if (call.peerConnection.getSenders && call.peerConnection.getSenders().length > 0 && window.RTCRtpScriptTransform) {
                const senders = call.peerConnection.getSenders();
                for (const sender of senders) {
                    if (!sender.track || sender.track.kind !== "audio") continue;
                    // just mark; actual key set after wrap/send
                }
            }
        } catch {}

        // Send call invite
        await sendSignalingMessage({
            type: "call_invite",
            fromUserId: 0, // Will be set by server
            toUserId: userId,
            data: { fromUsername: username }
        });

        return true;
    } catch (error) {
        console.error("Failed to initiate call:", error);
        cleanupCall(userId);
        return false;
    }
}

export async function sendCallSessionKey(userId: number, sessionKeyHash: string): Promise<void> {
    try {
        await sendSignalingMessage({
            type: "call_session_key",
            fromUserId: 0, // Will be set by server
            toUserId: userId,
            sessionKeyHash,
            data: {}
        });
    } catch (error) {
        console.error("Failed to send call session key:", error);
    }
}

export async function sendWrappedCallSessionKey(userId: number, sessionKey: Uint8Array, sessionKeyHash: string): Promise<void> {
    if (!authToken) throw new Error("No auth token available");
    try {
        const recipientPublicKey = await fetchUserPublicKey(userId, authToken);
        if (!recipientPublicKey) {
            console.warn("No recipient public key for", userId);
            return;
        }
        const wrapped = await wrapCallSessionKeyForRecipient(recipientPublicKey, sessionKey);
        await sendSignalingMessage({
            type: "call_session_key",
            fromUserId: 0,
            toUserId: userId,
            sessionKeyHash,
            data: { wrappedSessionKey: wrapped }
        });
    } catch (e) {
        console.error("Failed to send wrapped session key:", e);
    }
}

async function applyE2EETransforms(call: WebRTCCall): Promise<void> {
    try {
        // @ts-ignore
        if (!call.sessionKey || !window.RTCRtpScriptTransform) return;
        const key = await importAesGcmKey(call.sessionKey);
        call.sessionCryptoKey = key;
        const receiver = call.peerConnection.getReceivers().find(r => r.track && r.track.kind === 'audio');
        if (receiver) {
            // @ts-ignore
            receiver.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'decrypt' });
        }
        const sender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'audio');
        if (sender) {
            // @ts-ignore
            sender.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'encrypt' });
        }
    } catch {}
}

export async function setSessionKey(userId: number, keyBytes: Uint8Array): Promise<void> {
    const call = calls.get(userId);
    if (!call) return;
    call.sessionKey = keyBytes;
    call.lastKeyRotation = Date.now();
    await applyE2EETransforms(call);
    
    // Start key rotation timer (rotate every 10 minutes for long calls)
    if (call.keyRotationTimer) {
        clearInterval(call.keyRotationTimer);
    }
    
    call.keyRotationTimer = setInterval(async () => {
        await rotateSessionKey(userId);
    }, 10 * 60 * 1000); // 10 minutes
}

/**
 * Rotate the session key for a call to provide forward secrecy
 */
async function rotateSessionKey(userId: number): Promise<void> {
    const call = calls.get(userId);
    if (!call || !call.sessionKey) return;
    
    try {
        console.log("Rotating session key for call", userId);
        
        // Generate new session key
        const currentSessionKey = {
            key: call.sessionKey,
            hash: "" // We'll generate a new hash
        };
        
        const newSessionKey = await rotateCallSessionKey(currentSessionKey);
        
        // Update the call with new session key
        call.sessionKey = newSessionKey.key;
        call.lastKeyRotation = Date.now();
        
        // Reapply E2EE transforms with new key
        await applyE2EETransforms(call);
        
        console.log("Session key rotated successfully for call", userId);
    } catch (error) {
        console.error("Failed to rotate session key:", error);
    }
}

export async function receiveWrappedSessionKey(fromUserId: number, wrappedPayload: any, sessionKeyHash?: string): Promise<void> {
    if (!authToken) return;
    try {
        const senderPublicKey = await fetchUserPublicKey(fromUserId, authToken);
        if (!senderPublicKey) return;
        if (!wrappedPayload || !sessionKeyHash) return;
        
        // First unwrap the session key from the encrypted payload (for validation)
        await unwrapCallSessionKeyFromSender(senderPublicKey, {
            salt: wrappedPayload.salt,
            iv2: wrappedPayload.iv2,
            wrapped: wrappedPayload.wrapped
        });
        
        // Then derive the actual session key from the shared secret
        const call = calls.get(fromUserId);
        const isInitiator = call?.isInitiator ?? false;
        const derivedSessionKey = await createSharedSecretAndDeriveSessionKey(senderPublicKey, sessionKeyHash, isInitiator);
        
        await setSessionKey(fromUserId, derivedSessionKey.key);
    } catch (e) {
        console.error("Failed to unwrap session key:", e);
    }
}

export async function acceptCall(userId: number): Promise<boolean> {
    try {
        let call = calls.get(userId);
        if (!call) {
            // Create call object if it doesn't exist (for race conditions)
            await createPeerConnection(userId);
            call = calls.get(userId);
            if (!call) return false;
        }

        // Get user media and attach
        const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        call.localStream = localStream;
        localStream.getTracks().forEach(track => call!.peerConnection.addTrack(track, localStream));

        // Notify initiator that callee accepted; initiator will generate offer
        await sendSignalingMessage({
            type: "call_accept",
            fromUserId: 0, // Will be set by server
            toUserId: userId,
            data: {}
        });

        return true;
    } catch (error) {
        console.error("Failed to accept call:", error);
        cleanupCall(userId);
        return false;
    }
}

export async function rejectCall(userId: number): Promise<void> {
    await sendSignalingMessage({
        type: "call_reject",
        fromUserId: 0, // Will be set by server
        toUserId: userId,
        data: {}
    });

    cleanupCall(userId);
}

export async function endCall(userId: number): Promise<void> {
    const call = calls.get(userId);
    if (call && !call.isEnding) {
        call.isEnding = true;
        
        // Send call end message
        await sendSignalingMessage({
            type: "call_end",
            fromUserId: 0, // Will be set by server
            toUserId: userId,
            data: {}
        });

        cleanupCall(userId);
    }
}

export async function handleIncomingCall(userId: number, username: string): Promise<void> {
    try {
        // Create peer connection for incoming call
        await createPeerConnection(userId);
        const call = calls.get(userId);
        if (!call) return;

        call.remoteUsername = username;
        call.isInitiator = false;
    } catch (error) {
        console.error("Failed to handle incoming call:", error);
        cleanupCall(userId);
    }
}

export async function onRemoteAccepted(userId: number): Promise<void> {
    const call = calls.get(userId);
    if (!call) {
        throw new Error("No call found to accept");
    }

    try {
        // Create offer
        const offer = await call.peerConnection.createOffer();
        await call.peerConnection.setLocalDescription(offer);

        // Send offer to remote peer
        await sendSignalingMessage({
            type: "call_offer",
            fromUserId: 0, // Will be set by server
            toUserId: userId,
            data: offer
        });
    } catch (error) {
        console.error("Failed to create offer:", error);
        throw error;
    }
}

async function createE2EETransform(sessionKey: NonNullable<WebRTCCall['sessionKey']>, peerConnection: RTCPeerConnection, sessionId?: string): Promise<void> {
    try {
        if (sessionKey && window.RTCRtpScriptTransform) {
            const key = await importAesGcmKey(sessionKey);
            
            // Apply transforms to all audio receivers
            const audioReceivers = peerConnection.getReceivers().filter(r => r.track && r.track.kind === 'audio');
            audioReceivers.forEach(receiver => {
                receiver.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'decrypt', sessionId });
            });
            
            // Apply transforms to all audio senders
            const audioSenders = peerConnection.getSenders().filter(s => s.track && s.track.kind === 'audio');
            audioSenders.forEach(sender => {
                sender.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'encrypt', sessionId });
            });
            
            // Apply transforms to all video receivers (both video and screen share)
            const videoReceivers = peerConnection.getReceivers().filter(r => r.track && r.track.kind === 'video');
            videoReceivers.forEach(receiver => {
                receiver.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'decrypt', sessionId });
            });
            
            // Apply transforms to all video senders (both video and screen share)
            const videoSenders = peerConnection.getSenders().filter(s => s.track && s.track.kind === 'video');
            videoSenders.forEach(sender => {
                sender.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'encrypt', sessionId });
            });
            
            console.log("🔒 E2EE transforms applied to:", {
                audioReceivers: audioReceivers.length,
                audioSenders: audioSenders.length,
                videoReceivers: videoReceivers.length,
                videoSenders: videoSenders.length
            });
        }
    } catch (error) {
        console.error("Failed to create E2EE transform:", error);
        throw error;
    }
}

export async function handleCallOffer(userId: number, offer: RTCSessionDescriptionInit): Promise<void> {
    const call = calls.get(userId);
    if (!call) {
        throw new Error("No call found for offer");
    }

    try {
        // Set remote description
        await call.peerConnection.setRemoteDescription(offer);

        // Create answer
        const answer = await call.peerConnection.createAnswer();
        await call.peerConnection.setLocalDescription(answer);

        // Attach transforms on callee side if session key set and insertable streams supported
        await createE2EETransform(call.sessionKey!, call.peerConnection, call.sessionId);

        // Send answer to remote peer
        await sendSignalingMessage({
            type: "call_answer",
            fromUserId: 0, // Will be set by server
            toUserId: userId,
            data: answer
        });
    } catch (error) {
        console.error("Failed to handle offer:", error);
        throw error;
    }
}

export async function handleCallAnswer(userId: number, answer: RTCSessionDescriptionInit): Promise<void> {
    const call = calls.get(userId);
    if (!call) {
        throw new Error("No call found for answer");
    }

    try {
        await call.peerConnection.setRemoteDescription(answer);
        // After signaling completes, attach transforms on initiator side if supported
        await createE2EETransform(call.sessionKey!, call.peerConnection, call.sessionId);
    } catch (error) {
        console.error("Failed to handle answer:", error);
        throw error;
    }
}

export async function handleIceCandidate(userId: number, candidate: RTCIceCandidateInit): Promise<void> {
    const call = calls.get(userId);
    if (!call) {
        console.warn("No call found for ICE candidate from user", userId);
        return;
    }

    try {
        console.log("Adding ICE candidate from user", userId, ":", candidate);
        await call.peerConnection.addIceCandidate(candidate);
    } catch (error) {
        console.error("Failed to add ICE candidate:", error);
    }
}

export function toggleMute(userId: number): boolean {
    const call = calls.get(userId);
    if (!call || !call.localStream) {
        return false;
    }

    if (!call.isMuted) {
        // Mute: Stop the track completely (no green dot)
        const audioTrack = call.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.stop();
            call.localStream.removeTrack(audioTrack);
        }
        
        // Create a silent audio track using Web Audio API
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Set gain to 0 (silent)
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        
        // Connect nodes
        oscillator.connect(gainNode);
        
        // Create a MediaStreamDestination to get a MediaStream
        const destination = audioContext.createMediaStreamDestination();
        gainNode.connect(destination);
        
        // Start the oscillator (but it's silent due to gain = 0)
        oscillator.start();
        
        // Add the silent track to maintain WebRTC connection
        const silentTrack = destination.stream.getAudioTracks()[0];
        if (silentTrack) {
            call.localStream.addTrack(silentTrack);
        }
        
        call.isMuted = true;
        return true; // Muted
    } else {
        // Unmute: Re-enable microphone by getting new audio stream
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(newStream => {
                // Remove any existing audio tracks from the stream
                call.localStream!.getAudioTracks().forEach(track => track.stop());
                
                // Get the new active track
                const newAudioTrack = newStream.getAudioTracks()[0];
                
                // Replace the track in the peer connection
                const sender = call.peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'audio'
                );
                
                if (sender) {
                    // Replace the track in the existing sender
                    sender.replaceTrack(newAudioTrack);
                } else {
                    // Add the track to the peer connection if no sender exists
                    call.peerConnection.addTrack(newAudioTrack, call.localStream!);
                }
                
                // Add the track to the local stream
                call.localStream!.addTrack(newAudioTrack);
                
                call.isMuted = false;
            })
            .catch(error => {
                console.error("Failed to re-enable microphone:", error);
            });
        return false; // Unmuted
    }
}

export async function toggleVideo(userId: number): Promise<void> {
    const call = calls.get(userId);
    if (!call) return;

    try {
        if (call.isVideoEnabled) {
            // Disable video
            // Find the video sender before clearing the stream
            const videoSender = call.localVideoStream ? 
                call.peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'video' && 
                    call.localVideoStream!.getVideoTracks().some(track => track.id === s.track!.id)
                ) : null;
            
            if (call.localVideoStream) {
                call.localVideoStream.getTracks().forEach(track => track.stop());
                call.localVideoStream = null;
            }
            if (videoSender) {
                console.log("🎥 Removing video track from peer connection");
                await videoSender.replaceTrack(null);
                
                // Trigger renegotiation for removed track
                console.log("🎥 Triggering renegotiation for removed video track");
                if (call.isInitiator) {
                    const offer = await call.peerConnection.createOffer();
                    await call.peerConnection.setLocalDescription(offer);
                    await sendSignalingMessage({
                        type: "call_offer",
                        fromUserId: 0,
                        toUserId: userId,
                        data: offer
                    });
                } else {
                    const answer = await call.peerConnection.createAnswer();
                    await call.peerConnection.setLocalDescription(answer);
                    await sendSignalingMessage({
                        type: "call_answer",
                        fromUserId: 0,
                        toUserId: userId,
                        data: answer
                    });
                }
            }
            
            call.isVideoEnabled = false;
            console.log("Video disabled for call", userId);
            
            // Clear remote video stream reference
            if (call.remoteVideoStream) {
                call.remoteVideoStream = null;
                console.log("🎥 Cleared remote video stream reference");
            }
            
            // Notify state change handler
            if (onCallStateChange) {
                onCallStateChange(userId, "video_disabled");
            }
        } else {
            // Enable video
            console.log("🎥 Enabling video for call", userId);
            const videoStream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
            console.log("🎥 Video stream obtained:", videoStream);
            console.log("🎥 Video tracks in stream:", videoStream.getVideoTracks().length);
            call.localVideoStream = videoStream;
            
            // Add video track to peer connection
            const videoTrack = videoStream.getVideoTracks()[0];
            console.log("🎥 Video track:", videoTrack);
            if (videoTrack) {
                console.log("🎥 Video track label:", videoTrack.label);
                console.log("🎥 Video track enabled:", videoTrack.enabled);
                
                // Find existing video sender (not screen share)
                const videoSender = call.peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'video' && !s.track.label.includes('screen')
                );
                console.log("🎥 Existing video sender:", !!videoSender);
                
                if (videoSender) {
                    console.log("🎥 Replacing track in existing video sender");
                    await videoSender.replaceTrack(videoTrack);
                } else {
                    console.log("🎥 Adding new video track to peer connection");
                    // Create a separate stream for video track to avoid mixing
                    const videoOnlyStream = new MediaStream([videoTrack]);
                    call.peerConnection.addTrack(videoTrack, videoOnlyStream);
                    
                    // Trigger renegotiation for new track
                    console.log("🎥 Triggering renegotiation for new video track");
                    if (call.isInitiator) {
                        const offer = await call.peerConnection.createOffer();
                        await call.peerConnection.setLocalDescription(offer);
                        await sendSignalingMessage({
                            type: "call_offer",
                            fromUserId: 0,
                            toUserId: userId,
                            data: offer
                        });
                    } else {
                        const answer = await call.peerConnection.createAnswer();
                        await call.peerConnection.setLocalDescription(answer);
                        await sendSignalingMessage({
                            type: "call_answer",
                            fromUserId: 0,
                            toUserId: userId,
                            data: answer
                        });
                    }
                }
                
                // Apply E2EE transforms to new video track if available
                if (call.sessionCryptoKey && window.RTCRtpScriptTransform) {
                    // Find the video sender by looking for the track we just added
                    const videoSender = call.peerConnection.getSenders().find(s => 
                        s.track && s.track.kind === 'video' && s.track.id === videoTrack.id
                    );
                    if (videoSender) {
                        videoSender.transform = new RTCRtpScriptTransform(new E2EEWorker(), { 
                            key: call.sessionCryptoKey, 
                            mode: 'encrypt', 
                            sessionId: call.sessionId 
                        });
                        console.log("🎥 E2EE transform applied to video track");
                    }
                }
            } else {
                console.warn("🎥 No video track found in stream!");
            }
            
            call.isVideoEnabled = true;
            console.log("🎥 Video enabled for call", userId);
            
            // Notify state change handler
            if (onCallStateChange) {
                onCallStateChange(userId, "video_enabled");
            }
        }
    } catch (error) {
        console.error("Failed to toggle video:", error);
    }
}

export async function toggleScreenShare(userId: number): Promise<void> {
    const call = calls.get(userId);
    if (!call) return;

    try {
        if (call.isScreenSharing) {
            // Stop screen sharing
            console.log("🖥️ Stopping screen sharing for call", userId);
            
            // Find and remove screen share track by track ID before clearing the stream
            const screenSenders = call.localScreenStream ? 
                call.peerConnection.getSenders().filter(s => 
                    s.track && s.track.kind === 'video' && 
                    call.localScreenStream!.getVideoTracks().some(track => track.id === s.track!.id)
                ) : [];
            
            if (call.localScreenStream) {
                call.localScreenStream.getTracks().forEach(track => track.stop());
                call.localScreenStream = null;
            }
            
            if (screenSenders.length > 0) {
                console.log("🖥️ Removing screen share track from peer connection");
                // Remove screen share track
                for (const sender of screenSenders) {
                    await sender.replaceTrack(null);
                }
                
                // Trigger renegotiation for track removal
                console.log("🖥️ Triggering renegotiation for screen share removal");
                if (call.isInitiator) {
                    const offer = await call.peerConnection.createOffer();
                    await call.peerConnection.setLocalDescription(offer);
                    await sendSignalingMessage({
                        type: "call_offer",
                        fromUserId: 0,
                        toUserId: userId,
                        data: offer
                    });
                } else {
                    const answer = await call.peerConnection.createAnswer();
                    await call.peerConnection.setLocalDescription(answer);
                    await sendSignalingMessage({
                        type: "call_answer",
                        fromUserId: 0,
                        toUserId: userId,
                        data: answer
                    });
                }
            }
            
            call.isScreenSharing = false;
            console.log("🖥️ Screen sharing stopped for call", userId);
            
            // Clear remote screen share stream reference
            if (call.remoteScreenStream) {
                call.remoteScreenStream = null;
                console.log("🖥️ Cleared remote screen share stream reference");
            }
            
            // Notify state change handler
            if (onCallStateChange) {
                onCallStateChange(userId, "screen_share_disabled");
            }
        } else {
            // Start screen sharing
            console.log("🖥️ Starting screen sharing for call", userId);
            const screenStream = await navigator.mediaDevices.getDisplayMedia(SCREEN_CONSTRAINTS);
            call.localScreenStream = screenStream;
            
            // Add screen share track (don't replace video if it exists)
            const screenTrack = screenStream.getVideoTracks()[0];
            if (screenTrack) {
                console.log("🖥️ Adding screen share track to peer connection");
                // Create a separate stream for screen share track to avoid mixing
                const screenOnlyStream = new MediaStream([screenTrack]);
                call.peerConnection.addTrack(screenTrack, screenOnlyStream);
                
                // Trigger renegotiation for new screen track
                console.log("🖥️ Triggering renegotiation for new screen track");
                if (call.isInitiator) {
                    const offer = await call.peerConnection.createOffer();
                    await call.peerConnection.setLocalDescription(offer);
                    await sendSignalingMessage({
                        type: "call_offer",
                        fromUserId: 0,
                        toUserId: userId,
                        data: offer
                    });
                } else {
                    const answer = await call.peerConnection.createAnswer();
                    await call.peerConnection.setLocalDescription(answer);
                    await sendSignalingMessage({
                        type: "call_answer",
                        fromUserId: 0,
                        toUserId: userId,
                        data: answer
                    });
                }
                
                // Apply E2EE transforms to screen share track if available
                if (call.sessionCryptoKey && window.RTCRtpScriptTransform) {
                    // Find the screen share sender by looking for the track we just added
                    const sender = call.peerConnection.getSenders().find(s => 
                        s.track && s.track.kind === 'video' && s.track.id === screenTrack.id
                    );
                    if (sender) {
                        sender.transform = new RTCRtpScriptTransform(new E2EEWorker(), { 
                            key: call.sessionCryptoKey, 
                            mode: 'encrypt', 
                            sessionId: call.sessionId 
                        });
                        console.log("🖥️ E2EE transform applied to screen share track");
                    }
                }
            }
            
            call.isScreenSharing = true;
            console.log("🖥️ Screen sharing started for call", userId);
            
            // Notify state change handler
            if (onCallStateChange) {
                onCallStateChange(userId, "screen_share_enabled");
            }
            
            // Handle screen share end (user clicks "Stop sharing" in browser)
            screenStream.getVideoTracks()[0].addEventListener('ended', () => {
                toggleScreenShare(userId);
            });
        }
    } catch (error) {
        console.error("Failed to toggle screen sharing:", error);
    }
}

export function getCall(userId: number): WebRTCCall | undefined {
    return calls.get(userId);
}

export function cleanupCall(userId: number): void {
    const call = calls.get(userId);
    if (call) {
        // Clear key rotation timer
        if (call.keyRotationTimer) {
            clearInterval(call.keyRotationTimer);
        }
        
        // Close peer connection
        if (call.peerConnection) {
            call.peerConnection.close();
        }

        // Stop all local streams
        if (call.localStream) {
            call.localStream.getTracks().forEach(track => track.stop());
        }
        if (call.localVideoStream) {
            call.localVideoStream.getTracks().forEach(track => track.stop());
        }
        if (call.localScreenStream) {
            call.localScreenStream.getTracks().forEach(track => track.stop());
        }

        // Clear remote streams (these are references, not tracks we own)
        if (call.remoteStream) {
            call.remoteStream = null;
        }
        if (call.remoteVideoStream) {
            call.remoteVideoStream = null;
        }
        if (call.remoteScreenStream) {
            call.remoteScreenStream = null;
        }

        calls.delete(userId);
    }
}

export function cleanup(): void {
    // Clean up all calls
    for (const userId of calls.keys()) {
        cleanupCall(userId);
    }
    calls.clear();
}