import { getAuthHeaders } from "@/core/api/authApi";
import type { CallSignalingMessage, IceServersResponse } from "@/core/types";
import { request } from "@/core/websocket";
import { wrapCallSessionKeyForRecipient, unwrapCallSessionKeyFromSender } from "./encryption";
import { fetchUserPublicKey } from "@/core/api/dmApi";
import { importAesGcmKey } from "@/utils/crypto/symmetric";
import E2EEWorker from "./e2eeWorker?worker";
import { rotateCallSessionKey, createSharedSecretAndDeriveSessionKey } from "./encryption";

export interface CallParticipant {
    userId: number;
    username: string;
    peerConnection: RTCPeerConnection;
    streams: {
        audio?: MediaStream;
        video?: MediaStream;
        screenshare?: MediaStream;
    };
    mediaState: {
        hasAudio: boolean;
        hasVideo: boolean;
        hasScreenshare: boolean;
    };
    isEnding?: boolean;
    // Insertable Streams E2EE
    sessionKey?: Uint8Array | null;
    sessionCryptoKey?: CryptoKey | null;
    sessionId: string;
    keyRotationTimer?: NodeJS.Timeout;
    lastKeyRotation?: number;
}

export interface ActiveCall {
    callId: string;
    participants: Map<number, CallParticipant>;
    localStreams: {
        audio?: MediaStream;
        video?: MediaStream;
        screenshare?: MediaStream;
    };
    localMediaState: {
        hasAudio: boolean;
        hasVideo: boolean;
        hasScreenshare: boolean;
        isMuted: boolean;
    };
    permissionStates: {
        audio: boolean;
        video: boolean;
        screenshare: boolean;
    };
    isInitiator: boolean;
    startTime?: number;
}

// Global state
export let authToken: string | null = null;
export let onCallStateChange: ((userId: number, state: string) => void) | null = null;
export let onRemoteStream: ((userId: number, stream: MediaStream, type: 'audio' | 'video' | 'screenshare') => void) | null = null;
export let onParticipantMediaChange: ((userId: number, mediaState: { hasAudio: boolean; hasVideo: boolean; hasScreenshare: boolean }) => void) | null = null;
let activeCall: ActiveCall | null = null;
let isCleaningUp = false;

export function setAuthToken(token: string) {
    authToken = token;
}

export function setCallStateChangeHandler(handler: (userId: number, state: string) => void) {
    onCallStateChange = handler;
}

export function setRemoteStreamHandler(handler: (userId: number, stream: MediaStream, type: 'audio' | 'video' | 'screenshare') => void) {
    onRemoteStream = handler;
}

export function setParticipantMediaChangeHandler(handler: (userId: number, mediaState: { hasAudio: boolean; hasVideo: boolean; hasScreenshare: boolean }) => void) {
    onParticipantMediaChange = handler;
}

export let onLocalStream: ((stream: MediaStream, type: 'audio' | 'video' | 'screenshare') => void) | null = null;

