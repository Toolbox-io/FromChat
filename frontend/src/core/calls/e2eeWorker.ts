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
function makeIV(encodedFrame: EncodedFrame, frameCount: number, mode: 'encrypt' | 'decrypt'): ArrayBuffer {
    // Create IV using ONLY RTP metadata - this ensures sender and receiver use identical IVs
    // Frame data can differ between sender/receiver due to encoding differences
    const ivBuffer = new ArrayBuffer(12);
    const view = new DataView(ivBuffer);
    
    if (encodedFrame.getMetadata) {
        try {
            const metadata = encodedFrame.getMetadata();
            if (metadata && typeof metadata.rtpTimestamp === 'number') {
                // Use ONLY RTP timestamp + sync source - these are identical on both sides
                view.setUint32(0, metadata.rtpTimestamp, false); // First 4 bytes
                view.setUint32(4, metadata.synchronizationSource || 0, false); // Middle 4 bytes
                view.setUint32(8, 0, false); // Last 4 bytes (padding for 12-byte IV)
                
                // Debug first few frames only
                if (frameCount <= 3) {
                    console.log(`${mode.toUpperCase()} IV for frame #${frameCount}:`, {
                        rtpTimestamp: metadata.rtpTimestamp,
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
    
    // Fallback: use timestamp only (no random to avoid desync)
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
    
    console.log(`E2EE Worker started in ${mode.toUpperCase()} mode`);
    
    let frameCount = 0;
    let lastLogTime = 0;
    let lastKeyCheck = Date.now();
    
    async function transform(encodedFrame: EncodedFrame, controller: TransformStreamDefaultController<EncodedFrame>) {
        try {
            const data = new Uint8Array(encodedFrame.data);
            
            // Increment frame counter
            frameCount++;
            
            // Log every frame for debugging (only first 3)
            if (frameCount <= 3) {
                console.log(`${mode.toUpperCase()} Processing frame #${frameCount}, size: ${data.length}`);
            }
            
            // Create IV using RTP timestamp from metadata (synchronized between peers)
            const iv = makeIV(encodedFrame, frameCount, mode);
            
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

            // Detect potential browser window glitching - frames with specific characteristics
            if (data.length > 100000 && frameCount > 10) { // Large frames after initial setup
                const frameType = encodedFrame.type || 'unknown';
                if (frameType === 'key' && data.length > 200000) {
                    console.log("Large keyframe detected - possible browser window glitch, frame size:", data.length);
                }
            }
            
            // Ensure IV is properly typed
            const ivArray = new Uint8Array(iv);
            const params: AesGcmParams = { name: 'AES-GCM', iv: ivArray };
            
            // COMPROMISE: Encrypt most of the frame while preserving minimal codec compatibility
            // This prevents most visual leakage while maintaining decodability
            let headerSize = 0;
            let payloadData: Uint8Array;
            
            if (data.length > 20) {
                // For video frames, preserve only the first 2 bytes (minimal codec sync)
                // This is the absolute minimum needed for frame identification
                headerSize = 2;
                payloadData = data.slice(headerSize);
            } else {
                // For small frames (likely audio), encrypt everything
                payloadData = data;
            }
            
            // Encrypt the payload data
            const payloadBuffer = new ArrayBuffer(payloadData.byteLength);
            new Uint8Array(payloadBuffer).set(payloadData);
            
            let encryptedPayload: ArrayBuffer;
            if (isEncrypting) {
                encryptedPayload = await crypto.subtle.encrypt(params, key, payloadBuffer);
            } else {
                try {
                    encryptedPayload = await crypto.subtle.decrypt(params, key, payloadBuffer);
                } catch (error) {
                    console.error(`E2EE ${mode} FAILED - dropping frame #${frameCount}, size: ${data.length}`, error);
                    return; // Drop the frame
                }
            }
            
            // Reconstruct frame: minimal headers + encrypted payload
            const encryptedArray = new Uint8Array(encryptedPayload);
            const result = new Uint8Array(headerSize + encryptedArray.length);
            
            if (headerSize > 0) {
                result.set(data.slice(0, headerSize), 0); // Copy minimal headers
                result.set(encryptedArray, headerSize); // Add encrypted payload
            } else {
                result.set(encryptedArray, 0);
            }
            
            // Log first few frames for debugging
            if (frameCount <= 3) {
                console.log(`E2EE ${mode} frame #${frameCount}: ${data.length} -> ${result.length} bytes (header: ${headerSize})`);
            }
            
            // CRITICAL: Video frames need ArrayBuffer, not Uint8Array
            encodedFrame.data = result.buffer;
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
