import { API_BASE_URL } from "@/core/config";
import api from "@/core/api";
import { importAesGcmKey, aesGcmEncrypt } from "@/utils/crypto/symmetric";
import { randomBytes } from "@/utils/crypto/kdf";
import { request } from "@/core/websocket";
import type { SendDMRequest, DmEnvelope, DMEditRequest, DmEncryptedJSON, BaseDmEnvelope, User } from "@/core/types";
import { b64 } from "@/utils/utils";
import { SignalProtocolService } from "@/utils/crypto/signalProtocol";
import { useUserStore } from "@/state/user";
import { addPadding, removePadding } from "@/utils/crypto/obfuscation";

export async function decrypt(envelope: DmEnvelope, senderId: number): Promise<string> {
    const user = useUserStore.getState().user.currentUser;
    if (!user?.id) {
        throw new Error("User not authenticated");
    }

    if (!envelope.ciphertext) {
        throw new Error("DM envelope missing ciphertext");
    }

    const signalService = new SignalProtocolService(user.id.toString());
    
    // Remove padding (backward compatible with old messages)
    // Check if ciphertext is base64 (padded) or already JSON (unpadded)
    let ciphertextStr: string = envelope.ciphertext;
    
    // Check if it's base64 (padded messages are base64)
    const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
    const isBase64 = base64Pattern.test(envelope.ciphertext) && envelope.ciphertext.length > 0;
    
    if (isBase64) {
        // Try to remove padding
        try {
            const unpadded = removePadding(envelope.ciphertext);
            // Verify it's valid JSON before using it
            JSON.parse(unpadded);
            ciphertextStr = unpadded;
        } catch {
            // If padding removal fails, try using the base64 directly as JSON (shouldn't happen, but handle gracefully)
            try {
                JSON.parse(envelope.ciphertext);
                ciphertextStr = envelope.ciphertext;
            } catch {
                // If both fail, throw an error
                throw new Error(`Failed to process ciphertext: not valid base64 padded data and not valid JSON. Length: ${envelope.ciphertext.length}`);
            }
        }
    } else {
        // Not base64, assume it's already JSON (unpadded message)
        ciphertextStr = envelope.ciphertext;
    }
    
    // Parse Signal Protocol message
    let signalCiphertext: { type: number; body: string };
    try {
        signalCiphertext = JSON.parse(ciphertextStr);
    } catch (error) {
        throw new Error(`Failed to parse ciphertext as JSON: ${error instanceof Error ? error.message : String(error)}. Ciphertext length: ${ciphertextStr.length}, first 100 chars: ${ciphertextStr.substring(0, 100)}`);
    }
    
    if (!signalCiphertext || typeof signalCiphertext !== "object") {
        throw new Error("Invalid Signal Protocol message format: not an object");
    }
    
    if (typeof signalCiphertext.type !== "number") {
        throw new Error("Invalid Signal Protocol message format: type is not a number");
    }
    
    if (!signalCiphertext.body || typeof signalCiphertext.body !== "string") {
        throw new Error("Invalid Signal Protocol message format: body is missing or not a string");
    }
    
    // Check if body contains non-printable characters (corrupted binary data from old encryption)
    // This must be checked first, before any base64 validation
    const hasNonPrintable = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/.test(signalCiphertext.body);
    if (hasNonPrintable) {
        // This is a corrupted message from before the base64 conversion fix
        // It cannot be decrypted - the body contains raw binary data instead of base64
        console.warn(`Message corrupted: body contains binary data instead of base64 (envelope ID: ${envelope.id}). This message was encrypted before the encryption fix and cannot be decrypted.`);
        return "_This message is corrupted and cannot be displayed._";
    }
    
    // Check if body contains Unicode escape sequences (from JSON.stringify escaping)
    // If so, we need to unescape them to get the actual base64 string
    let bodyToDecode = signalCiphertext.body;
    
    // Check for literal backslash-u sequences (before JSON parsing, these would be "\\u")
    // After JSON parsing, Unicode escapes are converted to actual characters, so we check for
    // the pattern that indicates it might have been escaped
    if (bodyToDecode.includes("\\u") || bodyToDecode.match(/\\u[0-9a-fA-F]{4}/)) {
        // Try to unescape Unicode sequences by wrapping in JSON quotes
        try {
            bodyToDecode = JSON.parse(`"${bodyToDecode.replace(/\\/g, "\\\\")}"`);
        } catch {
            // If unescaping fails, use the original
            bodyToDecode = signalCiphertext.body;
        }
    }
    
    // Validate that body is valid base64 before attempting decryption
    // Check if it's a valid base64 string (only contains base64 characters and padding)
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(bodyToDecode)) {
        // Log for debugging - this should help identify the issue
        console.error("Invalid base64 in body:", {
            bodyType: typeof signalCiphertext.body,
            bodyLength: signalCiphertext.body.length,
            unescapedLength: bodyToDecode.length,
            first50: signalCiphertext.body.substring(0, 50),
            unescapedFirst50: bodyToDecode.substring(0, 50),
            envelopeId: envelope.id
        });
        throw new Error(`Invalid base64 format in ciphertext body`);
    }
    
    // Use the unescaped body for decryption
    signalCiphertext.body = bodyToDecode;
    
    try {
        // Try to decode a small portion to validate base64
        atob(signalCiphertext.body.substring(0, Math.min(4, signalCiphertext.body.length)));
    } catch (error) {
        // Log for debugging
        console.error("Base64 decode failed:", {
            bodyLength: signalCiphertext.body.length,
            first50: signalCiphertext.body.substring(0, 50),
            last50: signalCiphertext.body.substring(Math.max(0, signalCiphertext.body.length - 50)),
            envelopeId: envelope.id,
            error: error instanceof Error ? error.message : String(error)
        });
        throw new Error(`Invalid base64 in ciphertext body: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    try {
        const plaintext = await signalService.decryptMessage(senderId, signalCiphertext);
        return plaintext;
    } catch (error) {
        // If decryption fails, check if it's a session issue
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("No session exists") || errorMessage.includes("No record for device")) {
            console.warn(`Session missing for sender ${senderId} (envelope ID: ${envelope.id}). This may happen after page reload if the session was not properly restored.`);
        }
        throw error;
    }
}

export async function fetchMessages(userId: number, token: string, limit: number = 50, beforeId?: number): Promise<{ messages: DmEnvelope[]; has_more: boolean }> {
    let url = `${API_BASE_URL}/dm/history/${userId}?limit=${limit}`;
    if (beforeId) {
        url += `&before_id=${beforeId}`;
    }
    const response = await globalThis.fetch(url, {
        headers: api.user.auth.getAuthHeaders(token, true)
    });
    if (!response.ok) return { messages: [], has_more: false };
    const data = await response.json();
    return { messages: data.messages || [], has_more: data.has_more ?? false };
}

export async function send(recipientId: number, plaintext: string, authToken: string, replyToId?: number): Promise<void> {
    const user = useUserStore.getState().user.currentUser;
    if (!user?.id) {
        throw new Error("User not authenticated");
    }

    const signalService = new SignalProtocolService(user.id.toString());
    
    // Check if we have a session, if not, fetch prekey bundle and establish one
    let hasSession = false;
    try {
        hasSession = await signalService.hasSession(recipientId);
    } catch (error) {
        console.warn("Failed to check session, will attempt to establish new one:", error);
    }
    
    if (!hasSession) {
        try {
            const bundle = await api.crypto.prekeys.fetchPreKeyBundle(recipientId, authToken);
            await signalService.processPreKeyBundle(recipientId, bundle);
        } catch (error) {
            // Re-throw PrekeyExhaustedError as-is for proper handling
            if (error instanceof api.crypto.prekeys.PrekeyExhaustedError) {
                throw error;
            }
            // Log other errors for debugging
            console.error("Failed to establish session:", {
                recipientId,
                error: error instanceof Error ? error.message : String(error)
            });
            // Re-throw other errors
            throw error;
        }
    }
    
    // Encrypt with Signal Protocol
    let ciphertext: { type: number; body: string };
    try {
        ciphertext = await signalService.encryptMessage(recipientId, plaintext);
    } catch (error) {
        console.error("Failed to encrypt message:", {
            recipientId,
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
    
    // Verify the body is valid base64 before stringifying
    if (ciphertext.body && typeof ciphertext.body === "string") {
        try {
            // Test that body is valid base64
            atob(ciphertext.body.substring(0, Math.min(4, ciphertext.body.length)));
            
            // Verify the entire body is valid base64
            const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
            if (!base64Regex.test(ciphertext.body)) {
                console.error("Invalid base64 characters in encrypted body:", {
                    bodyLength: ciphertext.body.length,
                    first100: ciphertext.body.substring(0, 100),
                    last100: ciphertext.body.substring(Math.max(0, ciphertext.body.length - 100))
                });
                throw new Error("Encrypted body contains invalid base64 characters");
            }
        } catch (error) {
            throw new Error(`Encrypted body is not valid base64: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    // Stringify the ciphertext - JSON.stringify should not escape base64 strings
    const ciphertextJson = JSON.stringify(ciphertext);
    
    // Verify the stringified JSON doesn't have escaped characters in the body field
    const parsed = JSON.parse(ciphertextJson);
    if (parsed.body !== ciphertext.body) {
        console.error("Body was modified during JSON stringification:", {
            original: ciphertext.body.substring(0, 50),
            stringified: parsed.body.substring(0, 50),
            originalLength: ciphertext.body.length,
            stringifiedLength: parsed.body.length
        });
        throw new Error("Body was incorrectly escaped during JSON stringification");
    }
    
    // Add padding to obfuscate message size (anti-censorship)
    const paddedCiphertext = addPadding(ciphertextJson);

    const payload: SendDMRequest = {
        recipientId: recipientId,
        iv: "", // Not used for Signal Protocol
        ciphertext: paddedCiphertext, // Padded Signal Protocol message
        salt: "", // Not used for Signal Protocol
        iv2: "", // Not used for Signal Protocol
        wrappedMk: "" // Not used for Signal Protocol
    };
    if (replyToId) payload.replyToId = replyToId;

    await request({
        type: "dmSend",
        credentials: {
            scheme: "Bearer",
            credentials: authToken
        },
        data: payload
    });
}

export async function sendWithFiles(recipientId: number, plaintextJson: string, files: File[], token: string): Promise<void> {
    const user = useUserStore.getState().user.currentUser;
    if (!user?.id) {
        throw new Error("User not authenticated");
    }

    const signalService = new SignalProtocolService(user.id.toString());
    
    // Check if we have a session, if not, fetch prekey bundle and establish one
    const hasSession = await signalService.hasSession(recipientId);
    if (!hasSession) {
        try {
            const bundle = await api.crypto.prekeys.fetchPreKeyBundle(recipientId, token);
            await signalService.processPreKeyBundle(recipientId, bundle);
        } catch (error) {
            // Re-throw PrekeyExhaustedError as-is for proper handling
            if (error instanceof api.crypto.prekeys.PrekeyExhaustedError) {
                throw error;
            }
            // Re-throw other errors
            throw error;
        }
    }

    // Generate master key for file encryption
    const mk = randomBytes(32);
    
    // Encrypt the master key using Signal Protocol
    const mkBase64 = b64(mk);
    const encryptedMk = await signalService.encryptMessage(recipientId, mkBase64);
    
    // Add padding to obfuscate master key size
    const paddedMk = addPadding(JSON.stringify(encryptedMk));

    const form = new FormData();
    const names: string[] = [];
    function sliceBuffer(u8: Uint8Array): ArrayBuffer {
        return (u8.buffer as ArrayBuffer).slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    }

    for (const f of files) {
        // Encrypt file with same mk
        const data = new Uint8Array(await f.arrayBuffer());
        const enc = await aesGcmEncrypt(await importAesGcmKey(mk), data);
        const blob = new Blob([sliceBuffer(enc.iv), sliceBuffer(enc.ciphertext)], { type: "application/octet-stream" });
        const serverName = f.name; // server uses provided name
        names.push(serverName);
        form.append("files", new File([blob], serverName));
    }
    form.append("fileNames", JSON.stringify(names));

    // Merge files metadata into plaintext JSON and encrypt
    let obj: DmEncryptedJSON;
    try {
        obj = JSON.parse(plaintextJson);
    } catch {
        obj = { type: "text", data: { content: String(plaintextJson) } };
    }

    const encMsg = await aesGcmEncrypt(await importAesGcmKey(mk), new TextEncoder().encode(JSON.stringify(obj)));
    form.append("dm_payload", JSON.stringify({
        recipientId: recipientId,
        iv: b64(encMsg.iv),
        ciphertext: b64(encMsg.ciphertext),
        salt: "", // Not used for Signal Protocol
        iv2: "", // Not used for Signal Protocol
        wrappedMk: paddedMk // Padded Signal Protocol encrypted master key
    } satisfies BaseDmEnvelope));

    await globalThis.fetch(`${API_BASE_URL}/dm/send`, {
        method: "POST",
        headers: api.user.auth.getAuthHeaders(token, false),
        body: form
    });
}

export async function edit(id: number, recipientId: number, newPlaintextJson: string, authToken: string): Promise<void> {
    const user = useUserStore.getState().user.currentUser;
    if (!user?.id) {
        throw new Error("User not authenticated");
    }

    const signalService = new SignalProtocolService(user.id.toString());
    
    // Check if we have a session, if not, fetch prekey bundle and establish one
    const hasSession = await signalService.hasSession(recipientId);
    if (!hasSession) {
        try {
            const bundle = await api.crypto.prekeys.fetchPreKeyBundle(recipientId, authToken);
            await signalService.processPreKeyBundle(recipientId, bundle);
        } catch (error) {
            // Re-throw PrekeyExhaustedError as-is for proper handling
            if (error instanceof api.crypto.prekeys.PrekeyExhaustedError) {
                throw error;
            }
            // Re-throw other errors
            throw error;
        }
    }

    // Generate fresh master key for the edited message
    const mk = randomBytes(32);
    
    // Encrypt the master key using Signal Protocol
    const mkBase64 = b64(mk);
    const encryptedMk = await signalService.encryptMessage(recipientId, mkBase64);
    
    // Add padding to obfuscate master key size
    const paddedMk = addPadding(JSON.stringify(encryptedMk));
    
    // Encrypt the message content with the master key
    const encMsg = await aesGcmEncrypt(await importAesGcmKey(mk), new TextEncoder().encode(newPlaintextJson));

    await request({
        type: "dmEdit",
        credentials: { scheme: "Bearer", credentials: authToken },
        data: {
            id,
            iv: b64(encMsg.iv),
            ciphertext: b64(encMsg.ciphertext),
            iv2: "", // Not used for Signal Protocol
            wrappedMk: paddedMk, // Padded Signal Protocol encrypted master key
            salt: "" // Not used for Signal Protocol
        }
    } as DMEditRequest);
}

export async function deleteMessage(id: number, recipientId: number, authToken: string): Promise<void> {
    await request({
        type: "dmDelete",
        credentials: { scheme: "Bearer", credentials: authToken },
        data: { id, recipientId }
    });
}

export interface ConversationResponse {
    user: User;
    lastMessage: DmEnvelope;
    unreadCount: number;
}

export async function conversations(token: string): Promise<ConversationResponse[]> {
    const res = await fetch(`${API_BASE_URL}/dm/conversations`, {
        headers: api.user.auth.getAuthHeaders(token, true)
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.conversations || [];
}

/**
 * Marks a DM as read
 */
export async function markRead(id: number, authToken: string): Promise<void> {
    await request({
        type: "dmMarkRead",
        credentials: { scheme: "Bearer", credentials: authToken },
        data: { id }
    });
}

// Re-export user functions for convenience
export { fetchUsers, searchUsers } from "@/core/api/users";
export { fetchUserPublicKey } from "@/core/api/crypto/identity";