export function setLocalStreamHandler(handler: (stream: MediaStream, type: 'audio' | 'video' | 'screenshare') => void) {
    onLocalStream = handler;
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


async function createParticipant(userId: number, username: string): Promise<CallParticipant> {
    const iceServers = await getIceServers();
    
    const peerConnection = new RTCPeerConnection({
        iceServers
    });

    const participant: CallParticipant = {
        userId,
        username,
        peerConnection,
        streams: {},
        mediaState: {
            hasAudio: false,
            hasVideo: false,
            hasScreenshare: false
        },
        sessionKey: null,
        sessionCryptoKey: null,
        sessionId: crypto.randomUUID()
    };

    // Set up peer connection event listeners
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
        const track = event.track;
        
        if (!activeCall) return;
        
        const participant = activeCall.participants.get(userId);
        if (participant) {
            // Determine stream type based on track kind
            let streamType: 'audio' | 'video' | 'screenshare' = 'audio';
            if (track.kind === 'video') {
                // For now, assume all video is regular video (not screenshare)
                // In future, we could differentiate based on track.label or other metadata
                streamType = 'video';
            }
            
            // Store the stream
            participant.streams[streamType] = remoteStream;
            participant.mediaState[streamType === 'audio' ? 'hasAudio' : streamType === 'video' ? 'hasVideo' : 'hasScreenshare'] = true;
            
            // Notify listeners
            if (onRemoteStream) {
                onRemoteStream(userId, remoteStream, streamType);
            }
            if (onParticipantMediaChange) {
                onParticipantMediaChange(userId, participant.mediaState);
            }
        }
    });

    // Handle connection state changes
    peerConnection.addEventListener("connectionstatechange", () => {
        console.log("WebRTC connection state changed:", peerConnection.connectionState, "for user", userId);
        
            if (onCallStateChange) {
                onCallStateChange(userId, peerConnection.connectionState);
            }

            // Clean up if connection failed or closed
            if (peerConnection.connectionState === "failed" || 
                peerConnection.connectionState === "closed" ||
                peerConnection.connectionState === "disconnected") {
            
            console.log("Connection state requires cleanup for user", userId);
            if (!activeCall) {
                console.log("No activeCall, skipping cleanup");
                return;
            }
            const participant = activeCall.participants.get(userId);
            if (participant && !participant.isEnding) {
                console.log("Triggering endCall for user", userId);
                participant.isEnding = true;
                endCall();
            }
        }
    });

    return participant;
}

export async function initiateCall(userId: number, username: string): Promise<boolean> {
    try {
        // Get user audio media
        const localAudioStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });

        // Create active call
        const callId = crypto.randomUUID();
        activeCall = {
            callId,
            participants: new Map(),
            localStreams: {
                audio: localAudioStream
            },
            localMediaState: {
                hasAudio: true,
                hasVideo: false,
                hasScreenshare: false,
                isMuted: false
            },
            permissionStates: {
                audio: true,
                video: false,
                screenshare: false
            },
            isInitiator: true,
            startTime: Date.now()
        };

        // Create participant
        const participant = await createParticipant(userId, username);
        activeCall.participants.set(userId, participant);

        // Add audio track to peer connection
        localAudioStream.getTracks().forEach(track => participant.peerConnection.addTrack(track, localAudioStream));

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
        cleanupCall();
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

async function applyE2EETransforms(participant: CallParticipant): Promise<void> {
    try {
        // @ts-ignore
        if (!participant.sessionKey || !window.RTCRtpScriptTransform) {
            console.log("Skipping E2EE transforms: missing session key or RTCRtpScriptTransform support", {
                hasSessionKey: !!participant.sessionKey,
                hasRTCRtpScriptTransform: !!window.RTCRtpScriptTransform,
                participantUserId: participant.userId
            });
            return;
        }
        
        const key = await importAesGcmKey(participant.sessionKey);
        participant.sessionCryptoKey = key;
        
        // Apply to all receivers (audio, video, screenshare) that don't already have transforms
        const receivers = participant.peerConnection.getReceivers();
        for (const receiver of receivers) {
            if (receiver.track && !receiver.transform) {
                try {
            // @ts-ignore
            receiver.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'decrypt' });
                    console.log("Applied E2EE decrypt transform to receiver track:", receiver.track.kind);
                } catch (e) {
                    console.warn("Failed to apply E2EE transform to receiver:", e);
                }
            }
        }
        
        // Apply to all senders (audio, video, screenshare) that don't already have transforms
        const senders = participant.peerConnection.getSenders();
        for (const sender of senders) {
            if (sender.track && !sender.transform) {
                try {
            // @ts-ignore
            sender.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'encrypt' });
                    console.log("Applied E2EE encrypt transform to sender track:", sender.track.kind);
                } catch (e) {
                    console.warn("Failed to apply E2EE transform to sender:", e);
                }
            }
        }
    } catch (error) {
        console.error("Failed to apply E2EE transforms:", error);
    }
}

