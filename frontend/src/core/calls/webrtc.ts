import { getAuthHeaders } from "@/core/api/authApi";
import type { CallSignalingMessage, IceServersResponse } from "@/core/types";
import { request } from "@/core/websocket";
import { wrapCallSessionKeyForRecipient, unwrapCallSessionKeyFromSender } from "./encryption";
import { fetchUserPublicKey } from "@/core/api/dmApi";
import { importAesGcmKey } from "@/utils/crypto/symmetric";
import E2EEWorker from "./e2eeWorker?worker";
import { rotateCallSessionKey, createSharedSecretAndDeriveSessionKey } from "./encryption";

export interface WebRTCCall {
    peerConnection: RTCPeerConnection;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    isInitiator: boolean;
    remoteUserId: number;
    remoteUsername: string;
    isEnding?: boolean;
    isMuted?: boolean;
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

    // Handle remote stream
    peerConnection.addEventListener("track", (event) => {
        const [remoteStream] = event.streams;
        const call = calls.get(userId);
        if (call) {
            call.remoteStream = remoteStream;
            if (onRemoteStream) {
                onRemoteStream(userId, remoteStream);
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
            const receiver = peerConnection.getReceivers().find(r => r.track && r.track.kind === 'audio');
            if (receiver) {
                receiver.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'decrypt', sessionId });
            }
            const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'audio');
            if (sender) {
                sender.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'encrypt', sessionId });
            }
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

        // Stop local stream
        if (call.localStream) {
            call.localStream.getTracks().forEach(track => track.stop());
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