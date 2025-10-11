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
            
            const params: AesGcmParams = { name: 'AES-GCM', iv };
            
            let result: ArrayBuffer;
            if (mode === 'encrypt') {
                // For encryption: add 4-byte length prefix, then metadata, then encrypt
                const frameMetadata = new TextEncoder().encode(JSON.stringify({
                    frameNumber: frameCounter - 1,
                    timestamp: currentTime,
                    sessionId: sessionId || 'default'
                }));
                
                // Combine: [4-byte length][metadata][data]
                const combinedData = new Uint8Array(4 + frameMetadata.length + data.length);
                const view = new DataView(combinedData.buffer);
                view.setUint32(0, frameMetadata.length, false); // Store metadata length
                combinedData.set(frameMetadata, 4);
                combinedData.set(data, 4 + frameMetadata.length);
                
                result = await crypto.subtle.encrypt(params, key, combinedData);
            } else {
                // For decryption: decrypt first, then extract using length prefix
                const decrypted = await crypto.subtle.decrypt(params, key, data);
                const decryptedData = new Uint8Array(decrypted);
                
                try {
                    // Read metadata length from first 4 bytes
                    const view = new DataView(decryptedData.buffer, decryptedData.byteOffset);
                    const metadataLength = view.getUint32(0, false);
                    
                    // Extract the actual frame data (skip length prefix and metadata)
                    const extractedData = decryptedData.slice(4 + metadataLength);
                    result = extractedData.buffer.slice(extractedData.byteOffset, extractedData.byteOffset + extractedData.byteLength);
                } catch (parseError) {
                    console.warn("Frame metadata extraction failed:", parseError);
                    // If extraction fails, just use the decrypted data as-is
                    result = decrypted;
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