export async function setSessionKey(userId: number, keyBytes: Uint8Array): Promise<void> {
    const participant = activeCall?.participants.get(userId);
    if (!participant) {
        console.log("No participant found for setSessionKey, userId:", userId);
        return;
    }
    participant.sessionKey = keyBytes;
    participant.lastKeyRotation = Date.now();
    console.log("Session key stored for participant", userId, "applying E2EE transforms");
    await applyE2EETransforms(participant);
    
    // Start key rotation timer (rotate every 10 minutes for long calls)
    if (participant.keyRotationTimer) {
        clearInterval(participant.keyRotationTimer);
    }
    
    participant.keyRotationTimer = setInterval(async () => {
        await rotateSessionKey(userId);
    }, 10 * 60 * 1000); // 10 minutes
}

/**
 * Rotate the session key for a call to provide forward secrecy
 */
async function rotateSessionKey(userId: number): Promise<void> {
    const participant = activeCall?.participants.get(userId);
    if (!participant || !participant.sessionKey) return;
    
    try {
        console.log("Rotating session key for participant", userId);
        
        // Generate new session key
        const currentSessionKey = {
            key: participant.sessionKey,
            hash: "" // We'll generate a new hash
        };
        
        const newSessionKey = await rotateCallSessionKey(currentSessionKey);
        
        // Update the participant with new session key
        participant.sessionKey = newSessionKey.key;
        participant.lastKeyRotation = Date.now();
        
        // Reapply E2EE transforms with new key
        await applyE2EETransforms(participant);
        
        console.log("Session key rotated successfully for participant", userId);
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
        const isInitiator = activeCall?.isInitiator ?? false;
        const derivedSessionKey = await createSharedSecretAndDeriveSessionKey(senderPublicKey, sessionKeyHash, isInitiator);
        
        await setSessionKey(fromUserId, derivedSessionKey.key);
        console.log("Session key set for user", fromUserId, "key available:", !!derivedSessionKey.key);
    } catch (e) {
        console.error("Failed to unwrap session key:", e);
    }
}

