/**
 * E2EE Worker for WebRTC Insertable Streams
 * Conditionally encrypts or decrypts encoded audio frames using AES-GCM
 */

export interface EncodedFrame {
    data: Uint8Array;
}

export interface WorkerOptions {
    key: CryptoKey;
    mode: 'encrypt' | 'decrypt';
    sessionId?: string; // For replay protection
}

addEventListener("rtctransform", (event) => {
    const { transformer } = event;
    const { readable, writable } = transformer;
    const { key, mode, sessionId } = transformer.options as WorkerOptions;
    
    // Generate a random base IV once per transform session
    const ivBase = crypto.getRandomValues(new Uint8Array(8)); // 8 random bytes
    let frameCounter = 0;
    let lastFrameTime = 0;
    const FRAME_WINDOW_MS = 5000; // 5 second window for replay protection

    async function transform(encodedFrame: EncodedFrame, controller: TransformStreamDefaultController<EncodedFrame>) {
        try {
            const currentTime = Date.now();
            
            // Replay protection for decryption
            if (mode === 'decrypt') {
                // Simple time-based replay protection
                if (currentTime - lastFrameTime > FRAME_WINDOW_MS && lastFrameTime > 0) {
                    console.warn("Potential replay attack detected - frame outside time window");
                    controller.error(new Error("Replay attack detected"));
                    return;
                }
                lastFrameTime = currentTime;
            }
            
            // Create IV: 8 random bytes + 4-byte frame counter
            const iv = new Uint8Array(12);
            iv.set(ivBase, 0); // Copy random base
            const view = new DataView(iv.buffer);
            view.setUint32(8, frameCounter++, false); // Big-endian frame counter
            
            const data = new Uint8Array(encodedFrame.data);
            
            // Add frame metadata for authentication
            const frameMetadata = new TextEncoder().encode(JSON.stringify({
                frameNumber: frameCounter - 1,
                timestamp: currentTime,
                sessionId: sessionId || 'default'
            }));
            
            // Combine frame data with metadata
            const combinedData = new Uint8Array(data.length + frameMetadata.length);
            combinedData.set(frameMetadata, 0);
            combinedData.set(data, frameMetadata.length);
            
            const params: AesGcmParams = { name: 'AES-GCM', iv };
            
            let result: ArrayBuffer;
            if (mode === 'encrypt') {
                result = await crypto.subtle.encrypt(params, key, combinedData);
            } else {
                result = await crypto.subtle.decrypt(params, key, combinedData);
                
                // Verify frame metadata on decryption
                const decryptedData = new Uint8Array(result);
                const metadataLength = frameMetadata.length;
                const extractedMetadata = decryptedData.slice(0, metadataLength);
                const extractedData = decryptedData.slice(metadataLength);
                
                try {
                    const metadata = JSON.parse(new TextDecoder().decode(extractedMetadata));
                    if (metadata.frameNumber !== frameCounter - 1) {
                        throw new Error("Frame sequence number mismatch");
                    }
                    result = extractedData.buffer;
                } catch (parseError) {
                    console.warn("Frame authentication failed:", parseError);
                    controller.error(new Error("Frame authentication failed"));
                    return;
                }
            }
            
            encodedFrame.data = new Uint8Array(result);
            controller.enqueue(encodedFrame);
        } catch (e) {
            console.error(`E2EE ${mode} failed:`, e);
            controller.error(new Error(`E2EE ${mode} failed`));
        }
    }

    readable
        .pipeThrough(new TransformStream({ transform }))
        .pipeTo(writable);
});
