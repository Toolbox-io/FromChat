import { importAesGcmKey, aesGcmEncrypt, aesGcmDecrypt } from "@/utils/crypto/symmetric";
import { randomBytes } from "@/utils/crypto/kdf";
import { b64, ub64 } from "@/utils/utils";
import { ecdhSharedSecret, deriveWrappingKey } from "@/utils/crypto/asymmetric";
import { getCurrentKeys } from "@/core/api/authApi";

export interface CallSessionKey {
    key: Uint8Array;
    hash: string; // For emoji display
}

export interface CallKeyExchange {
    type: "call_key_exchange";
    sessionKeyHash: string;
    encryptedSessionKey: EncryptedCallMessage;
}

export interface EncryptedCallMessage {
    iv: string;
    ciphertext: string;
    salt: string;
    iv2: string;
    wrappedSessionKey: string;
}

/**
 * Generate a call session key (for initiator only)
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
export async function rotateCallSessionKey(_currentSessionKey: CallSessionKey): Promise<CallSessionKey> {
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
 * Create session key from hash (for backward compatibility)
 * @deprecated Use deriveCallSessionKeyFromSharedSecret instead
 */
export async function createCallSessionKeyFromHash(hash: string): Promise<CallSessionKey> {
    // For backward compatibility, generate a deterministic key from the hash
    const hashBytes = ub64(hash);
    const sessionKey = new Uint8Array(32);
    
    // Repeat the hash bytes to fill 32 bytes
    for (let i = 0; i < 32; i++) {
        sessionKey[i] = hashBytes[i % hashBytes.length];
    }
    
    return {
        key: sessionKey,
        hash
    };
}

/**
 * Derive session key from ECDH shared secret and session key hash
 * This creates a deterministic but cryptographically secure key
 */
export async function deriveCallSessionKeyFromSharedSecret(
    sharedSecret: Uint8Array, 
    sessionKeyHash: string,
    isInitiator: boolean
): Promise<CallSessionKey> {
    // Use HKDF to derive the session key from the shared secret
    // Include the session key hash and role to ensure uniqueness
    const info = new TextEncoder().encode(`call-session-${sessionKeyHash}-${isInitiator ? 'initiator' : 'receiver'}`);
    const salt = new Uint8Array(32); // Zero salt for deterministic derivation
    
    // Import the shared secret as a raw key for HKDF
    const sharedKey = await crypto.subtle.importKey(
        'raw',
        sharedSecret.buffer as ArrayBuffer,
        { name: 'HKDF' },
        false,
        ['deriveKey']
    );
    
    // Derive the session key using HKDF
    const sessionKey = await crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: salt,
            info: info
        },
        sharedKey,
        { name: 'AES-GCM', length: 256 },
        true, // Make the key extractable so we can export it
        ['encrypt', 'decrypt']
    );
    
    // Export the raw key material
    const sessionKeyMaterial = await crypto.subtle.exportKey('raw', sessionKey);
    
    return {
        key: new Uint8Array(sessionKeyMaterial),
        hash: sessionKeyHash
    };
}

/**
 * Encrypt a call signaling message with the session key
 */
export async function encryptCallMessage(message: any, sessionKey: Uint8Array): Promise<EncryptedCallMessage> {
    const messageKey = await importAesGcmKey(sessionKey);
    const encrypted = await aesGcmEncrypt(messageKey, new TextEncoder().encode(JSON.stringify(message)));
    
    return {
        iv: b64(encrypted.iv),
        ciphertext: b64(encrypted.ciphertext),
        salt: "", // Not used for message encryption, only for key wrapping
        iv2: "",
        wrappedSessionKey: ""
    };
}

/**
 * Decrypt a call signaling message
 */
export async function decryptCallMessage(encryptedMessage: EncryptedCallMessage, sessionKey: Uint8Array): Promise<any> {
    const messageKey = await importAesGcmKey(sessionKey);
    const decrypted = await aesGcmDecrypt(messageKey, ub64(encryptedMessage.iv), ub64(encryptedMessage.ciphertext));
    return JSON.parse(new TextDecoder().decode(decrypted));
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

// HKDF info for CALL key wrapping (distinct from DM's info)
const CALL_INFO = new Uint8Array([2]);

export interface WrappedSessionKeyPayload {
    salt: string; // b64 salt used in HKDF
    iv2: string; // b64 IV used to wrap session key
    wrapped: string; // b64 ciphertext of wrapped session key
}

/**
 * Wrap a session key for a recipient using ECDH (X25519) and AES-GCM
 */
export async function wrapCallSessionKeyForRecipient(recipientPublicKeyB64: string, sessionKey: Uint8Array): Promise<WrappedSessionKeyPayload> {
    const keys = getCurrentKeys();
    if (!keys) throw new Error("Keys not initialized");

    const salt = randomBytes(16);
    const shared = ecdhSharedSecret(keys.privateKey, ub64(recipientPublicKeyB64));
    const wkRaw = await deriveWrappingKey(shared, salt, CALL_INFO);
    const wk = await importAesGcmKey(wkRaw);
    const wrap = await aesGcmEncrypt(wk, sessionKey);
    return {
        salt: b64(salt),
        iv2: b64(wrap.iv),
        wrapped: b64(wrap.ciphertext)
    };
}

/**
 * Create a shared secret and derive session key for the receiver
 */
export async function createSharedSecretAndDeriveSessionKey(
    senderPublicKeyB64: string,
    sessionKeyHash: string,
    isInitiator: boolean
): Promise<CallSessionKey> {
    const keys = getCurrentKeys();
    if (!keys) throw new Error("Keys not initialized");

    // Create shared secret using ECDH
    const sharedSecret = ecdhSharedSecret(keys.privateKey, ub64(senderPublicKeyB64));
    
    // Derive the session key from the shared secret
    return await deriveCallSessionKeyFromSharedSecret(sharedSecret, sessionKeyHash, isInitiator);
}

/**
 * Unwrap a received session key using sender's public key
 */
export async function unwrapCallSessionKeyFromSender(senderPublicKeyB64: string, payload: WrappedSessionKeyPayload): Promise<Uint8Array> {
    const keys = getCurrentKeys();
    if (!keys) throw new Error("Keys not initialized");

    const salt = ub64(payload.salt);
    const shared = ecdhSharedSecret(keys.privateKey, ub64(senderPublicKeyB64));
    const wkRaw = await deriveWrappingKey(shared, salt, CALL_INFO);
    const wk = await importAesGcmKey(wkRaw);
    const sessionKey = await aesGcmDecrypt(wk, ub64(payload.iv2), ub64(payload.wrapped));
    return new Uint8Array(sessionKey);
}
