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
            
            // Apply E2EE transform to all tracks - video now uses header-preserving encryption
            if (call.sessionKey && window.RTCRtpScriptTransform) {
                try {
                    const receiver = call.peerConnection.getReceivers().find(r => r.track === track);
                    if (receiver && !call.transformedReceivers.has(receiver)) {
                        const key = await importAesGcmKey(call.sessionKey);
                        console.log(`Applying decrypt transform to newly received ${track.kind} track:`);
                        console.log("- sessionId:", call.sessionId);
                        console.log("- sessionKey (first 8 bytes):", Array.from(new Uint8Array(call.sessionKey).slice(0, 8)));
                        // @ts-ignore
                        receiver.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'decrypt', sessionId: call.sessionId });
                        call.transformedReceivers.add(receiver);
                        console.log(`Decrypt transform applied successfully to ${track.kind} track`);
                    }
                } catch (error) {
                    console.error("Failed to apply E2EE to received track:", error);
                }
            } else {
                console.log(`Skipping decrypt transform for ${track.kind} track - session key not available or RTCRtpScriptTransform not supported`);
                console.log("Session key exists:", !!call.sessionKey);
                console.log("RTCRtpScriptTransform available:", !!window.RTCRtpScriptTransform);
            }
            
            // Determine stream type based on track kind and signaling state
            console.log(`Track received: kind=${track.kind}, isRemoteScreenSharing=${call.isRemoteScreenSharing}, isRemoteVideoEnabled=${call.isRemoteVideoEnabled}`);
            
            if (track.kind === "video") {
                const receiver = call.peerConnection.getReceivers().find(r => r.track === track);
                const transceiver = receiver ? call.peerConnection.getTransceivers().find(t => t.receiver === receiver) : null;
                
                console.log("Video track transceiver mid:", transceiver?.mid);
                console.log("Video sender mid:", call.videoSender ? call.peerConnection.getTransceivers().find(t => t.sender === call.videoSender)?.mid : "none");
                console.log("Screen share sender mid:", call.screenShareSender ? call.peerConnection.getTransceivers().find(t => t.sender === call.screenShareSender)?.mid : "none");
                
                let isScreenShare = false;
                let isVideo = false;
                
                if (call.isRemoteScreenSharing && call.isRemoteVideoEnabled) {
                    // Both active - route based on which one we haven't received yet
                    console.log("Both features active - routing based on received track counts");
                    console.log("Received video tracks:", call.receivedVideoTrackCount);
                    console.log("Received screen share tracks:", call.receivedScreenShareTrackCount);
                    
                    // Simple logic: if we haven't received video yet, this is video
                    // if we haven't received screen share yet, this is screen share
                    if (call.receivedVideoTrackCount === 0) {
                        isVideo = true;
                        call.receivedVideoTrackCount++;
                        console.log("Routing as video (first video track)");
                    } else if (call.receivedScreenShareTrackCount === 0) {
                        isScreenShare = true;
                        call.receivedScreenShareTrackCount++;
                        console.log("Routing as screen share (first screen share track)");
                    } else {
                        // Both already received - this shouldn't happen, log warning
                        console.warn("Both tracks already received, but got another video track!");
                        console.warn("This might be a track replacement, routing as screen share by default");
                        isScreenShare = true;
                    }
                } else if (call.isRemoteScreenSharing) {
                    console.log("Only screen share active");
                    isScreenShare = true;
                    call.receivedScreenShareTrackCount++;
                } else if (call.isRemoteVideoEnabled) {
                    console.log("Only video active");
                    isVideo = true;
                    call.receivedVideoTrackCount++;
                } else {
                    console.log("Neither video nor screen share active - this shouldn't happen!");
                }
                
                console.log("Routing decision: isScreenShare:", isScreenShare, "isVideo:", isVideo);
                
                if (isScreenShare) {
                    console.log("Detected screen share track, notifying handler");
                    if (onRemoteScreenShare) {
                        onRemoteScreenShare(userId, remoteStream);
                    } else {
                        console.warn("onRemoteScreenShare handler not set!");
                    }
                } else if (isVideo) {
                    console.log("Detected video track, notifying handler");
                    if (onRemoteVideoStream) {
                        onRemoteVideoStream(userId, remoteStream);
                    } else {
                        console.warn("onRemoteVideoStream handler not set!");
                    }
                }
            } else if (track.kind === "audio") {
                console.log("Detected audio track, notifying handler");
                // Handle remote audio (existing behavior)
                call.remoteStream = remoteStream;
                if (onRemoteStream) {
                    onRemoteStream(userId, remoteStream);
                } else {
                    console.warn("onRemoteStream handler not set!");
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
        
        // Apply to receivers that don't already have transforms
        const receivers = call.peerConnection.getReceivers();
        for (const receiver of receivers) {
            if (receiver.track && !call.transformedReceivers.has(receiver)) {
                console.log(`Applying decrypt transform to ${receiver.track.kind} receiver`);
                // @ts-ignore
                receiver.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'decrypt', sessionId: call.sessionId });
                call.transformedReceivers.add(receiver);
            }
        }
        
        // Apply to senders that don't already have transforms
        const senders = call.peerConnection.getSenders();
        for (const sender of senders) {
            if (sender.track && !call.transformedSenders.has(sender)) {
                console.log(`Applying encrypt transform to ${sender.track.kind} sender`);
                // @ts-ignore
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
    
    console.log("setSessionKey: Setting session key for user", userId);
    call.sessionKey = keyBytes;
    call.lastKeyRotation = Date.now();
    
    console.log("setSessionKey: Applying E2EE transforms...");
    await applyE2EETransforms(call);
    console.log("setSessionKey: E2EE transforms applied successfully");
    
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
        console.log("receiveWrappedSessionKey called for user", fromUserId, "hash:", sessionKeyHash);
        const senderPublicKey = await fetchUserPublicKey(fromUserId, authToken);
        if (!senderPublicKey) {
            console.error("Failed to get sender public key");
            return;
        }
        if (!wrappedPayload || !sessionKeyHash) {
            console.error("Missing wrapped payload or session key hash");
            return;
        }
        
        console.log("Unwrapping session key...");
        // Unwrap the session key from the encrypted payload
        const unwrappedSessionKey = await unwrapCallSessionKeyFromSender(senderPublicKey, {
            salt: wrappedPayload.salt,
            iv2: wrappedPayload.iv2,
            wrapped: wrappedPayload.wrapped
        });
        
        console.log("Session key unwrapped successfully, setting it...");
        // Use the unwrapped session key directly (both sides should have the same key)
        await setSessionKey(fromUserId, unwrappedSessionKey);
        console.log("Session key set successfully for user", fromUserId);
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

async function createE2EETransform(call: WebRTCCall, sessionKey: Uint8Array, sessionId?: string): Promise<void> {
    try {
        // @ts-ignore
        if (!sessionKey || !window.RTCRtpScriptTransform) {
            console.log("Skipping E2EE transform in createE2EETransform - not supported or no session key");
            return;
        }
        
        console.log("Creating E2EE transform with sessionId:", sessionId);
        const key = await importAesGcmKey(sessionKey);
        
        // Apply to receivers that don't already have transforms
        const receivers = call.peerConnection.getReceivers();
        for (const receiver of receivers) {
            if (receiver.track && !call.transformedReceivers.has(receiver)) {
                console.log(`Applying decrypt transform to ${receiver.track.kind} in createE2EETransform`);
                // @ts-ignore
                receiver.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'decrypt', sessionId });
                call.transformedReceivers.add(receiver);
            }
        }
        
        // Apply to senders that don't already have transforms
        const senders = call.peerConnection.getSenders();
        for (const sender of senders) {
            if (sender.track && !call.transformedSenders.has(sender)) {
                console.log(`Applying encrypt transform to ${sender.track.kind} in createE2EETransform`);
                // @ts-ignore
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
            await createE2EETransform(call, call.sessionKey, call.sessionId);
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
        console.log("handleCallAnswer - setting remote description");
        console.log("Answer SDP media lines:", answer.sdp?.split('\n').filter(l => l.includes('m=')).join(', '));
        
        await call.peerConnection.setRemoteDescription(answer);
        
        console.log("Remote description set successfully");
        console.log("Current receivers after answer:", call.peerConnection.getReceivers().map(r => r.track?.kind));
        console.log("Current senders after answer:", call.peerConnection.getSenders().map(s => s.track?.kind));
        
        // Reset negotiating flag
        call.isNegotiating = false;
        
        // Attach transforms on initiator side if session key is available
        // If not available yet, setSessionKey will apply them when it arrives
        if (call.sessionKey) {
            await createE2EETransform(call, call.sessionKey, call.sessionId);
        } else {
            console.log("Session key not yet available in handleCallAnswer - will apply transforms when key arrives");
        }
        
        // Check if there are new receivers with tracks that haven't been notified yet
        // This handles the case where tracks exist but the track event hasn't fired yet
        const receivers = call.peerConnection.getReceivers();
        for (const receiver of receivers) {
            if (receiver.track) {
                const track = receiver.track;
                console.log("Checking receiver track:", track.kind);
                
                // Find the stream for this track
                const transceiver = call.peerConnection.getTransceivers().find(t => t.receiver === receiver);
                if (transceiver && transceiver.receiver.track) {
                    // Manually trigger stream handlers for tracks that didn't fire events
                    if (track.kind === "video" && onRemoteVideoStream) {
                        // Create a MediaStream from the track
                        const stream = new MediaStream([track]);
                        console.log("Manually notifying remote video stream handler");
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
            const sender = call.peerConnection.addTrack(videoTrack, videoStream);
            call.videoSender = sender;

            console.log("Video track added successfully");
            console.log("Current senders:", call.peerConnection.getSenders().map(s => s.track?.kind));
            console.log("Current transceivers:", call.peerConnection.getTransceivers().map(t => ({
                sender: t.sender.track?.kind,
                receiver: t.receiver.track?.kind,
                direction: t.direction,
                mid: t.mid
            })));

            // Apply E2EE transform with header-preserving encryption for video
            if (call.sessionKey && window.RTCRtpScriptTransform) {
                try {
                    const key = await importAesGcmKey(call.sessionKey);
                    console.log("Applying E2EE to video sender with header preservation");
                    const sender = call.peerConnection.getSenders().find(s => s.track === videoTrack);
                    if (sender && !call.transformedSenders.has(sender)) {
                        sender.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: "encrypt", sessionId: call.sessionId });
                        call.transformedSenders.add(sender);
                        console.log("E2EE applied to video sender successfully");
                    }
                } catch (error) {
                    console.error("Failed to apply E2EE to video:", error);
                    throw error; // Fail securely
                }
            }

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
                console.log("Set screen share stream ID to:", screenStream.id);
            } catch (e) {
                console.warn("Failed to set custom stream ID, using default:", screenStream.id);
            }

            call.screenShareStream = screenStream;
            call.isScreenSharing = true;

            // Add screen share track to peer connection
            const videoTrack = screenStream.getVideoTracks()[0];
            
            // Handle when user stops sharing via browser UI
            videoTrack.addEventListener("ended", async () => {
                console.log("Screen share track ended by browser controls");
                
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
            console.log("Sending screen share toggle BEFORE adding track");
            await sendSignalingMessage({
                type: "call_screen_share_toggle",
                fromUserId: 0,
                toUserId: userId,
                data: { enabled: true }
            });

            // Small delay to ensure signaling message is processed before track arrives
            await new Promise(resolve => setTimeout(resolve, 100));

            const sender = call.peerConnection.addTrack(videoTrack, screenStream);
            call.screenShareSender = sender;

            console.log("Screen share track added, immediately applying E2EE transform");

            // CRITICAL: Apply E2EE transform IMMEDIATELY after track is added
            if (call.sessionKey && window.RTCRtpScriptTransform) {
                try {
                    const key = await importAesGcmKey(call.sessionKey);
                    console.log("Applying E2EE to screen share sender:");
                    console.log("- sessionId:", call.sessionId);
                    console.log("- sessionKey (first 8 bytes):", Array.from(new Uint8Array(call.sessionKey).slice(0, 8)));
                    console.log("Available senders:", call.peerConnection.getSenders().map(s => ({ 
                        track: s.track?.kind, 
                        id: s.track?.id 
                    })));
                    console.log("Looking for screen share track:", videoTrack.id);
                    
                    const sender = call.peerConnection.getSenders().find(s => s.track === videoTrack);
                    console.log("Found screen share sender:", !!sender);
                    
                    if (sender && !call.transformedSenders.has(sender)) {
                        sender.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: "encrypt", sessionId: call.sessionId });
                        call.transformedSenders.add(sender);
                        console.log("E2EE applied to screen share sender successfully");
                    } else {
                        console.log("Screen share sender not found or already transformed");
                    }
                } catch (error) {
                    console.error("Failed to apply E2EE to screen share:", error);
                    throw error; // Fail securely
                }
            } else {
                console.log("Skipping E2EE for screen share - session key not available yet");
                console.log("Session key exists:", !!call.sessionKey);
                console.log("RTCRtpScriptTransform available:", !!window.RTCRtpScriptTransform);
            }

            // Let browser handle screen share settings naturally
            // Avoid applying constraints that might cause glitches

            // Notify local screen share handler
            if (onLocalScreenShare) {
                onLocalScreenShare(userId, screenStream);
            }

            console.log("Screen share setup complete - using existing session key:", call.sessionId);

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
        console.log(`Setting remote video enabled to ${enabled} for user ${userId}`);
        call.isRemoteVideoEnabled = enabled;
        // Reset counter when feature is disabled
        if (!enabled) {
            call.receivedVideoTrackCount = 0;
            console.log("Reset video track counter");
        }
    }
}

/**
 * Update the remote screen sharing state (called when receiving signaling)
 */
export function setRemoteScreenSharing(userId: number, enabled: boolean): void {
    const call = calls.get(userId);
    if (call) {
        console.log(`Setting remote screen sharing to ${enabled} for user ${userId}`);
        call.isRemoteScreenSharing = enabled;
        // Reset counter when feature is disabled
        if (!enabled) {
            call.receivedScreenShareTrackCount = 0;
            console.log("Reset screen share track counter");
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