/**
 * Functions for encrypting/decrypting Signal Protocol session data
 * Uses password-derived key (same as backup encryption)
 */

import { aesGcmDecrypt, aesGcmEncrypt } from "./symmetric";
import { importPassword, deriveKEK, randomBytes } from "./kdf";
import { b64, ub64 } from "../utils";

export interface EncryptedSessionData {
    salt: Uint8Array; // for PBKDF2 derivation of KEK
    iv: Uint8Array; // AES-GCM IV
    ciphertext: Uint8Array; // encrypted session record (string)
}

/**
 * Encrypt session record using password-derived key
 */
export async function encryptSessionWithPassword(password: string, sessionRecord: string): Promise<EncryptedSessionData> {
    const salt = randomBytes(16);
    const pw = await importPassword(password);
    const kek = await deriveKEK(pw, salt);
    const sessionBytes = new TextEncoder().encode(sessionRecord);
    const { iv, ciphertext } = await aesGcmEncrypt(kek, sessionBytes);
    return { salt, iv, ciphertext };
}

/**
 * Decrypt session record using password-derived key
 */
export async function decryptSessionWithPassword(password: string, blob: EncryptedSessionData): Promise<string> {
    const pw = await importPassword(password);
    const kek = await deriveKEK(pw, blob.salt);
    const plaintext = await aesGcmDecrypt(kek, blob.iv, blob.ciphertext);
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

