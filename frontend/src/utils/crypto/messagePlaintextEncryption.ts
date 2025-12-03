/**
 * Functions for encrypting/decrypting sent message plaintexts
 * Uses password-derived key (same as session encryption)
 */

import { encryptSessionWithPassword, decryptSessionWithPassword, encodeSessionBlob, decodeSessionBlob } from "./sessionEncryption";

/**
 * Encrypt message plaintext using password-derived key
 */
export async function encryptMessagePlaintext(password: string | null, userId: string, plaintext: string): Promise<string> {
    const encrypted = await encryptSessionWithPassword(password, userId, plaintext);
    return encodeSessionBlob(encrypted);
}

/**
 * Decrypt message plaintext using password-derived key
 */
export async function decryptMessagePlaintext(password: string | null, userId: string, encryptedData: string): Promise<string> {
    const blob = decodeSessionBlob(encryptedData);
    return await decryptSessionWithPassword(password, userId, blob);
}

