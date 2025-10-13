import { getAuthHeaders } from "@/core/api/authApi";
import type { CallSignalingMessage, IceServersResponse, WrappedSessionKeyPayload } from "@/core/types";
import { request } from "@/core/websocket";
import { wrapCallSessionKeyForRecipient, unwrapCallSessionKeyFromSender, rotateCallSessionKey } from "./encryption";
import { fetchUserPublicKey } from "@/core/api/dmApi";
import { importAesGcmKey } from "@/utils/crypto/symmetric";
import E2EEWorker from "./e2eeWorker?worker";
import { delay } from "@/utils/utils";

// Constants
const DEFAULT_ICE_SERVERS = [{ urls: "stun:fromchat.ru:3478" }];
const KEY_ROTATION_INTERVAL = 10 * 60 * 1000; // 10 minutes
const NEGOTIATION_DELAY = 100; // ms

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
    isRemoteScreenSharing: boolean; // Track remote screen share state from signaling
    isRemoteVideoEnabled: boolean; // Track remote video state from signaling
    isNegotiating?: boolean;
    // Insertable Streams E2EE
    sessionKey?: Uint8Array | null;
    sessionCryptoKey?: CryptoKey | null;
    sessionId: string;
    keyRotationTimer?: NodeJS.Timeout;
    lastKeyRotation?: number;
    transformedSenders: Set<RTCRtpSender>;
    transformedReceivers: Set<RTCRtpReceiver>;
    // Track specific senders for proper routing when both video and screen share are active
    videoSender?: RTCRtpSender | null;
    screenShareSender?: RTCRtpSender | null;
    // Track the number of video tracks received for each type
    receivedVideoTrackCount: number;
    receivedScreenShareTrackCount: number;
}

// Global state
export let authToken: string | null = null;
export let onCallStateChange: ((userId: number, state: string) => void) | null = null;
export let onRemoteStream: ((userId: number, stream: MediaStream) => void) | null = null;
export let onLocalVideoStream: ((userId: number, stream: MediaStream | null) => void) | null = null;
export let onRemoteVideoStream: ((userId: number, stream: MediaStream | null) => void) | null = null;
export let onLocalScreenShare: ((userId: number, stream: MediaStream | null) => void) | null = null;
export let onRemoteScreenShare: ((userId: number, stream: MediaStream | null) => void) | null = null;
export let onScreenShareStateChange: ((userId: number, isSharing: boolean) => void) | null = null;
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

/**
 * Sends a signaling message via WebSocket
 */
async function sendSignalingMessage(message: CallSignalingMessage) {
    if (!authToken) {
        throw new Error("No auth token available");
    }
    
    await request({
        type: "call_signaling",
        credentials: {
            scheme: "Bearer",
            credentials: authToken
        },
        data: message
    });
}

/**
 * Fetches ICE servers from the backend, with fallback to default STUN server
 */
