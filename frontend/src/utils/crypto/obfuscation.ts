import { randomBytes } from "./kdf";

/**
 * Padding sizes that look like normal HTTP/WebSocket traffic
 * These sizes are common in real web traffic to avoid fingerprinting
 */
const PADDING_BUCKETS = [64, 128, 256, 512, 1024, 2048, 4096];

/**
 * Adds padding to a message to make it resistant to size-based fingerprinting
 * Pads to the nearest bucket size to make all messages look similar
 * @param data - The data to pad
 * @returns Padded data with padding length prefix
 */
export function addPadding(data: string): string {
    const dataBytes = new TextEncoder().encode(data);
    const dataSize = dataBytes.length;
    
    // Find the smallest bucket that fits the data
    let targetSize = PADDING_BUCKETS[PADDING_BUCKETS.length - 1];
    for (const bucket of PADDING_BUCKETS) {
        if (bucket >= dataSize + 4) { // +4 for padding length header
            targetSize = bucket;
            break;
        }
    }
    
    // Calculate padding needed (subtract data size and 4-byte length header)
    const paddingSize = targetSize - dataSize - 4;
    const padding = randomBytes(Math.max(0, paddingSize));
    
    // Create padded message: [4-byte length][data][random padding]
    const lengthBytes = new Uint8Array(4);
    const view = new DataView(lengthBytes.buffer);
    view.setUint32(0, dataSize, true); // Little-endian
    
    const padded = new Uint8Array(4 + dataSize + padding.length);
    padded.set(lengthBytes, 0);
    padded.set(dataBytes, 4);
    padded.set(padding, 4 + dataSize);
    
    // Return as base64 for easy transmission
    // Use chunked approach to avoid "Maximum call stack size exceeded" for large arrays
    // Convert Uint8Array to base64 in chunks
    const chunkSize = 8192;
    let binary = '';
    for (let i = 0; i < padded.length; i += chunkSize) {
        const chunk = padded.slice(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
}

/**
 * Removes padding from a message
 * @param paddedData - The padded data (base64)
 * @returns Original unpadded data
 */
export function removePadding(paddedData: string): string {
    try {
        const padded = Uint8Array.from(atob(paddedData), c => c.charCodeAt(0));
        
        // Read length from first 4 bytes
        const view = new DataView(padded.buffer);
        const dataSize = view.getUint32(0, true); // Little-endian
        
        // Extract original data
        const data = padded.slice(4, 4 + dataSize);
        return new TextDecoder().decode(data);
    } catch (error) {
        // If padding removal fails, assume it's an old message without padding
        return paddedData;
    }
}


