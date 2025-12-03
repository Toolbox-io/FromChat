/**
 * Service for syncing Signal Protocol sessions with the server
 * Sessions are encrypted with password-derived key and stored on server
 */

import { SignalProtocolStorage, setSessionSyncCallback, setRestoring } from "./signalStorage";
import { encryptSessionWithPassword, decryptSessionWithPassword, encodeSessionBlob, decodeSessionBlob } from "./sessionEncryption";
import { uploadSessions, fetchSessions, type SessionData } from "@/core/api/crypto/sessions";

// Global state for session sync
let syncPassword: string | null = null;
let syncToken: string | null = null;
let syncUserId: string | null = null;

/**
 * Initialize session sync - sets up automatic upload of sessions when they're created
 * Called after login when password is available
 */
export function initializeSessionSync(userId: string, password: string, token: string): void {
    console.log("Initializing session sync for user", userId);
    syncUserId = userId;
    syncPassword = password;
    syncToken = token;
    
    // Set up callback to upload sessions when they're stored
    setSessionSyncCallback(async (address: string, record: string) => {
        console.log(`Session sync callback invoked for address: ${address}`);
        if (!syncPassword || !syncToken || !syncUserId) {
            console.warn("Session sync not initialized (missing password/token/userId)");
            return; // Not initialized yet
        }
        
        try {
            const parts = address.split(".");
            const recipientId = parseInt(parts[0], 10);
            const deviceId = parts.length > 1 ? parseInt(parts[1], 10) : 1;
            
            if (isNaN(recipientId)) {
                console.warn(`Invalid address format: ${address}`);
                return;
            }
            
            console.log(`Encrypting session for recipient ${recipientId}...`);
            const encryptedBlob = await encryptSessionWithPassword(syncPassword, record);
            const encryptedData = encodeSessionBlob(encryptedBlob);
            
            console.log(`Uploading session for recipient ${recipientId} to server...`);
            await uploadSessions([
                {
                    recipientId,
                    deviceId,
                    encryptedData
                }
            ], syncToken);
            console.log(`Successfully uploaded session for recipient ${recipientId} to server`);
        } catch (error) {
            console.error("Failed to sync session to server:", error);
            // Don't throw - session is already stored in IndexedDB, sync failure shouldn't break anything
        }
    });
    console.log("Session sync callback set successfully");
}

/**
 * Clear session sync - called on logout
 */
export function clearSessionSync(): void {
    syncUserId = null;
    syncPassword = null;
    syncToken = null;
    setSessionSyncCallback(null);
}

/**
 * Restore all sessions from server and populate IndexedDB
 * Called after login when password is available
 */
export async function restoreSessionsFromServer(
    userId: string,
    password: string,
    token: string
): Promise<void> {
    try {
        console.log("Restoring sessions from server...");
        
        // Fetch encrypted sessions from server
        const encryptedSessions = await fetchSessions(token);
        
        if (encryptedSessions.length === 0) {
            console.log("No sessions to restore from server");
            return; // No sessions to restore
        }
        
        console.log(`Found ${encryptedSessions.length} sessions on server, restoring...`);
        
        const storage = new SignalProtocolStorage(userId);
        
        // Set restoring flag to prevent sync callback from re-uploading restored sessions
        setRestoring(true);
        
        let restoredCount = 0;
        let failedCount = 0;
        
        try {
            // Decrypt and restore each session
            for (const sessionData of encryptedSessions) {
                try {
                    const address = `${sessionData.recipientId}.${sessionData.deviceId}`;
                    
                    // Check if we already have a local session - if so, skip restoration
                    // This prevents overwriting a newer session with an older one
                    const existingSession = await storage.loadSession(address);
                    if (existingSession) {
                        console.log(`Skipping restoration for recipient ${sessionData.recipientId} - local session already exists`);
                        continue;
                    }
                    
                    const encryptedBlob = decodeSessionBlob(sessionData.encryptedData);
                    const sessionRecord = await decryptSessionWithPassword(password, encryptedBlob);
                    
                    // Store in IndexedDB (sync callback won't fire because isRestoring is true)
                    await storage.storeSession(address, sessionRecord);
                    restoredCount++;
                    console.log(`Restored session for recipient ${sessionData.recipientId}`);
                } catch (error) {
                    failedCount++;
                    console.warn(`Failed to restore session for recipient ${sessionData.recipientId}:`, error);
                    // Continue with other sessions
                }
            }
        } finally {
            // Always clear the restoring flag
            setRestoring(false);
        }
        
        console.log(`Restored ${restoredCount}/${encryptedSessions.length} sessions from server${failedCount > 0 ? ` (${failedCount} failed)` : ""}`);
    } catch (error) {
        console.error("Failed to restore sessions from server:", error);
        // Don't throw - allow login to continue even if session restore fails
    }
}

