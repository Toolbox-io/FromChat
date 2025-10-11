import { getAuthHeaders } from "@/core/api/authApi";
import type { CallSignalingMessage, IceServersResponse } from "@/core/types";
import { request } from "@/core/websocket";
import { wrapCallSessionKeyForRecipient, unwrapCallSessionKeyFromSender, rotateCallSessionKey } from "./encryption";
import { fetchUserPublicKey } from "@/core/api/dmApi";
import { importAesGcmKey } from "@/utils/crypto/symmetric";
import E2EEWorker from "./e2eeWorker?worker";

export interface WebRTCCall {
    peerConnection: RTCPeerConnection;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    localVideoStream: MediaStream | null;
    screenShareStream: MediaStream | null;
    isInitiator: boolean;
    remoteUserId: number;
    remoteUsername: string;
    isEnding?: boolean;
    isMuted?: boolean;
    isLocalVideoEnabled: boolean;
    isScreenSharing: boolean;
    isNegotiating?: boolean;
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
export let onLocalVideoStream: ((userId: number, stream: MediaStream | null) => void) | null = null;
export let onRemoteVideoStream: ((userId: number, stream: MediaStream | null) => void) | null = null;
export let onLocalScreenShare: ((userId: number, stream: MediaStream | null) => void) | null = null;
export let onRemoteScreenShare: ((userId: number, stream: MediaStream | null) => void) | null = null;
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

export function setLocalVideoStreamHandler(handler: (userId: number, stream: MediaStream | null) => void) {
    onLocalVideoStream = handler;
}

export function setRemoteVideoStreamHandler(handler: (userId: number, stream: MediaStream | null) => void) {
    onRemoteVideoStream = handler;
}

export function setLocalScreenShareHandler(handler: (userId: number, stream: MediaStream | null) => void) {
    onLocalScreenShare = handler;
}

export function setRemoteScreenShareHandler(handler: (userId: number, stream: MediaStream | null) => void) {
    onRemoteScreenShare = handler;
}

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
        localVideoStream: null,
        screenShareStream: null,
        isInitiator: false,
        remoteUserId: userId,
        remoteUsername: "",
        isMuted: false,
        isLocalVideoEnabled: false,
        isScreenSharing: false,
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
        console.log("Signaling state changed:", peerConnection.signalingState);
    });

    // Handle renegotiation when tracks are added/removed
    peerConnection.addEventListener("negotiationneeded", async () => {
        try {
            console.log("Negotiation needed for user", userId);
            const call = calls.get(userId);
            if (!call) {
                console.log("Skipping renegotiation - call not found");
                return;
            }

            // Prevent multiple simultaneous negotiations
            if (call.isNegotiating) {
                console.log("Already negotiating, skipping");
                return;
            }

            // Skip if we're in "stable" state and haven't finished the initial handshake
            if (peerConnection.signalingState !== "stable") {
                console.log("Skipping renegotiation - signaling state is", peerConnection.signalingState);
                return;
            }

            call.isNegotiating = true;
            console.log("Creating new offer for renegotiation (signalingState:", peerConnection.signalingState + ")");
            
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            console.log("Sending renegotiation offer to user", userId);
            await sendSignalingMessage({
                type: "call_offer",
                fromUserId: 0,
                toUserId: userId,
                data: offer
            });

            call.isNegotiating = false;
        } catch (error) {
            console.error("Failed to handle negotiation:", error);
            const call = calls.get(userId);
            if (call) {
                call.isNegotiating = false;
            }
        }
    });

    // Handle remote stream
    peerConnection.addEventListener("track", async (event) => {
        console.log("Received track:", event.track.kind, "from user", userId, "stream ID:", event.streams[0]?.id);
        
        const [remoteStream] = event.streams;
        const call = calls.get(userId);
        if (call && remoteStream) {
            const track = event.track;
            
            // Apply E2EE transform to the receiver for this new track if session key is available
            // Currently disabled for video tracks due to counter synchronization issues
            if (call.sessionKey && window.RTCRtpScriptTransform && track.kind === "audio") {
                try {
                    const key = await importAesGcmKey(call.sessionKey);
                    const receiver = call.peerConnection.getReceivers().find(r => r.track === track);
                    if (receiver) {
                        console.log(`Applying decrypt transform to newly received ${track.kind} track`);
                        // @ts-ignore
                        receiver.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'decrypt', sessionId: call.sessionId });
                    }
                } catch (error) {
                    console.error("Failed to apply E2EE to received track:", error);
                }
            }
            
            // Determine stream type based on track kind and stream ID
            const streamId = remoteStream.id;
            
            // Check if this is a screen share stream (we'll use a convention: screen share streams have "screen" in their ID)
            if (streamId.includes("screen")) {
                console.log("Detected screen share track, notifying handler");
                // Handle remote screen share
                if (onRemoteScreenShare) {
                    onRemoteScreenShare(userId, remoteStream);
                }
            } else if (track.kind === "video") {
                console.log("Detected video track, notifying handler");
                // Handle remote video
                if (onRemoteVideoStream) {
                    onRemoteVideoStream(userId, remoteStream);
                }
            } else if (track.kind === "audio") {
                console.log("Detected audio track, notifying handler");
                // Handle remote audio (existing behavior)
                call.remoteStream = remoteStream;
                if (onRemoteStream) {
                    onRemoteStream(userId, remoteStream);
                }
            }
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

            // Clean up only on permanent failures
            // Don't end on "disconnected" - ICE can recover from temporary disconnections
            if (peerConnection.connectionState === "failed" || 
                peerConnection.connectionState === "closed") {
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
        if (!call.sessionKey || !window.RTCRtpScriptTransform) {
            console.log("Skipping E2EE transforms - session key or RTCRtpScriptTransform not available");
            return;
        }
        
        console.log("Applying E2EE transforms for call", call.remoteUserId);
        const key = await importAesGcmKey(call.sessionKey);
        call.sessionCryptoKey = key;
        
        // Apply to audio receivers only (video E2EE requires synchronized counters)
        const receivers = call.peerConnection.getReceivers();
        for (const receiver of receivers) {
            if (receiver.track && receiver.track.kind === "audio") {
                console.log(`Applying decrypt transform to ${receiver.track.kind} receiver`);
                // @ts-ignore
                receiver.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'decrypt', sessionId: call.sessionId });
            }
        }
        
        // Apply to audio senders only (video E2EE requires synchronized counters)
        const senders = call.peerConnection.getSenders();
        for (const sender of senders) {
            if (sender.track && sender.track.kind === "audio") {
                console.log(`Applying encrypt transform to ${sender.track.kind} sender`);
                // @ts-ignore
                sender.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'encrypt', sessionId: call.sessionId });
            }
        }
    } catch (error) {
        console.error("Failed to apply E2EE transforms:", error);
    }
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
        
        // Unwrap the session key from the encrypted payload
        const unwrappedSessionKey = await unwrapCallSessionKeyFromSender(senderPublicKey, {
            salt: wrappedPayload.salt,
            iv2: wrappedPayload.iv2,
            wrapped: wrappedPayload.wrapped
        });
        
        // Use the unwrapped session key directly (both sides should have the same key)
        await setSessionKey(fromUserId, unwrappedSessionKey);
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

        // Get user media and attach (only if not already attached)
        if (!call.localStream) {
            const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            call.localStream = localStream;
            localStream.getTracks().forEach(track => call!.peerConnection.addTrack(track, localStream));
        }

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
        // Small delay to ensure remote peer finishes processing the accept
        // This prevents race conditions where our offer arrives before they're ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
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
        // @ts-ignore
        if (!sessionKey || !window.RTCRtpScriptTransform) {
            console.log("Skipping E2EE transform in createE2EETransform - not supported or no session key");
            return;
        }
        
        console.log("Creating E2EE transform with sessionId:", sessionId);
        const key = await importAesGcmKey(sessionKey);
        
        // Apply to audio receivers only (video E2EE requires synchronized counters)
        const receivers = peerConnection.getReceivers();
        for (const receiver of receivers) {
            if (receiver.track && receiver.track.kind === "audio") {
                console.log(`Applying decrypt transform to ${receiver.track.kind} in createE2EETransform`);
                // @ts-ignore
                receiver.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'decrypt', sessionId });
            }
        }
        
        // Apply to audio senders only (video E2EE requires synchronized counters)
        const senders = peerConnection.getSenders();
        for (const sender of senders) {
            if (sender.track && sender.track.kind === "audio") {
                console.log(`Applying encrypt transform to ${sender.track.kind} in createE2EETransform`);
                // @ts-ignore
                sender.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'encrypt', sessionId });
            }
        }
    } catch (error) {
        console.error("Failed to create E2EE transform:", error);
        // Don't throw - let the call continue without E2EE
    }
}