export async function acceptCall(userId: number): Promise<boolean> {
    try {
        // Wait a bit for handleIncomingCall to complete if it's running
        let retries = 0;
        while (!activeCall?.participants.has(userId) && retries < 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }
        
        const participant = activeCall?.participants.get(userId);
        if (!participant) {
            console.error("No participant found for user", userId, "after waiting");
            return false;
        }

        // Get user audio media and attach
        const localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        
        if (activeCall && !activeCall.localStreams.audio) {
            activeCall.localStreams.audio = localAudioStream;
            activeCall.localMediaState.hasAudio = true;
            activeCall.permissionStates.audio = true;
        }
        
        localAudioStream.getTracks().forEach(track => participant!.peerConnection.addTrack(track, localAudioStream));

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
        cleanupCall();
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

    cleanupCall();
}

export async function endCall(): Promise<void> {
    if (activeCall && !activeCall.participants.values().next().value?.isEnding) {
        // Mark all participants as ending
        for (const participant of activeCall.participants.values()) {
            participant.isEnding = true;
        }
        
        // Send call end message to all participants
        for (const [participantId] of activeCall.participants) {
        await sendSignalingMessage({
            type: "call_end",
            fromUserId: 0, // Will be set by server
                toUserId: participantId,
            data: {}
        });
        }

        cleanupCall();
    }
}

export async function handleIncomingCall(userId: number, username: string): Promise<void> {
    // Prevent multiple calls to handleIncomingCall for the same user
    if (activeCall && activeCall.participants.has(userId)) {
        console.log("Incoming call already handled for user:", userId);
        return;
    }
    
    // Don't proceed if cleanup is in progress
    if (isCleaningUp) {
        console.log("Cleanup in progress, aborting handleIncomingCall");
        return;
    }

    try {
        // Create active call for incoming call if it doesn't exist
        if (!activeCall) {
            const callId = crypto.randomUUID();
            activeCall = {
                callId,
                participants: new Map(),
                localStreams: {},
                localMediaState: {
                    hasAudio: false,
                    hasVideo: false,
                    hasScreenshare: false,
                    isMuted: false
                },
                permissionStates: {
                    audio: false,
                    video: false,
                    screenshare: false
                },
                isInitiator: false
            };
            console.log("Created new activeCall for incoming call:", callId);
        } else {
            console.log("Using existing activeCall:", activeCall.callId);
        }

        // Ensure activeCall exists before proceeding
        if (!activeCall) {
            throw new Error("Failed to create activeCall");
        }

        // Store reference to activeCall to prevent race conditions
        const currentActiveCall = activeCall;
        
        // Double-check that activeCall still exists (might have been cleaned up by rejectCall)
        if (!currentActiveCall) {
            console.log("activeCall was cleaned up during participant creation, aborting");
            return;
        }
        
        // Create participant for incoming call if it doesn't exist
        if (!currentActiveCall.participants.has(userId)) {
            console.log("Creating participant for user:", userId);
            const participant = await createParticipant(userId, username);
            
            // Triple-check that activeCall still exists after async operation
            if (!activeCall) {
                console.log("activeCall was cleaned up during createParticipant, aborting");
                return;
            }
            
            activeCall.participants.set(userId, participant);
            console.log("Participant created and added to activeCall");
        } else {
            console.log("Participant already exists for user:", userId);
        }
    } catch (error) {
        console.error("Failed to handle incoming call:", error);
        if (activeCall) {
            cleanupCall();
        }
    }
}

export async function onRemoteAccepted(userId: number): Promise<void> {
    const participant = activeCall?.participants.get(userId);
    if (!participant) {
        throw new Error("No participant found to accept");
    }

    try {
        // Create offer
        const offer = await participant.peerConnection.createOffer();
        await participant.peerConnection.setLocalDescription(offer);

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

async function createE2EETransform(sessionKey: NonNullable<CallParticipant['sessionKey']>, peerConnection: RTCPeerConnection, sessionId?: string): Promise<void> {
    try {
        if (sessionKey && window.RTCRtpScriptTransform) {
            const key = await importAesGcmKey(sessionKey);
            
            // Apply to all receivers (audio, video, screenshare)
            const receivers = peerConnection.getReceivers();
            for (const receiver of receivers) {
                if (receiver.track) {
                receiver.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'decrypt', sessionId });
                }
            }
            
            // Apply to all senders (audio, video, screenshare)
            const senders = peerConnection.getSenders();
            for (const sender of senders) {
                if (sender.track) {
                sender.transform = new RTCRtpScriptTransform(new E2EEWorker(), { key, mode: 'encrypt', sessionId });
                }
            }
        }
    } catch (error) {
        console.error("Failed to create E2EE transform:", error);
        throw error;
    }
}

export async function handleCallOffer(userId: number, offer: RTCSessionDescriptionInit): Promise<void> {
    const participant = activeCall?.participants.get(userId);
    if (!participant) {
        throw new Error("No participant found for offer");
    }

    try {
        // Set remote description
        await participant.peerConnection.setRemoteDescription(offer);

        // Create answer
        const answer = await participant.peerConnection.createAnswer();
        await participant.peerConnection.setLocalDescription(answer);

        // Attach transforms on callee side if session key set and insertable streams supported
        await createE2EETransform(participant.sessionKey!, participant.peerConnection, participant.sessionId);

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
    const participant = activeCall?.participants.get(userId);
    if (!participant) {
        throw new Error("No participant found for answer");
    }

    try {
        await participant.peerConnection.setRemoteDescription(answer);
        // After signaling completes, attach transforms on initiator side if supported
        await createE2EETransform(participant.sessionKey!, participant.peerConnection, participant.sessionId);
    } catch (error) {
        console.error("Failed to handle answer:", error);
        throw error;
    }
}

export async function handleIceCandidate(userId: number, candidate: RTCIceCandidateInit): Promise<void> {
    const participant = activeCall?.participants.get(userId);
    if (!participant) {
        console.warn("No participant found for ICE candidate from user", userId);
        return;
    }

    try {
        console.log("Adding ICE candidate from user", userId, ":", candidate);
        await participant.peerConnection.addIceCandidate(candidate);
    } catch (error) {
        console.error("Failed to add ICE candidate:", error);
    }
}

export async function toggleVideo(): Promise<boolean> {
    if (!activeCall) return false;

    try {
        if (!activeCall.localMediaState.hasVideo) {
            // Enable video - request permission if not already granted
            if (!activeCall.permissionStates.video) {
                const videoStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280, max: 1920 },
                        height: { ideal: 720, max: 1080 },
                        frameRate: { ideal: 30, max: 60 }
                    },
                    audio: false
                });
                
                // Debug the video stream
                console.log("Video stream created:", {
                    id: videoStream.id,
                    active: videoStream.active,
                    videoTracks: videoStream.getVideoTracks().map(t => ({
                        id: t.id,
                        label: t.label,
                        enabled: t.enabled,
                        muted: t.muted,
                        readyState: t.readyState,
                        settings: t.getSettings()
                    })),
                    audioTracks: videoStream.getAudioTracks().length
                });
                
                activeCall.localStreams.video = videoStream;
                activeCall.permissionStates.video = true;
                
                // Notify UI about local video stream
                if (onLocalStream) {
                    onLocalStream(videoStream, 'video');
                }
            }

            // Add video track to all peer connections
            const videoTrack = activeCall.localStreams.video!.getVideoTracks()[0];
            for (const [, participant] of activeCall.participants) {
                participant.peerConnection.addTrack(videoTrack, activeCall.localStreams.video!);
                // Small delay to ensure track is fully established before applying E2EE
                setTimeout(async () => {
                    await applyE2EETransforms(participant);
                }, 100);
            }

            activeCall.localMediaState.hasVideo = true;

            // Send signaling to notify all participants
            for (const [participantId] of activeCall.participants) {
                await sendSignalingMessage({
                    type: "call_media_state_change",
                    fromUserId: 0,
                    toUserId: participantId,
                    data: {
                        mediaType: "video",
                        enabled: true
                    }
                });
            }

            return true;
        } else {
            // Disable video
            if (activeCall.localStreams.video) {
                activeCall.localStreams.video.getTracks().forEach(track => track.stop());
            }

            // Remove video tracks from all peer connections
            for (const [, participant] of activeCall.participants) {
                const senders = participant.peerConnection.getSenders();
                senders.forEach(sender => {
                    if (sender.track && sender.track.kind === 'video') {
                        participant.peerConnection.removeTrack(sender);
                    }
                });
            }

            activeCall.localMediaState.hasVideo = false;

            // Send signaling to notify all participants
            for (const [participantId] of activeCall.participants) {
                await sendSignalingMessage({
                    type: "call_media_state_change",
                    fromUserId: 0,
                    toUserId: participantId,
                    data: {
                        mediaType: "video",
                        enabled: false
                    }
                });
            }

            return false;
        }
    } catch (error) {
        console.error("Failed to toggle video:", error);
        return activeCall.localMediaState.hasVideo;
    }
}