async function getIceServers(): Promise<RTCIceServer[]> {
    if (!authToken) {
        console.warn("No auth token available for ICE servers");
        return DEFAULT_ICE_SERVERS;
    }

    try {
        const response = await fetch("/api/webrtc/ice", {
            headers: getAuthHeaders(authToken)
        });
        
        if (response.ok) {
            const data = await response.json() as IceServersResponse;
            return data.iceServers || [];
        } else {
            console.warn("Failed to fetch ICE servers:", response.status, response.statusText);
        }
    } catch (error) {
        console.warn("Failed to fetch ICE servers:", error);
    }
    
    // Fallback to STUN only if backend fails
    return DEFAULT_ICE_SERVERS;
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
        isRemoteScreenSharing: false,
        isRemoteVideoEnabled: false,
        sessionKey: null,
        sessionCryptoKey: null,
        sessionId: crypto.randomUUID(),
        transformedSenders: new Set(),
        transformedReceivers: new Set(),
        receivedVideoTrackCount: 0,
        receivedScreenShareTrackCount: 0
    };

    calls.set(userId, call);

    // Add ICE candidate event listener for sending
    peerConnection.addEventListener("icecandidate", async (event) => {
        if (event.candidate) {
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
        }
    });

    peerConnection.addEventListener("iceconnectionstatechange", () => {
        // ICE connection state changed
    });

    peerConnection.addEventListener("signalingstatechange", () => {
        // Signaling state changed
    });

    // Handle renegotiation when tracks are added/removed
    peerConnection.addEventListener("negotiationneeded", async () => {
        try {
            const call = calls.get(userId);
            if (!call) {
                return;
            }

            // Prevent multiple simultaneous negotiations
            if (call.isNegotiating) {
                return;
            }

            // Skip if we're in "stable" state and haven't finished the initial handshake
            if (peerConnection.signalingState !== "stable") {
                return;
            }

            call.isNegotiating = true;
            
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            await sendSignalingMessage({
                type: "call_offer",
                fromUserId: 0, // Will be set by server
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
        const [remoteStream] = event.streams;
        const call = calls.get(userId);
        if (call && remoteStream) {
            const track = event.track;
            
            // Apply E2EE transform to all tracks - video now uses header-preserving encryption
            if (call.sessionKey && window.RTCRtpScriptTransform) {
                try {
                    const receiver = call.peerConnection.getReceivers().find(r => r.track === track);
                    if (receiver && !call.transformedReceivers.has(receiver)) {
                        const key = await importAesGcmKey(call.sessionKey);
                        receiver.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'decrypt', sessionId: call.sessionId });
                        call.transformedReceivers.add(receiver);
                    }
                } catch (error) {
                    console.error("Failed to apply E2EE to received track:", error);
                }
            }
            
            // Determine stream type based on track kind and signaling state
            if (track.kind === "video") {
                let isScreenShare = false;
                let isVideo = false;
                
                if (call.isRemoteScreenSharing && call.isRemoteVideoEnabled) {
                    // Both active - route based on which one we haven't received yet
                    // Simple logic: if we haven't received video yet, this is video
                    // if we haven't received screen share yet, this is screen share
                    if (call.receivedVideoTrackCount === 0) {
                        isVideo = true;
                        call.receivedVideoTrackCount++;
                    } else if (call.receivedScreenShareTrackCount === 0) {
                        isScreenShare = true;
                        call.receivedScreenShareTrackCount++;
                    } else {
                        // Both already received - this might be a track replacement
                        isScreenShare = true;
                    }
                } else if (call.isRemoteScreenSharing) {
                    isScreenShare = true;
                    call.receivedScreenShareTrackCount++;
                } else if (call.isRemoteVideoEnabled) {
                    isVideo = true;
                    call.receivedVideoTrackCount++;
                }
                
                if (isScreenShare) {
                    if (onRemoteScreenShare) {
                        onRemoteScreenShare(userId, remoteStream);
                    }
                } else if (isVideo) {
                    if (onRemoteVideoStream) {
                        onRemoteVideoStream(userId, remoteStream);
                    }
                }
            } else if (track.kind === "audio") {
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
        // WebRTC connection state changed
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

/**
 * Initiates a call to the specified user
 * @param userId - The ID of the user to call
 * @param username - The username of the user to call
 * @returns Promise that resolves to true if call was initiated successfully
 */
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
            data: { 
                fromUsername: username 
            }
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
        if (!call.sessionKey || !window.RTCRtpScriptTransform) {
            return;
        }
        
        const key = await importAesGcmKey(call.sessionKey);
        call.sessionCryptoKey = key;
        
        // Apply to receivers that don't already have transforms
        const receivers = call.peerConnection.getReceivers();
        for (const receiver of receivers) {
            if (receiver.track && !call.transformedReceivers.has(receiver)) {
                receiver.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'decrypt', sessionId: call.sessionId });
                call.transformedReceivers.add(receiver);
            }
        }
        
        // Apply to senders that don't already have transforms
        const senders = call.peerConnection.getSenders();
        for (const sender of senders) {
            if (sender.track && !call.transformedSenders.has(sender)) {
                sender.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'encrypt', sessionId: call.sessionId });
                call.transformedSenders.add(sender);
            }
        }
    } catch (error) {
        console.error("Failed to apply E2EE transforms:", error);
    }
}