export async function handleCallOffer(userId: number, offer: RTCSessionDescriptionInit): Promise<void> {
    let call = calls.get(userId);
    
    console.log("handleCallOffer called for user", userId, "offer type:", offer.type);
    
    // Handle race condition - offer might arrive before peer connection is created
    if (!call) {
        console.log("No call found for offer, creating peer connection (race condition handling)");
        await createPeerConnection(userId);
        call = calls.get(userId);
        if (!call) {
            throw new Error("Failed to create call for offer");
        }
    }

    try {
        // Ensure we have local media before answering
        if (!call.localStream) {
            console.log("Getting local media for answer");
            try {
                const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                call.localStream = localStream;
                localStream.getTracks().forEach(track => call!.peerConnection.addTrack(track, localStream));
            } catch (mediaError) {
                console.error("Failed to get local media:", mediaError);
                // Continue anyway - we can still receive media
            }
        }

        console.log("Setting remote description with", offer.sdp?.split('\n').filter(l => l.includes('m=')).join(', '));

        // Set remote description
        await call.peerConnection.setRemoteDescription(offer);

        console.log("Creating answer...");
        // Create answer
        const answer = await call.peerConnection.createAnswer();
        await call.peerConnection.setLocalDescription(answer);

        console.log("Answer created with", answer.sdp?.split('\n').filter(l => l.includes('m=')).join(', '));

        // Attach transforms on callee side if session key is available
        // If not available yet, setSessionKey will apply them when it arrives
        if (call.sessionKey) {
            await createE2EETransform(call.sessionKey, call.peerConnection, call.sessionId);
        } else {
            console.log("Session key not yet available in handleCallOffer - will apply transforms when key arrives");
        }

        // Send answer to remote peer
        await sendSignalingMessage({
            type: "call_answer",
            fromUserId: 0, // Will be set by server
            toUserId: userId,
            data: answer
        });
        
        console.log("Answer sent successfully");
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
        
        // Reset negotiating flag
        call.isNegotiating = false;
        
        // Attach transforms on initiator side if session key is available
        // If not available yet, setSessionKey will apply them when it arrives
        if (call.sessionKey) {
            await createE2EETransform(call.sessionKey, call.peerConnection, call.sessionId);
        } else {
            console.log("Session key not yet available in handleCallAnswer - will apply transforms when key arrives");
        }
    } catch (error) {
        console.error("Failed to handle answer:", error);
        throw error;
    }
}