/**
 * Upload all sessions to server
 * Called after login/registration to backup all current sessions
 */
export async function uploadAllSessionsToServer(
    userId: string,
    password: string,
    token: string
): Promise<void> {
    try {
        console.log("Uploading sessions to server...");
        
        const storage = new SignalProtocolStorage(userId);
        
        // Get all sessions from IndexedDB
        const sessions = await storage.getAllSessions();
        
        if (sessions.length === 0) {
            console.log("No sessions in IndexedDB to upload");
            return; // No sessions to upload
        }
        
        console.log(`Found ${sessions.length} sessions in IndexedDB, uploading...`);
        
        // Encrypt and prepare sessions for upload
        const sessionData: SessionData[] = [];
        let failedCount = 0;
        
        for (const { address, record } of sessions) {
            try {
                // Parse address to get recipientId and deviceId
                const parts = address.split(".");
                const recipientId = parseInt(parts[0], 10);
                const deviceId = parts.length > 1 ? parseInt(parts[1], 10) : 1;
                
                if (isNaN(recipientId)) {
                    console.warn(`Invalid address format: ${address}`);
                    failedCount++;
                    continue;
                }
                
                // Encrypt session record
                const encryptedBlob = await encryptSessionWithPassword(password, record);
                const encryptedData = encodeSessionBlob(encryptedBlob);
                
                sessionData.push({
                    recipientId,
                    deviceId,
                    encryptedData
                });
            } catch (error) {
                failedCount++;
                console.warn(`Failed to encrypt session ${address}:`, error);
                // Continue with other sessions
            }
        }
        
        if (sessionData.length > 0) {
            await uploadSessions(sessionData, token);
            console.log(`Uploaded ${sessionData.length} sessions to server${failedCount > 0 ? ` (${failedCount} failed)` : ""}`);
        } else if (failedCount > 0) {
            console.warn(`Failed to upload all ${sessions.length} sessions to server`);
        }
    } catch (error) {
        console.error("Failed to upload sessions to server:", error);
        // Don't throw - allow login to continue even if upload fails
    }
}

/**
 * Store a session in IndexedDB and upload to server
 * This should be called instead of direct storage.storeSession when password is available
 */
export async function storeSessionWithSync(
    userId: string,
    address: string,
    record: string,
    password: string,
    token: string
): Promise<void> {
    const storage = new SignalProtocolStorage(userId);
    
    // Store in IndexedDB first (for immediate use)
    await storage.storeSession(address, record);
    
    // Parse address to get recipientId and deviceId
    const parts = address.split(".");
    const recipientId = parseInt(parts[0], 10);
    const deviceId = parts.length > 1 ? parseInt(parts[1], 10) : 1;
    
    if (isNaN(recipientId)) {
        console.warn(`Invalid address format: ${address}`);
        return;
    }
    
    // Encrypt and upload to server
    try {
        const encryptedBlob = await encryptSessionWithPassword(password, record);
        const encryptedData = encodeSessionBlob(encryptedBlob);
        
        await uploadSessions([
            {
                recipientId,
                deviceId,
                encryptedData
            }
        ], token);
    } catch (error) {
        console.error("Failed to upload session to server:", error);
        // Don't throw - session is still stored in IndexedDB
    }
}

/**
 * Remove a session from IndexedDB
 * Note: We don't remove from server immediately because we need password for encryption.
 * Stale sessions on server will be overwritten on next login when we upload all current sessions.
 */
export async function removeSessionLocal(
    userId: string,
    address: string
): Promise<void> {
    const storage = new SignalProtocolStorage(userId);
    await storage.removeSession(address);
}

