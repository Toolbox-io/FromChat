/**
 * Service for syncing sent message plaintexts with the server
 * Plaintexts are encrypted with password-derived key and stored on server
 */

import { encryptMessagePlaintext, decryptMessagePlaintext } from "./messagePlaintextEncryption";
import { uploadMessagePlaintexts, fetchMessagePlaintexts } from "@/core/api/crypto/messagePlaintexts";

// Global state for message plaintext sync
let syncPassword: string | null = null;
let syncToken: string | null = null;
let syncUserId: string | null = null;

/**
 * Initialize message plaintext sync - stores password and userId for encryption
 * Called after login when password is available
 */
export function initializeMessagePlaintextSync(userId: string, password: string, token: string): void {
    console.log("Initializing message plaintext sync for user", userId);
    syncUserId = userId;
    syncPassword = password;
    syncToken = token;
}

/**
 * Clear message plaintext sync - called on logout
 */
export function clearMessagePlaintextSync(): void {
    console.log("Clearing message plaintext sync state");
    syncUserId = null;
    syncPassword = null;
    syncToken = null;
}

/**
 * Upload a sent message's plaintext to the server (encrypted)
 * Called when a message is sent and confirmed
 */
export async function uploadMessagePlaintext(
    messageId: number,
    recipientId: number,
    plaintext: string
): Promise<void> {
    if (!syncPassword || !syncToken || !syncUserId) {
        console.warn("Message plaintext sync not initialized (missing password/token/userId)");
        return; // Not initialized yet
    }

    try {
        console.log(`Encrypting plaintext for message ${messageId}...`);
        // Use stored key if available, otherwise use password to derive it
        const encryptedData = await encryptMessagePlaintext(syncPassword, syncUserId, plaintext);
        
        console.log(`Uploading plaintext for message ${messageId} to server...`);
        await uploadMessagePlaintexts([
            {
                messageId,
                recipientId,
                encryptedData
            }
        ], syncToken);
        console.log(`Successfully uploaded plaintext for message ${messageId} to server`);
    } catch (error) {
        console.error("Failed to upload message plaintext to server:", error);
        // Don't throw - message is already sent, plaintext upload failure shouldn't break anything
    }
}

/**
 * Fetch and decrypt message plaintexts from the server
 * Called when loading message history
 */
export async function fetchMessagePlaintextsForRecipient(
    recipientId: number
): Promise<Map<number, string>> {
    const plaintexts = new Map<number, string>();
    
    // Try to get token and userId from global state if sync isn't initialized
    let token = syncToken;
    let userId = syncUserId;
    let password = syncPassword;
    
    if (!token || !userId) {
        // Fallback: try to get from user store
        try {
            const { useUserStore } = await import("@/state/user");
            const userState = useUserStore.getState().user;
            if (userState.authToken && userState.currentUser?.id) {
                token = userState.authToken;
                userId = userState.currentUser.id.toString();
                console.log(`[MessagePlaintextSync] Using token/userId from user store (sync not initialized)`);
            } else {
                console.warn("Message plaintext sync not initialized (missing token/userId)");
                return plaintexts; // Return empty map if not initialized
            }
        } catch (error) {
            console.warn("Message plaintext sync not initialized (missing token/userId)");
            return plaintexts; // Return empty map if not initialized
        }
    }
    
    // Password can be null - decryptMessagePlaintext will use stored session key if password is null

    try {
        console.log(`Fetching encrypted plaintexts for recipient ${recipientId}...`);
        const encryptedMessages = await fetchMessagePlaintexts(token, recipientId);
        
        console.log(`Found ${encryptedMessages.length} encrypted plaintexts, decrypting...`);
        
        for (const msg of encryptedMessages) {
            try {
                // Use stored key if available, otherwise use password to derive it
                const plaintext = await decryptMessagePlaintext(password, userId, msg.encryptedData);
                plaintexts.set(msg.messageId, plaintext);
            } catch (error) {
                console.warn(`Failed to decrypt plaintext for message ${msg.messageId}:`, error);
                // Continue with other messages
            }
        }
        
        console.log(`Decrypted ${plaintexts.size}/${encryptedMessages.length} plaintexts`);
    } catch (error) {
        console.error("Failed to fetch message plaintexts from server:", error);
        // Don't throw - allow history loading to continue even if plaintext fetch fails
    }
    
    return plaintexts;
}