export async function handleIceCandidate(userId: number, candidate: RTCIceCandidateInit): Promise<void> {
    let call = calls.get(userId);
    if (!call) {
        console.warn("No call found for ICE candidate from user", userId, "- might arrive before connection setup");
        // Don't create peer connection here - ICE candidates will be gathered again after connection is established
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

export function getCall(userId: number): WebRTCCall | undefined {
    return calls.get(userId);
}

export async function toggleVideo(userId: number): Promise<boolean> {
    const call = calls.get(userId);
    if (!call) {
        return false;
    }

    if (!call.isLocalVideoEnabled) {
        // Enable video
        try {
            const videoStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });

            call.localVideoStream = videoStream;
            call.isLocalVideoEnabled = true;

            // Add video track to peer connection
            const videoTrack = videoStream.getVideoTracks()[0];
            call.peerConnection.addTrack(videoTrack, videoStream);

            console.log("Video track added successfully");
            console.log("Current senders:", call.peerConnection.getSenders().map(s => s.track?.kind));
            console.log("Current transceivers:", call.peerConnection.getTransceivers().map(t => ({
                sender: t.sender.track?.kind,
                receiver: t.receiver.track?.kind,
                direction: t.direction
            })));

            // Note: E2EE for video is temporarily disabled for testing
            // Will re-enable with proper counter synchronization
            console.log("Video sent without E2EE (will implement synchronized encryption)");

            // Notify local video stream handler
            if (onLocalVideoStream) {
                console.log("Calling onLocalVideoStream handler with stream:", videoStream);
                onLocalVideoStream(userId, videoStream);
            } else {
                console.warn("onLocalVideoStream handler is not set!");
            }

            // Send signaling message to notify remote peer
            console.log("Sending call_video_toggle with enabled: true");
            await sendSignalingMessage({
                type: "call_video_toggle",
                fromUserId: 0,
                toUserId: userId,
                data: { enabled: true }
            });

            console.log("Video enabled successfully");
            return true;
        } catch (error) {
            console.error("Failed to enable video:", error);
            return false;
        }
    } else {
        // Disable video
        if (call.localVideoStream) {
            call.localVideoStream.getTracks().forEach(track => {
                track.stop();
                // Remove track from peer connection
                const senders = call.peerConnection.getSenders();
                const videoSender = senders.find(s => s.track === track);
                if (videoSender) {
                    call.peerConnection.removeTrack(videoSender);
                }
            });
            call.localVideoStream = null;
        }

        call.isLocalVideoEnabled = false;

        // Notify local video stream handler
        if (onLocalVideoStream) {
            onLocalVideoStream(userId, null);
        }

        // Send signaling message to notify remote peer
        await sendSignalingMessage({
            type: "call_video_toggle",
            fromUserId: 0,
            toUserId: userId,
            data: { enabled: false }
        });

        return false;
    }
}

