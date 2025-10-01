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
}

addEventListener("rtctransform", (event) => {
    const { transformer } = event;
    const { readable, writable } = transformer;
    const { key, mode } = transformer.options as WorkerOptions;
    const ivBase = new Uint8Array(12);
    let counter = 0;

    async function transform(encodedFrame: EncodedFrame, controller: TransformStreamDefaultController<EncodedFrame>) {
        try {
            const iv = ivBase.slice();
            const view = new DataView(iv.buffer);
            view.setUint32(8, counter++);
            const data = new Uint8Array(encodedFrame.data);

            const params: AesGcmParams = { name: 'AES-GCM', iv };
            
            let result: ArrayBuffer;
            if (mode === 'encrypt') {
                result = await crypto.subtle.encrypt(params, key, data);
            } else {
                result = await crypto.subtle.decrypt(params, key, data);
            }
            
            encodedFrame.data = new Uint8Array(result);
            controller.enqueue(encodedFrame);
        } catch (e) {
            controller.enqueue(encodedFrame);
        }
    }

    readable
        .pipeThrough(new TransformStream({ transform }))
        .pipeTo(writable);
});
