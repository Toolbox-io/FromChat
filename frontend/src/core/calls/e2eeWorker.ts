/**
 * E2EE Worker for WebRTC Insertable Streams
 * Encrypts/decrypts encoded audio and video frames using AES-GCM
 * Uses RTP timestamps for IVs to handle out-of-order and dropped frames
 */

export interface FrameMetadata {
    contributingSources?: number[];
    mimeType?: string;
    payloadType?: number;
    rtpTimestamp: number;
    synchronizationSource: number;
    dependencies?: number[];
    frameId?: number;
    spatialIndex?: number;
    temporalIndex?: number;
}

export interface EncodedFrame {
    data: Uint8Array | ArrayBuffer;
    timestamp?: number;
    type?: string;
    getMetadata?: () => FrameMetadata;
}

export interface WorkerOptions {
    key: CryptoKey;
    mode: 'encrypt' | 'decrypt';
    sessionId?: string;
}

/**
 * Extract sequence number from encoded frame
 * For RTCEncodedVideoFrame/AudioFrame, we use the frame's metadata if available,
 * otherwise fall back to extracting from RTP header
 */
function makeIV(encodedFrame: EncodedFrame, frameCount: number): ArrayBuffer {
    // Create IV using ONLY RTP metadata - this ensures sender and receiver use the same IV
    // Frame count causes desynchronization during renegotiation
    const ivBuffer = new ArrayBuffer(12);
    const view = new DataView(ivBuffer);
    
    if (encodedFrame.getMetadata) {
        try {
            const metadata = encodedFrame.getMetadata();
            if (metadata && typeof metadata.rtpTimestamp === 'number') {
                // Use ONLY RTP timestamp + sync source - these are synchronized between peers
                // Frame count resets during renegotiation, causing IV mismatches
                view.setUint32(0, metadata.rtpTimestamp, false); // First 4 bytes
                view.setUint32(4, 0, false); // Middle 4 bytes (was frameCount)
                view.setUint32(8, metadata.synchronizationSource || 0, false); // Last 4 bytes
                
                // Debug first few frames
                if (frameCount <= 3) {
                    console.log(`IV for frame #${frameCount}:`, {
                        rtpTimestamp: metadata.rtpTimestamp,
                        frameCount,
                        syncSource: metadata.synchronizationSource,
                        mimeType: metadata.mimeType
                    });
                }
                
                return ivBuffer;
            }
        } catch (e) {
            console.error("Failed to get metadata:", e);
        }
    }
    
    // Fallback: use timestamp only (no frame count to avoid desync)
    view.setUint32(0, Date.now() & 0xFFFFFFFF, false);
    view.setUint32(4, 0, false);
    view.setUint32(8, 0, false);
    return ivBuffer;
}

addEventListener("rtctransform", (event) => {
    const { transformer } = event;
    const { readable, writable } = transformer;
    const { key, mode } = transformer.options as WorkerOptions;
    
    const isEncrypting = mode === 'encrypt';
    
    let frameCount = 0;
    let lastLogTime = 0;
    let lastKeyCheck = Date.now();
    
    async function transform(encodedFrame: EncodedFrame, controller: TransformStreamDefaultController<EncodedFrame>) {
        try {
            const data = new Uint8Array(encodedFrame.data);
            
            // Increment frame counter
            frameCount++;
            
            // Create IV using RTP timestamp from metadata (synchronized between peers)
            const iv = makeIV(encodedFrame, frameCount);
            
            // Log first few frames and periodically for debugging
            const now = Date.now();
            if (frameCount <= 5 || now - lastLogTime > 5000) {
                console.log(`E2EE ${mode} frame #${frameCount}, size: ${data.length} bytes`);
                lastLogTime = now;
            }
            
            // For screen share, check if we need to request key rotation more frequently
            // Screen share generates much more data and can benefit from more frequent key rotation
            if (data.length > 50000 && now - lastKeyCheck > 60000) { // 1 minute for large frames
                console.log("Large frame detected, suggesting key rotation for screen share");
                lastKeyCheck = now;
            }
            
            // Ensure IV is properly typed
            const ivArray = new Uint8Array(iv);
            const params: AesGcmParams = { name: 'AES-GCM', iv: ivArray };
            
            let result: ArrayBuffer;
            
            if (isEncrypting) {
                // Encrypt: just encrypt the raw frame data
                result = await crypto.subtle.encrypt(params, key, data);
            } else {
                // Decrypt: just decrypt the raw frame data
                result = await crypto.subtle.decrypt(params, key, data);
            }
            
            // CRITICAL: Video frames need ArrayBuffer, not Uint8Array
            // Must assign the buffer directly, not wrapped in Uint8Array
            encodedFrame.data = result;
            controller.enqueue(encodedFrame);
            
        } catch (e) {
            // FAIL SECURELY: Never send unencrypted frames
            const data = new Uint8Array(encodedFrame.data);
            console.error(`E2EE ${mode} FAILED - dropping frame #${frameCount}, size: ${data.length}`, e);
            console.error('Frame type:', encodedFrame.type || 'unknown');
            
            // For screen share, be more aggressive about dropping corrupted frames
            // to prevent progressive glitch accumulation
            if (mode === 'decrypt' && frameCount > 10) {
                console.warn(`Dropping corrupted frame #${frameCount} to prevent glitch accumulation`);
            }
            
            // Drop the frame completely - don't enqueue anything
            return;
        }
    }

    readable
        .pipeThrough(new TransformStream({ transform }))
        .pipeTo(writable);
});