export async function toggleScreenshare(): Promise<boolean> {
    if (!activeCall) return false;

    try {
        if (!activeCall.localMediaState.hasScreenshare) {
            // Enable screenshare - request permission if not already granted
            if (!activeCall.permissionStates.screenshare) {
                const screenshareStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });
                activeCall.localStreams.screenshare = screenshareStream;
                activeCall.permissionStates.screenshare = true;
                
                // Notify UI about local screenshare stream
                if (onLocalStream) {
                    onLocalStream(screenshareStream, 'screenshare');
                }

                // Handle screenshare end event
                screenshareStream.getVideoTracks()[0].addEventListener('ended', () => {
                    toggleScreenshare(); // Disable screenshare when user stops sharing
                });
            }

            // Add screenshare track to all peer connections
            const screenshareTrack = activeCall.localStreams.screenshare!.getVideoTracks()[0];
            for (const [, participant] of activeCall.participants) {
                participant.peerConnection.addTrack(screenshareTrack, activeCall.localStreams.screenshare!);
                // Small delay to ensure track is fully established before applying E2EE
                setTimeout(async () => {
                    await applyE2EETransforms(participant);
                }, 100);
            }

            activeCall.localMediaState.hasScreenshare = true;

            // Send signaling to notify all participants
            for (const [participantId] of activeCall.participants) {
                await sendSignalingMessage({
                    type: "call_media_state_change",
                    fromUserId: 0,
                    toUserId: participantId,
                    data: {
                        mediaType: "screenshare",
                        enabled: true
                    }
                });
            }

            return true;
        } else {
            // Disable screenshare
            if (activeCall.localStreams.screenshare) {
                activeCall.localStreams.screenshare.getTracks().forEach(track => track.stop());
            }

            // Remove screenshare tracks from all peer connections
            for (const [, participant] of activeCall.participants) {
                const senders = participant.peerConnection.getSenders();
                senders.forEach(sender => {
                    if (sender.track && sender.track.kind === 'video' && sender.track.label.includes('screen')) {
                        participant.peerConnection.removeTrack(sender);
                    }
                });
            }

            activeCall.localMediaState.hasScreenshare = false;

            // Send signaling to notify all participants
            for (const [participantId] of activeCall.participants) {
                await sendSignalingMessage({
                    type: "call_media_state_change",
                    fromUserId: 0,
                    toUserId: participantId,
                    data: {
                        mediaType: "screenshare",
                        enabled: false
                    }
                });
            }

            return false;
        }
    } catch (error) {
        console.error("Failed to toggle screenshare:", error);
        return activeCall.localMediaState.hasScreenshare;
    }
}