export async function toggleScreenShare(userId: number): Promise<boolean> {
    const call = calls.get(userId);
    if (!call) {
        return false;
    }

    if (!call.isScreenSharing) {
        // Enable screen sharing
        try {
            // @ts-ignore - getDisplayMedia might not be in all TypeScript versions
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false
            });

            // Set a special ID to identify screen share streams
            Object.defineProperty(screenStream, "id", {
                value: `screen-${crypto.randomUUID()}`,
                writable: false
            });

            call.screenShareStream = screenStream;
            call.isScreenSharing = true;

            // Add screen share track to peer connection
            const videoTrack = screenStream.getVideoTracks()[0];
            
            // Handle when user stops sharing via browser UI
            videoTrack.addEventListener("ended", () => {
                toggleScreenShare(userId);
            });

            call.peerConnection.addTrack(videoTrack, screenStream);

            console.log("Screen share track added successfully");

            // Note: E2EE for screen share is temporarily disabled for testing
            // Will re-enable with proper counter synchronization
            console.log("Screen share sent without E2EE (will implement synchronized encryption)");

            // Notify local screen share handler
            if (onLocalScreenShare) {
                onLocalScreenShare(userId, screenStream);
            }

            // Send signaling message to notify remote peer
            await sendSignalingMessage({
                type: "call_screen_share_toggle",
                fromUserId: 0,
                toUserId: userId,
                data: { enabled: true }
            });

            return true;
        } catch (error) {
            console.error("Failed to enable screen sharing:", error);
            return false;
        }
    } else {
        // Disable screen sharing
        if (call.screenShareStream) {
            call.screenShareStream.getTracks().forEach(track => {
                track.stop();
                // Remove track from peer connection
                const senders = call.peerConnection.getSenders();
                const screenSender = senders.find(s => s.track === track);
                if (screenSender) {
                    call.peerConnection.removeTrack(screenSender);
                }
            });
            call.screenShareStream = null;
        }

        call.isScreenSharing = false;

        // Notify local screen share handler
        if (onLocalScreenShare) {
            onLocalScreenShare(userId, null);
        }

        // Send signaling message to notify remote peer
        await sendSignalingMessage({
            type: "call_screen_share_toggle",
            fromUserId: 0,
            toUserId: userId,
            data: { enabled: false }
        });

        return false;
    }
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

        // Stop local stream
        if (call.localStream) {
            call.localStream.getTracks().forEach(track => track.stop());
        }

        // Stop local video stream
        if (call.localVideoStream) {
            call.localVideoStream.getTracks().forEach(track => track.stop());
        }

        // Stop screen share stream
        if (call.screenShareStream) {
            call.screenShareStream.getTracks().forEach(track => track.stop());
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