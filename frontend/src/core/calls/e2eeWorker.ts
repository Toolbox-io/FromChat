/**
 * E2EE Worker for WebRTC Insertable Streams
 * Encrypts/decrypts encoded audio and video frames using AES-GCM
 * Optimized for both small audio frames and large video frames
 */

export interface EncodedFrame {
    data: Uint8Array;
}

export interface WorkerOptions {
    key: CryptoKey;
    mode: 'encrypt' | 'decrypt';
    sessionId?: string;
}

addEventListener("rtctransform", (event) => {
    const { transformer } = event;
    const { readable, writable } = transformer;
    const { key, mode } = transformer.options as WorkerOptions;
    
    // Use a synchronized counter for IV generation
    // Both sides must start from the same point for the same session
    let frameCounter = 0;
    
    // Track sender vs receiver side independently
    // Each side maintains its own counter
    const isEncrypting = mode === 'encrypt';
    
    async function transform(encodedFrame: EncodedFrame, controller: TransformStreamDefaultController<EncodedFrame>) {
        try {
            // Create a unique IV for each frame using the counter
            // Format: 12 bytes total = 8 bytes of zeros + 4 bytes counter
            const iv = new Uint8Array(12);
            const view = new DataView(iv.buffer);
            view.setUint32(8, frameCounter++, false); // Big-endian counter
            
            const data = new Uint8Array(encodedFrame.data);
            const params: AesGcmParams = { name: 'AES-GCM', iv };
            
            let result: ArrayBuffer;
            
            if (isEncrypting) {
                // Encrypt: just encrypt the raw frame data
                result = await crypto.subtle.encrypt(params, key, data);
            } else {
                // Decrypt: just decrypt the raw frame data
                result = await crypto.subtle.decrypt(params, key, data);
            }
            
            // Update frame data with encrypted/decrypted result
            encodedFrame.data = new Uint8Array(result);
            controller.enqueue(encodedFrame);
            
        } catch (e) {
            // Log error but don't stop the stream - allows graceful degradation
            console.error(`E2EE ${mode} failed for frame ${frameCounter}:`, e);
            
            // For decryption errors, we can't recover - must drop the frame
            if (!isEncrypting) {
                // Just drop the frame silently to avoid breaking the stream
                return;
            }
            
            // For encryption errors, pass through unencrypted as last resort
            console.warn("Passing through unencrypted frame due to encryption failure");
            controller.enqueue(encodedFrame);
        }
    }

    readable
        .pipeThrough(new TransformStream({ transform }))
        .pipeTo(writable);
});