export async function toggleMute(): Promise<boolean> {
    if (!activeCall || !activeCall.localStreams.audio) {
        return false;
    }

    if (!activeCall.localMediaState.isMuted) {
        // Mute: Stop the track completely (no green dot)
        const audioTrack = activeCall.localStreams.audio.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.stop();
            activeCall.localStreams.audio.removeTrack(audioTrack);
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
            activeCall.localStreams.audio.addTrack(silentTrack);
        }
        
        activeCall.localMediaState.isMuted = true;
        return true; // Muted
    } else {
        // Unmute: Re-enable microphone by getting new audio stream
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(async (newStream) => {
                // Remove any existing audio tracks from the stream
                activeCall!.localStreams.audio!.getAudioTracks().forEach(track => track.stop());
                
                // Get the new active track
                const newAudioTrack = newStream.getAudioTracks()[0];
                
                // Replace the track in all peer connections
                for (const [, participant] of activeCall!.participants) {
                    const sender = participant.peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'audio'
                );
                
                if (sender) {
                    // Replace the track in the existing sender
                    sender.replaceTrack(newAudioTrack);
                } else {
                    // Add the track to the peer connection if no sender exists
                        participant.peerConnection.addTrack(newAudioTrack, activeCall!.localStreams.audio!);
                    }
                    // Small delay to ensure track is fully established before applying E2EE
                    setTimeout(async () => {
                        await applyE2EETransforms(participant);
                    }, 100);
                }
                
                // Add the track to the local stream
                activeCall!.localStreams.audio!.addTrack(newAudioTrack);
                
                activeCall!.localMediaState.isMuted = false;
            })
            .catch(error => {
                console.error("Failed to re-enable microphone:", error);
            });
        return false; // Unmuted
    }
}

export function getActiveCall(): ActiveCall | null {
    return activeCall;
}

export function getParticipant(userId: number): CallParticipant | undefined {
    return activeCall?.participants.get(userId);
}

export function cleanupCall(): void {
    
    // Prevent multiple cleanup calls
    if (isCleaningUp) {
        console.log("Cleanup already in progress, skipping");
        return;
    }
    
    // Set cleanup flag immediately to prevent race conditions
    isCleaningUp = true;
    
    if (activeCall) {
        // Clear key rotation timers
        for (const participant of activeCall.participants.values()) {
            if (participant.keyRotationTimer) {
                clearInterval(participant.keyRotationTimer);
            }
        }
        
        // Close peer connections
        for (const participant of activeCall.participants.values()) {
            if (participant.peerConnection) {
                participant.peerConnection.close();
            }
        }

        // Stop local streams
        if (activeCall.localStreams.audio) {
            activeCall.localStreams.audio.getTracks().forEach(track => track.stop());
        }
        if (activeCall.localStreams.video) {
            activeCall.localStreams.video.getTracks().forEach(track => track.stop());
        }
        if (activeCall.localStreams.screenshare) {
            activeCall.localStreams.screenshare.getTracks().forEach(track => track.stop());
        }

        activeCall = null;
    }
    
    // Reset cleanup flag
    isCleaningUp = false;
}

export function cleanup(): void {
    cleanupCall();
}