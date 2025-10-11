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
    // Debug: log frame properties
    if (frameCount <= 3) {
        console.log("Frame object keys:", Object.keys(encodedFrame));
        console.log("Frame timestamp:", encodedFrame.timestamp);
        if (encodedFrame.getMetadata) {
            const metadata = encodedFrame.getMetadata();
            console.log("Metadata:", metadata);
            console.log("RTP timestamp:", metadata?.rtpTimestamp);
        }
    }
    
    // Use RTP timestamp from metadata as IV base
    // This is synchronized between sender and receiver
    const ivBuffer = new ArrayBuffer(12);
    
    if (encodedFrame.getMetadata) {
        try {
            const metadata = encodedFrame.getMetadata();
            if (metadata && typeof metadata.rtpTimestamp === 'number') {
                // Use RTP timestamp as IV - it's synchronized between peers
                const view = new DataView(ivBuffer);
                view.setUint32(0, metadata.rtpTimestamp, false); // First 4 bytes
                view.setUint32(8, metadata.synchronizationSource || 0, false); // Last 4 bytes
                return ivBuffer;
            }
        } catch (e) {
            console.error("Failed to get metadata:", e);
        }
    }
    
    // Fallback: use frame count (not ideal but better than nothing)
    const view = new DataView(ivBuffer);
    view.setUint32(8, frameCount, false);
    return ivBuffer;
}

addEventListener("rtctransform", (event) => {
    const { transformer } = event;
    const { readable, writable } = transformer;
    const { key, mode } = transformer.options as WorkerOptions;
    
    const isEncrypting = mode === 'encrypt';
    
    let frameCount = 0;
    let lastLogTime = 0;
    
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
            
            const params: AesGcmParams = { name: 'AES-GCM', iv };
            
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
            // Drop the frame completely - don't enqueue anything
            return;
        }
    }

    readable
        .pipeThrough(new TransformStream({ transform }))
        .pipeTo(writable);
});
