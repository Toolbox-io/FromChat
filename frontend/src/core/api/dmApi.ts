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

export async function decryptDm(envelope: DmEnvelope, senderId: number): Promise<string> {
    const user = useUserStore.getState().user.currentUser;
    if (!user?.id) {
        throw new Error("User not authenticated");
    }

    if (!envelope.ciphertext) {
        throw new Error("DM envelope missing ciphertext");
    }

    const signalService = new SignalProtocolService(user.id.toString());
    
    // Remove padding (backward compatible with old messages)
    // Check if ciphertext is base64 (padded messages are base64)
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
        throw new Error(`Failed to parse Signal Protocol message: ${error instanceof Error ? error.message : String(error)}`);
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
    
    // Validate that body is valid base64 before attempting decryption
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(signalCiphertext.body)) {
        // Check if body contains non-printable characters (corrupted binary data)
        const hasNonPrintable = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/.test(signalCiphertext.body);
        if (hasNonPrintable) {
            // This is a corrupted message from before the base64 conversion fix
            // It cannot be decrypted - the body contains raw binary data instead of base64
            console.warn(`Message corrupted: body contains binary data instead of base64 (envelope ID: ${envelope.id}). This message was encrypted before the encryption fix and cannot be decrypted.`);
            
            return "_This message is corrupted and cannot be displayed._";
        }
        
        console.error("Invalid base64 in body:", {
            bodyType: typeof signalCiphertext.body,
            bodyLength: signalCiphertext.body.length,
            first50: signalCiphertext.body.substring(0, 50),
            last50: signalCiphertext.body.substring(Math.max(0, signalCiphertext.body.length - 50)),
            envelopeId: envelope.id
        });
        throw new Error(`Invalid base64 format in ciphertext body`);
    }
    
    try {
        // Try to decode a small portion to validate base64
        atob(signalCiphertext.body.substring(0, Math.min(4, signalCiphertext.body.length)));
    } catch (error) {
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
        throw new Error(`Failed to decrypt DM: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function fetchDMHistory(userId: number, token: string, limit: number = 50): Promise<DmEnvelope[]> {
    const response = await fetch(`${API_BASE_URL}/dm/history/${userId}?limit=${limit}`, {
        headers: api.user.auth.getAuthHeaders(token, true)
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.messages || [];
}


export async function sendDMViaWebSocket(recipientId: number, plaintext: string, authToken: string, replyToId?: number): Promise<void> {
    const user = useUserStore.getState().user.currentUser;
    if (!user?.id) {
        throw new Error("User not authenticated");
    }

    const signalService = new SignalProtocolService(user.id.toString());
    
    // Check if we have a session, if not, fetch prekey bundle and establish one
    const hasSession = await signalService.hasSession(recipientId);
    if (!hasSession) {
        // Fetch prekey bundle from server
        const bundle = await api.crypto.prekeys.fetchPreKeyBundle(recipientId, authToken);
        if (!bundle) {
            throw new Error(`Recipient (user ID: ${recipientId}) has not set up encryption. They need to log in to initialize their encryption keys.`);
        }
        await signalService.processPreKeyBundle(recipientId, bundle);
    }
    
    // Encrypt with Signal Protocol
    const ciphertext = await signalService.encryptMessage(recipientId, plaintext);
    
    // Add padding to obfuscate message size (anti-censorship)
    const paddedCiphertext = addPadding(JSON.stringify(ciphertext));
    
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

export async function sendDmWithFiles(recipientId: number, plaintextJson: string, files: File[], token: string): Promise<void> {
    const user = useUserStore.getState().user.currentUser;
    if (!user?.id) {
        throw new Error("User not authenticated");
    }

    const signalService = new SignalProtocolService(user.id.toString());
    
    // Check if we have a session, if not, fetch prekey bundle and establish one
    const hasSession = await signalService.hasSession(recipientId);
    if (!hasSession) {
        const bundle = await api.crypto.prekeys.fetchPreKeyBundle(recipientId, token);
        if (!bundle) {
            throw new Error(`Recipient (user ID: ${recipientId}) has not set up encryption. They need to log in to initialize their encryption keys.`);
        }
        await signalService.processPreKeyBundle(recipientId, bundle);
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

    await fetch(`${API_BASE_URL}/dm/send`, {
        method: "POST",
        headers: api.user.auth.getAuthHeaders(token, false),
        body: form
    });
}

export async function editDmEnvelope(id: number, recipientId: number, newPlaintextJson: string, authToken: string): Promise<void> {
    const user = useUserStore.getState().user.currentUser;
    if (!user?.id) {
        throw new Error("User not authenticated");
    }

    const signalService = new SignalProtocolService(user.id.toString());
    
    // Check if we have a session, if not, fetch prekey bundle and establish one
    const hasSession = await signalService.hasSession(recipientId);
    if (!hasSession) {
        const bundle = await api.crypto.prekeys.fetchPreKeyBundle(recipientId, authToken);
        if (!bundle) {
            throw new Error("No Signal Protocol prekey bundle available for recipient");
        }
        await signalService.processPreKeyBundle(recipientId, bundle);
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

export async function deleteDmEnvelope(id: number, recipientId: number, authToken: string): Promise<void> {
    await request({
        type: "dmDelete",
        credentials: { scheme: "Bearer", credentials: authToken },
        data: { id, recipientId }
    });
}

export interface DMConversationResponse {
    user: User;
    lastMessage: DmEnvelope;
    unreadCount: number;
}

// Re-export for convenience
export { fetchUsers, searchUsers } from "./users";
export { fetchUserPublicKey } from "./crypto/identity";

export async function fetchDMConversations(token: string): Promise<DMConversationResponse[]> {
    const res = await fetch(`${API_BASE_URL}/dm/conversations`, {
        headers: api.user.auth.getAuthHeaders(token, true)
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.conversations || [];
}

