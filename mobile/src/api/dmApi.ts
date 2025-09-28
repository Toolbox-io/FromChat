import { API_BASE_URL } from "../core/config";
import { getAuthHeaders } from "../auth/api";
import type { DmEnvelope, DmEncryptedJSON, EncryptedMessageJson, Message } from "../core/types";

/**
 * Fetch user public key
 */
export async function fetchUserPublicKey(
    userId: number,
    token: string
): Promise<string> {
    const headers = getAuthHeaders(token, true);
    const response = await fetch(`${API_BASE_URL}/dm/key/${userId}`, {
        headers,
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch user public key: ${response.statusText}`);
    }

    const data = await response.json();
    return data.publicKey;
}

/**
 * Fetch DM history between two users
 */
export async function fetchDMHistory(
    recipientId: number,
    token: string
): Promise<DmEnvelope[]> {
    const headers = getAuthHeaders(token, true);
    const response = await fetch(`${API_BASE_URL}/dm/history/${recipientId}`, {
        headers,
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch DM history: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Decrypt a DM envelope
 */
export async function decryptDm(
    envelope: DmEnvelope,
    privateKey: Uint8Array
): Promise<string> {
    // Implementation for decrypting DM
    // This would use the crypto utilities
    // For now, return a placeholder
    return "Decrypted message content";
}

/**
 * Send DM via WebSocket
 */
export async function sendDMViaWebSocket(
    recipientId: number,
    content: string,
    token: string
): Promise<void> {
    // Implementation for sending DM via WebSocket
    throw new Error("Not implemented yet");
}

/**
 * Send DM with files
 */
export async function sendDmWithFiles(
    recipientId: number,
    content: string,
    files: File[],
    token: string
): Promise<void> {
    // Implementation for sending DM with files
    throw new Error("Not implemented yet");
}

/**
 * Edit DM envelope
 */
export async function editDmEnvelope(
    envelopeId: number,
    newContent: string,
    token: string
): Promise<void> {
    // Implementation for editing DM
    throw new Error("Not implemented yet");
}

/**
 * Delete DM envelope
 */
export async function deleteDmEnvelope(
    envelopeId: number,
    token: string
): Promise<void> {
    // Implementation for deleting DM
    throw new Error("Not implemented yet");
}