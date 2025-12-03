/**
 * Functions for deriving and storing a stable key from password
 * This key is used to encrypt/decrypt sessions on the server
 */

import { importPassword, deriveKEK } from "./kdf";
import { b64, ub64 } from "../utils";

const SESSION_KEY_SALT_PREFIX = "fromchat.session-key:";

/**
 * Derive a stable key from password using user ID as salt
 * User ID never changes, so this key will always be the same for a given password
 * This key can be stored in localStorage and used to encrypt/decrypt sessions
 */
export async function deriveSessionKey(password: string, userId: string): Promise<CryptoKey> {
    const salt = new TextEncoder().encode(`${SESSION_KEY_SALT_PREFIX}${userId}`);
    const pw = await importPassword(password);
    // Make the key extractable so we can store it in localStorage
    return await deriveKEK(pw, salt, 210_000, true);
}

/**
 * Export a CryptoKey to a base64 string for storage
 */
export async function exportKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey("raw", key);
    return b64(new Uint8Array(exported));
}

/**
 * Import a base64 string back to a CryptoKey
 */
export async function importKey(keyString: string): Promise<CryptoKey> {
    const keyBytes = ub64(keyString);
    // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
    // Create a new ArrayBuffer copy to avoid SharedArrayBuffer issues
    const keyArray = new Uint8Array(keyBytes);
    const keyBuffer = keyArray.buffer;
    return await crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

/**
 * Store the session key in localStorage
 */
export function storeSessionKey(userId: string, keyString: string): void {
    try {
        localStorage.setItem(`sessionKey:${userId}`, keyString);
        console.log(`[SessionKeyStorage] ✅ Stored session key for user ${userId} (length: ${keyString.length})`);
    } catch (error) {
        console.error("[SessionKeyStorage] ❌ Failed to store session key:", error);
    }
}

/**
 * Retrieve the session key from localStorage
 */
export function getStoredSessionKey(userId: string): string | null {
    try {
        const key = localStorage.getItem(`sessionKey:${userId}`);
        if (key) {
            console.log(`[SessionKeyStorage] ✅ Retrieved stored session key for user ${userId} (length: ${key.length})`);
        } else {
            console.log(`[SessionKeyStorage] ⚠️ No stored session key found for user ${userId}`);
        }
        return key;
    } catch (error) {
        console.error("[SessionKeyStorage] ❌ Failed to get session key:", error);
        return null;
    }
}

/**
 * Clear the session key from localStorage
 */
export function clearSessionKey(userId: string): void {
    try {
        localStorage.removeItem(`sessionKey:${userId}`);
    } catch (error) {
        console.error("Failed to clear session key:", error);
    }
}

