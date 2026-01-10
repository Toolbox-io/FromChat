import { API_BASE_URL } from "@/core/config";
import { getAuthHeaders } from "../user/auth";
import { getCurrentKeys } from "../user/auth";
import { request } from "@/core/websocket";
import type { SendDMRequest, DmEnvelope, DMEditRequest, BaseDmEnvelope, User } from "@/core/types";
import { b64, ub64 } from "@/utils/utils";
import { fetchUserPublicKey } from "../crypto/identity";
import { fetchUsers, searchUsers } from "../user/search";
import { getOrInitProtocol } from "@/utils/crypto/fromchatInit";
import { ecdhSharedSecret, deriveWrappingKey, importAesGcmKey, aesGcmEncrypt, randomBytes } from "@fromchat/protocol";

export async function decrypt(envelope: DmEnvelope, senderPublicKeyB64: string): Promise<string> {
    const protocol = getOrInitProtocol();
    const senderPublicKey = ub64(senderPublicKeyB64);
    
    return await protocol.decryptMessage(senderPublicKey, envelope);
}

export async function fetchMessages(userId: number, token: string, limit: number = 50, beforeId?: number): Promise<{ messages: DmEnvelope[]; has_more: boolean }> {
    let url = `${API_BASE_URL}/dm/history/${userId}?limit=${limit}`;
    if (beforeId) {
        url += `&before_id=${beforeId}`;
    }
    const response = await globalThis.fetch(url, {
        headers: getAuthHeaders(token, true)
    });
    if (!response.ok) return { messages: [], has_more: false };
    const data = await response.json();
    return { messages: data.messages || [], has_more: data.has_more ?? false };
}

export async function send(recipientId: number, recipientPublicKeyB64: string, plaintext: string, authToken: string, replyToId?: number): Promise<void> {
    const protocol = getOrInitProtocol();
    const recipientPublicKey = ub64(recipientPublicKeyB64);
    
    const encrypted = await protocol.encryptMessage(recipientPublicKey, plaintext);
    
    const payload: SendDMRequest = {
        recipientId: recipientId,
        ...encrypted
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

export async function sendWithFiles(recipientId: number, recipientPublicKeyB64: string, plaintextJson: string, files: File[], token: string): Promise<void> {
    // For files, we need to use the same message key for both the message and files
    // So we'll do the encryption manually here to reuse the mk
    const keys = getCurrentKeys();
    if (!keys) throw new Error("Keys not initialized");

    const mk = randomBytes(32);
    const wkSalt = randomBytes(16);
    const shared = ecdhSharedSecret(keys.privateKey, ub64(recipientPublicKeyB64));
    const wkRaw = await deriveWrappingKey(shared, wkSalt, new Uint8Array([1]));
    const wk = await importAesGcmKey(wkRaw);
    const wrap = await aesGcmEncrypt(wk, mk);

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
        const serverName = f.name;
        names.push(serverName);
        form.append("files", new File([blob], serverName));
    }
    form.append("fileNames", JSON.stringify(names));

    // Encrypt the plaintext JSON with the same mk
    const encMsg = await aesGcmEncrypt(await importAesGcmKey(mk), new TextEncoder().encode(plaintextJson));
    form.append("dm_payload", JSON.stringify({
        recipientId: recipientId,
        iv: b64(encMsg.iv),
        ciphertext: b64(encMsg.ciphertext),
        salt: b64(wkSalt),
        iv2: b64(wrap.iv),
        wrappedMk: b64(wrap.ciphertext)
    } satisfies BaseDmEnvelope));

    await globalThis.fetch(`${API_BASE_URL}/dm/send`, {
        method: "POST",
        headers: getAuthHeaders(token, false),
        body: form
    });
}

export async function edit(id: number, recipientPublicKeyB64: string, newPlaintextJson: string, authToken: string): Promise<void> {
    const protocol = getOrInitProtocol();
    const recipientPublicKey = ub64(recipientPublicKeyB64);
    
    const encrypted = await protocol.encryptMessage(recipientPublicKey, newPlaintextJson);

    await request({
        type: "dmEdit",
        credentials: { scheme: "Bearer", credentials: authToken },
        data: {
            id,
            ...encrypted
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
        headers: getAuthHeaders(token, true)
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
export { fetchUsers, searchUsers, fetchUserPublicKey };