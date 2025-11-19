import { randomBytes } from "@/utils/crypto/kdf";
import { b64, ub64 } from "@/utils/utils";
import { SignalProtocolService } from "@/utils/crypto/signalProtocol";
import { useUserStore } from "@/state/user";
import { fetchPreKeyBundle } from "@/core/api/crypto";
import { getAuthToken } from "@/core/api/account";

export interface CallSessionKey {
    key: Uint8Array;
    hash: string; // For emoji display
}

/**
 * Generates a new call session key for end-to-end encryption
 * @returns Promise that resolves to a session key with its hash for display
 */
export async function generateCallSessionKey(): Promise<CallSessionKey> {
    // Generate session key material
    const sessionKeyMaterial = randomBytes(32);

    // Generate hash for emoji display (first 4 bytes of SHA-256 hash)
    const hashBuffer = await crypto.subtle.digest("SHA-256", sessionKeyMaterial.buffer as ArrayBuffer);
    const hash = b64(new Uint8Array(hashBuffer.slice(0, 4)));

    return {
        key: sessionKeyMaterial,
        hash
    };
}

/**
 * Rotate a session key by generating a completely new key
 * This provides forward secrecy for long-running calls
 */
export async function rotateCallSessionKey(): Promise<CallSessionKey> {
    // Generate new session key material (completely independent of current key)
    const newSessionKeyMaterial = randomBytes(32);

    // Generate new hash for emoji display
    const hashBuffer = await crypto.subtle.digest("SHA-256", newSessionKeyMaterial.buffer as ArrayBuffer);
    const newHash = b64(new Uint8Array(hashBuffer.slice(0, 4)));

    return {
        key: newSessionKeyMaterial,
        hash: newHash
    };
}

/**
 * Generate 4 emojis representing the call session key
 */
export function generateCallEmojis(sessionKeyHash: string): string[] {
    // Convert hash to numbers and map to emoji ranges
    const hashBytes = new Uint8Array(ub64(sessionKeyHash));
    const emojis: string[] = [];

    // Different emoji categories for variety
    const emojiSets = [
        ["🎵", "🎶", "🎤", "🎧", "🎼", "🎹", "🥁", "🎺", "🎸", "🎻"], // Music
        ["🔥", "💫", "⭐", "✨", "🌟", "💥", "⚡", "🌈", "🎆", "🎇"], // Energy
        ["🚀", "🛸", "🛰️", "🌌", "🔭", "⚙️", "🔧", "⚡", "💡", "🔬"], // Tech/Space
        ["🎭", "🎪", "🎨", "🎬", "📷", "🎥", "📺", "🎮", "🕹️", "🎯"]  // Entertainment
    ];

    for (let i = 0; i < 4; i++) {
        const set = emojiSets[i % emojiSets.length];
        const index = hashBytes[i % hashBytes.length] % set.length;
        emojis.push(set[index]);
    }

    return emojis;
}

/**
 * Encrypts a call session key using Signal Protocol
 * @param recipientId - The recipient's user ID
 * @param sessionKey - The session key to encrypt
 * @returns Promise that resolves to encrypted session key data
 */
export async function encryptCallSessionKey(recipientId: number, sessionKey: Uint8Array): Promise<{ type: number; body: string }> {
    const user = useUserStore.getState().user.currentUser;
    if (!user?.id) {
        throw new Error("User not authenticated");
    }

    const signalService = new SignalProtocolService(user.id.toString());
    
    // Ensure we have a session with the recipient
    const hasSession = await signalService.hasSession(recipientId);
    if (!hasSession) {
        // Fetch prekey bundle and establish session
        const token = getAuthToken();
        if (!token) {
            throw new Error("No auth token");
        }
        
        const bundle = await fetchPreKeyBundle(recipientId, token);
        if (!bundle) {
            throw new Error("No prekey bundle available for recipient");
        }
        
        await signalService.processPreKeyBundle(recipientId, bundle);
    }
    
    // Encrypt the session key using Signal Protocol
    const sessionKeyString = b64(sessionKey);
    const encrypted = await signalService.encryptMessage(recipientId, sessionKeyString);
    
    return encrypted;
}

/**
 * Decrypts a call session key using Signal Protocol
 * @param senderId - The sender's user ID
 * @param encryptedKey - The encrypted session key data
 * @returns Promise that resolves to the decrypted session key
 */
export async function decryptCallSessionKey(senderId: number, encryptedKey: { type: number; body: string }): Promise<Uint8Array> {
    const user = useUserStore.getState().user.currentUser;
    if (!user?.id) {
        throw new Error("User not authenticated");
    }

    const signalService = new SignalProtocolService(user.id.toString());
    
    // Decrypt using Signal Protocol
    const decryptedString = await signalService.decryptMessage(senderId, encryptedKey);
    
    // Convert back to Uint8Array
    const sessionKey = new Uint8Array(
        atob(decryptedString).split("").map(c => c.charCodeAt(0))
    );
    
    return sessionKey;
}