export async function setSessionKey(userId: number, keyBytes: Uint8Array): Promise<void> {
    const call = calls.get(userId);
    if (!call) {
        console.error("setSessionKey: No call found for user", userId);
        return;
    }
    
    call.sessionKey = keyBytes;
    call.lastKeyRotation = Date.now();
    
    await applyE2EETransforms(call);
    
    // Start key rotation timer (rotate every 10 minutes for long calls)
    if (call.keyRotationTimer) {
        clearInterval(call.keyRotationTimer);
    }
    
    call.keyRotationTimer = setInterval(async () => {
        await rotateSessionKey(userId);
    }, KEY_ROTATION_INTERVAL);
}

/**
 * Rotate the session key for a call to provide forward secrecy
 */
async function rotateSessionKey(userId: number): Promise<void> {
    const call = calls.get(userId);
    if (!call || !call.sessionKey) return;
    
    try {
        // Generate new session key
        const newSessionKey = await rotateCallSessionKey();
        
        // Update the call with new session key
        call.sessionKey = newSessionKey.key;
        call.lastKeyRotation = Date.now();
        
        // Reapply E2EE transforms with new key
        await applyE2EETransforms(call);
    } catch (error) {
        console.error("Failed to rotate session key:", error);
    }
}

export async function receiveWrappedSessionKey(fromUserId: number, wrappedPayload: WrappedSessionKeyPayload, sessionKeyHash?: string): Promise<void> {
    if (!authToken) return;
    try {
        const senderPublicKey = await fetchUserPublicKey(fromUserId, authToken);
        if (!senderPublicKey) {
            console.error("Failed to get sender public key");
            return;
        }
        if (!wrappedPayload || !sessionKeyHash) {
            console.error("Missing wrapped payload or session key hash");
            return;
        }
        
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

/**
 * Accepts an incoming call from the specified user
 * @param userId - The ID of the user who initiated the call
 * @returns Promise that resolves to true if call was accepted successfully
 */
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
        await delay(NEGOTIATION_DELAY);
        
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

async function createE2EETransform(call: WebRTCCall, sessionKey: Uint8Array, sessionId?: string): Promise<void> {
    try {
        if (!sessionKey || !window.RTCRtpScriptTransform) {
            return;
        }
        
        const key = await importAesGcmKey(sessionKey);
        
        // Apply to receivers that don't already have transforms
        const receivers = call.peerConnection.getReceivers();
        for (const receiver of receivers) {
            if (receiver.track && !call.transformedReceivers.has(receiver)) {
                receiver.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'decrypt', sessionId });
                call.transformedReceivers.add(receiver);
            }
        }
        
        // Apply to senders that don't already have transforms
        const senders = call.peerConnection.getSenders();
        for (const sender of senders) {
            if (sender.track && !call.transformedSenders.has(sender)) {
                sender.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'encrypt', sessionId });
                call.transformedSenders.add(sender);
            }
        }
    } catch (error) {
        console.error("Failed to create E2EE transform:", error);
        // Fail securely - throw to prevent call from continuing without E2EE
        throw error;
    }
}

