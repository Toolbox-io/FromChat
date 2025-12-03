/**
 * Centralized Signal Protocol initialization
 * Used in login, register, and token restoration
 */

import { SignalProtocolService } from "./signalProtocol";
import { uploadAllPreKeys } from "@/core/api/crypto/prekeys";
import { initializeSessionSync, restoreSessionsFromServer, uploadAllSessionsToServer } from "./sessionSync";
import { initializeMessagePlaintextSync } from "./messagePlaintextSync";
import { deriveSessionKey, exportKey, storeSessionKey } from "./sessionKeyStorage";

export interface SignalProtocolInitOptions {
    userId: string;
    password: string;
    token: string;
    restoreSessions?: boolean;
    uploadSessions?: boolean;
}

/**
 * Initialize Signal Protocol with all necessary setup
 * This function handles:
 * - Signal Protocol service initialization
 * - Session key derivation and storage
 * - Session sync initialization
 * - Message plaintext sync initialization
 * - Prekey bundle upload
 * - Session restoration from server (optional)
 * - Plaintext restoration from server (optional)
 * - Session upload to server (optional)
 * - Plaintext upload to server (optional)
 */
export async function initializeSignalProtocol({
    userId,
    password,
    token,
    restoreSessions = false,
    uploadSessions = false
}: SignalProtocolInitOptions): Promise<void> {
    console.log("========================================");
    console.log("[Signal Protocol Init] 🚀 STARTING SIGNAL PROTOCOL INITIALIZATION");
    console.log("[Signal Protocol Init] User ID:", userId);
    console.log("[Signal Protocol Init] Has password:", !!password);
    console.log("[Signal Protocol Init] Has token:", !!token);
    console.log("========================================");

    try {
        // Step 1: Derive and store session key
        console.log("[Signal Protocol Init] Step 1: Deriving session key...");
        const sessionKey = await deriveSessionKey(password, userId);
        const keyString = await exportKey(sessionKey);
        storeSessionKey(userId, keyString);
        console.log("[Signal Protocol Init] Step 1: ✅ Session key derived and stored");

        // Step 2: Initialize Signal Protocol service
        console.log("[Signal Protocol Init] Step 2: Initializing Signal Protocol service...");
        const signalService = new SignalProtocolService(userId);
        await signalService.initialize();
        console.log("[Signal Protocol Init] Step 2: ✅ Signal Protocol service initialized");

        // Step 3: Initialize session sync
        console.log("[Signal Protocol Init] Step 3: Initializing session sync...");
        initializeSessionSync(userId, password, token);
        console.log("[Signal Protocol Init] Step 3: ✅ Session sync initialized");

        // Step 4: Initialize message plaintext sync
        console.log("[Signal Protocol Init] Step 4: Initializing message plaintext sync...");
        initializeMessagePlaintextSync(userId, password, token);
        console.log("[Signal Protocol Init] Step 4: ✅ Message plaintext sync initialized");

        // Step 5: Restore sessions from server (if requested)
        if (restoreSessions) {
            console.log("========================================");
            console.log("[Signal Protocol Init] Step 5: ⚠️ RESTORING SESSIONS FROM SERVER");
            console.log("========================================");
            try {
                await restoreSessionsFromServer(userId, password, token);
                console.log("========================================");
                console.log("[Signal Protocol Init] Step 5: ✅ SESSIONS RESTORED FROM SERVER");
                console.log("========================================");
            } catch (error) {
                console.error("========================================");
                console.error("[Signal Protocol Init] Step 5: ❌ SESSION RESTORATION FAILED");
                console.error("[Signal Protocol Init] Error:", error);
                console.error("========================================");
                // Continue even if restoration fails
            }
        }

        // Step 6: Upload prekey bundle
        console.log("[Signal Protocol Init] Step 6: Uploading prekey bundle...");
        const bundle = await signalService.getPreKeyBundle();
        const { uploadPreKeyBundle } = await import("@/core/api/crypto/prekeys");
        await uploadPreKeyBundle(bundle, token);
        console.log("[Signal Protocol Init] Step 6: ✅ Prekey bundle uploaded");

        // Step 7: Upload all prekeys
        console.log("[Signal Protocol Init] Step 7: Uploading all prekeys...");
        const baseBundle = await signalService.getBaseBundle();
        const prekeys = await signalService.getAllPreKeys();
        await uploadAllPreKeys(baseBundle, prekeys, token);
        console.log(`[Signal Protocol Init] Step 7: ✅ Uploaded ${prekeys.length} prekeys to server`);

        // Step 8: Upload all sessions to server (if requested)
        if (uploadSessions) {
            console.log("[Signal Protocol Init] Step 8: Uploading all sessions to server...");
            try {
                await uploadAllSessionsToServer(userId, password, token);
                console.log("[Signal Protocol Init] Step 8: ✅ Sessions uploaded to server");
            } catch (error) {
                console.error("[Signal Protocol Init] Step 8: ❌ Failed to upload sessions:", error);
                // Continue even if upload fails
            }
        }

        // Step 9: Restore message plaintexts from server (if requested)
        // Note: Message plaintext restoration is handled per-conversation when needed
        // No bulk restoration needed here
        
        // Step 10: Upload all message plaintexts to server (if requested)
        // Note: Message plaintext upload is handled automatically when messages are sent
        // No bulk upload needed here

        console.log("========================================");
        console.log("[Signal Protocol Init] ✅ ALL SIGNAL PROTOCOL INITIALIZATION COMPLETED");
        console.log("========================================");
    } catch (error) {
        console.error("========================================");
        console.error("[Signal Protocol Init] ❌ SIGNAL PROTOCOL INITIALIZATION FAILED");
        console.error("[Signal Protocol Init] Error:", error);
        console.error("========================================");
        throw error;
    }
}

