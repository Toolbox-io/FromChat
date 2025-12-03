/**
 * Functions for encrypting/decrypting Signal Protocol session data
 * Uses a stable key derived from password (stored in localStorage as a hash)
 */

import { aesGcmDecrypt, aesGcmEncrypt } from "./symmetric";
import { randomBytes } from "./kdf";
import { b64, ub64 } from "../utils";
import { deriveSessionKey, exportKey, importKey, storeSessionKey, getStoredSessionKey } from "./sessionKeyStorage";

export interface EncryptedSessionData {
    salt: Uint8Array; // Random salt (kept for backward compatibility, not used for key derivation)
    iv: Uint8Array; // AES-GCM IV
    ciphertext: Uint8Array; // encrypted session record (string)
}

/**
 * Encrypt session record using stored session key (derived from password)
 * If password is provided and key is not stored, derive and store it
 * If password is not provided, use stored key (for page refresh scenarios)
 */
export async function encryptSessionWithPassword(password: string | null, userId: string, sessionRecord: string): Promise<EncryptedSessionData> {
    // Derive or get the stored session key
    let sessionKey: CryptoKey;
    const storedKeyString = getStoredSessionKey(userId);
    
    if (storedKeyString) {
        // Use stored key (works even without password on page refresh)
        sessionKey = await importKey(storedKeyString);
    } else if (password) {
        // Derive new key and store it (as a "hash" - it's actually the derived key)
        sessionKey = await deriveSessionKey(password, userId);
        const keyString = await exportKey(sessionKey);
        storeSessionKey(userId, keyString);
    } else {
        throw new Error("Cannot encrypt session: no stored key and no password provided");
    }
    
    // Generate random salt for backward compatibility (not used for key derivation)
    const salt = randomBytes(16);
    const sessionBytes = new TextEncoder().encode(sessionRecord);
    
    // Encrypt using the stable key (aesGcmEncrypt generates its own IV)
    const { iv, ciphertext } = await aesGcmEncrypt(sessionKey, sessionBytes);
    return { salt, iv, ciphertext };
}

/**
 * Decrypt session record using stored session key
 * If password is provided and key is not stored, derive and store it
 * If password is not provided, use stored key (for page refresh scenarios)
 */
export async function decryptSessionWithPassword(password: string | null, userId: string, blob: EncryptedSessionData): Promise<string> {
    // Get or derive the session key
    let sessionKey: CryptoKey;
    const storedKeyString = getStoredSessionKey(userId);
    
    if (storedKeyString) {
        // Use stored key (works even without password on page refresh)
        sessionKey = await importKey(storedKeyString);
    } else if (password) {
        // Derive key from password and store it
        sessionKey = await deriveSessionKey(password, userId);
        const keyString = await exportKey(sessionKey);
        storeSessionKey(userId, keyString);
    } else {
        throw new Error("Cannot decrypt session: no stored key and no password provided");
    }
    
    const plaintext = await aesGcmDecrypt(sessionKey, blob.iv, blob.ciphertext);
    return new TextDecoder().decode(plaintext);
}

/**
 * Encode encrypted session data to JSON string for storage
 */
export function encodeSessionBlob(blob: EncryptedSessionData): string {
    return JSON.stringify({
        salt: b64(blob.salt),
        iv: b64(blob.iv),
        ciphertext: b64(blob.ciphertext)
    });
}

/**
 * Decode encrypted session data from JSON string
 */
export function decodeSessionBlob(json: string): EncryptedSessionData {
    const obj = JSON.parse(json);
    return {
        salt: ub64(obj.salt),
        iv: ub64(obj.iv),
        ciphertext: ub64(obj.ciphertext)
    };
}