export async function handleCallOffer(userId: number, offer: RTCSessionDescriptionInit): Promise<void> {
    let call = calls.get(userId);
    
    // Handle race condition - offer might arrive before peer connection is created
    if (!call) {
        await createPeerConnection(userId);
        call = calls.get(userId);
        if (!call) {
            throw new Error("Failed to create call for offer");
        }
    }

    try {
        // Ensure we have local media before answering
        if (!call.localStream) {
            try {
                const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                call.localStream = localStream;
                localStream.getTracks().forEach(track => call!.peerConnection.addTrack(track, localStream));
            } catch (mediaError) {
                console.error("Failed to get local media:", mediaError);
                // Continue anyway - we can still receive media
            }
        }

        // Set remote description
        await call.peerConnection.setRemoteDescription(offer);

        // Create answer
        const answer = await call.peerConnection.createAnswer();
        await call.peerConnection.setLocalDescription(answer);

        // Attach transforms on callee side if session key is available
        // If not available yet, setSessionKey will apply them when it arrives
        if (call.sessionKey) {
            await createE2EETransform(call, call.sessionKey, call.sessionId);
        }

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
        
        // Reset negotiating flag
        call.isNegotiating = false;
        
        // Attach transforms on initiator side if session key is available
        // If not available yet, setSessionKey will apply them when it arrives
        if (call.sessionKey) {
            await createE2EETransform(call, call.sessionKey, call.sessionId);
        }
        
        // Check if there are new receivers with tracks that haven't been notified yet
        // This handles the case where tracks exist but the track event hasn't fired yet
        const receivers = call.peerConnection.getReceivers();
        for (const receiver of receivers) {
            if (receiver.track) {
                const track = receiver.track;
                
                // Find the stream for this track
                const transceiver = call.peerConnection.getTransceivers().find(t => t.receiver === receiver);
                if (transceiver && transceiver.receiver.track) {
                    // Manually trigger stream handlers for tracks that didn't fire events
                    if (track.kind === "video" && onRemoteVideoStream) {
                        // Create a MediaStream from the track
                        const stream = new MediaStream([track]);
                        onRemoteVideoStream(userId, stream);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Failed to handle answer:", error);
        throw error;
    }
}

export async function handleIceCandidate(userId: number, candidate: RTCIceCandidateInit): Promise<void> {
    let call = calls.get(userId);
    if (!call) {
        // Don't create peer connection here - ICE candidates will be gathered again after connection is established
        return;
    }

    try {
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
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioContext = new AudioContextClass();
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
            const sender = call.peerConnection.addTrack(videoTrack, videoStream);
            call.videoSender = sender;

            // Apply E2EE transform with header-preserving encryption for video
            if (call.sessionKey && window.RTCRtpScriptTransform) {
                try {
                    const key = await importAesGcmKey(call.sessionKey);
                    const sender = call.peerConnection.getSenders().find(s => s.track === videoTrack);
                    if (sender && !call.transformedSenders.has(sender)) {
                        sender.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: "encrypt", sessionId: call.sessionId });
                        call.transformedSenders.add(sender);
                    }
                } catch (error) {
                    console.error("Failed to apply E2EE to video:", error);
                    throw error; // Fail securely
                }
            }

            // Notify local video stream handler
            if (onLocalVideoStream) {
                onLocalVideoStream(userId, videoStream);
            }

            // Send signaling message to notify remote peer
            await sendSignalingMessage({
                type: "call_video_toggle",
                fromUserId: 0,
                toUserId: userId,
                data: { enabled: true }
            });

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
                    call.transformedSenders.delete(videoSender);
                    // Clear sender reference
                    if (call.videoSender === videoSender) {
                        call.videoSender = null;
                    }
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
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: { ideal: 1920, max: 3840 },
                    height: { ideal: 1080, max: 2160 },
                    frameRate: { ideal: 60, max: 60 }
                },
                audio: false
            });

            // Set a special ID to identify screen share streams
            try {
                Object.defineProperty(screenStream, "id", {
                    value: `screen-${crypto.randomUUID()}`,
                    writable: false,
                    configurable: true
                });
            } catch (e) {
                // Use default stream ID
            }

            call.screenShareStream = screenStream;
            call.isScreenSharing = true;

            // Add screen share track to peer connection
            const videoTrack = screenStream.getVideoTracks()[0];
            
            // Handle when user stops sharing via browser UI
            videoTrack.addEventListener("ended", async () => {
                
                // Clean up screen share state
                if (call.screenShareStream) {
                    call.screenShareStream.getTracks().forEach(t => t.stop());
                    call.screenShareStream = null;
                }
                call.isScreenSharing = false;

                // Remove screen share track from peer connection
                const senders = call.peerConnection.getSenders();
                const screenSender = senders.find(sender => 
                    sender.track && sender.track.kind === 'video' && 
                    sender.track.readyState === 'ended' &&
                    call.transformedSenders.has(sender)
                );
                
                if (screenSender) {
                    await call.peerConnection.removeTrack(screenSender);
                    call.transformedSenders.delete(screenSender);
                }

                // Notify local screen share handler
                if (onLocalScreenShare) {
                    onLocalScreenShare(userId, null);
                }

                // Notify state change handler
                if (onScreenShareStateChange) {
                    onScreenShareStateChange(userId, false);
                }

                // Send signaling message to remote peer
                await sendSignalingMessage({
                    type: "call_screen_share_toggle",
                    fromUserId: 0, // Will be set by server
                    toUserId: userId,
                    data: { enabled: false }
                });
            });

            // Send signaling message FIRST to notify remote peer before adding track
            // This ensures the receiver knows it's screen share before the track arrives
            await sendSignalingMessage({
                type: "call_screen_share_toggle",
                fromUserId: 0,
                toUserId: userId,
                data: { enabled: true }
            });

            // Small delay to ensure signaling message is processed before track arrives
            await delay(NEGOTIATION_DELAY);

            const sender = call.peerConnection.addTrack(videoTrack, screenStream);
            call.screenShareSender = sender;

            // CRITICAL: Apply E2EE transform IMMEDIATELY after track is added
            if (call.sessionKey && window.RTCRtpScriptTransform) {
                try {
                    const key = await importAesGcmKey(call.sessionKey);
                    const sender = call.peerConnection.getSenders().find(s => s.track === videoTrack);
                    
                    if (sender && !call.transformedSenders.has(sender)) {
                        sender.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: "encrypt", sessionId: call.sessionId });
                        call.transformedSenders.add(sender);
                    }
                } catch (error) {
                    console.error("Failed to apply E2EE to screen share:", error);
                    throw error; // Fail securely
                }
            }

            // Notify local screen share handler
            if (onLocalScreenShare) {
                onLocalScreenShare(userId, screenStream);
            }

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
                    call.transformedSenders.delete(screenSender);
                    // Clear sender reference
                    if (call.screenShareSender === screenSender) {
                        call.screenShareSender = null;
                    }
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

/**
 * Update the remote video enabled state (called when receiving signaling)
 */
export function setRemoteVideoEnabled(userId: number, enabled: boolean): void {
    const call = calls.get(userId);
    if (call) {
        call.isRemoteVideoEnabled = enabled;
        // Reset counter when feature is disabled
        if (!enabled) {
            call.receivedVideoTrackCount = 0;
        }
    }
}

/**
 * Update the remote screen sharing state (called when receiving signaling)
 */
export function setRemoteScreenSharing(userId: number, enabled: boolean): void {
    const call = calls.get(userId);
    if (call) {
        call.isRemoteScreenSharing = enabled;
        // Reset counter when feature is disabled
        if (!enabled) {
            call.receivedScreenShareTrackCount = 0;
        }
    }
}

export function setScreenShareStateChangeHandler(handler: ((userId: number, isSharing: boolean) => void) | null): void {
    onScreenShareStateChange = handler;
}

export function cleanup(): void {
    // Clean up all calls
    for (const userId of calls.keys()) {
        cleanupCall(userId);
    }
    calls.clear();
}