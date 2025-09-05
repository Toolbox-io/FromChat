import { API_BASE_URL } from "../core/config";
import { getAuthHeaders } from "../auth/api";
import { ecdhSharedSecret, deriveWrappingKey } from "../crypto/asymmetric";
import { importAesGcmKey, aesGcmEncrypt, aesGcmDecrypt } from "../crypto/symmetric";
import { randomBytes } from "../crypto/kdf";
import { getCurrentKeys } from "../auth/crypto";
import { request } from "../websocket";
import type { FetchDMResponse, SendDMRequest, DmEnvelope, User } from "../core/types";
import { b64, ub64 } from "../utils/utils";

export async function sendDm(recipientId: number, recipientPublicKeyB64: string, plaintext: string, token: string): Promise<void> {
    const keys = getCurrentKeys();
    if (!keys) throw new Error("Keys not initialized");
    const mk = randomBytes(32);
    const wkSalt = randomBytes(16);
    const shared = ecdhSharedSecret(keys.privateKey, ub64(recipientPublicKeyB64));
    const wkRaw = await deriveWrappingKey(shared, wkSalt, new Uint8Array([1]));
    const wk = await importAesGcmKey(wkRaw);
    const encMsg = await aesGcmEncrypt(await importAesGcmKey(mk), new TextEncoder().encode(plaintext));
    const wrap = await aesGcmEncrypt(wk, mk);
    
    await fetch(`${API_BASE_URL}/dm/send`, {
        method: "POST",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify({
            recipientId: recipientId,
            iv: b64(encMsg.iv),
            ciphertext: b64(encMsg.ciphertext),
            salt: b64(wkSalt),
            iv2: b64(wrap.iv),
            wrappedMk: b64(wrap.ciphertext)
        })
    });
}

export async function fetchDm(since: number | undefined, token: string): Promise<DmEnvelope[]> {
    const url = new URL(`${API_BASE_URL}/dm/fetch`);
    if (since) url.searchParams.set("since", String(since));

    const response = await fetch(url, { 
        headers: getAuthHeaders(token, true) 
    });

    if (response.ok) {
        const data: FetchDMResponse = await response.json();
        return data.messages ?? [];
    } else {
        return [];
    }
}

export async function decryptDm(envelope: DmEnvelope, senderPublicKeyB64: string): Promise<string> {
    const keys = getCurrentKeys();
    if (!keys) throw new Error("Keys not initialized");

    // Obtain the key
    const shared = ecdhSharedSecret(keys.privateKey, ub64(senderPublicKeyB64));
    const wkRaw = await deriveWrappingKey(shared, ub64(envelope.salt), new Uint8Array([1]));
    const wk = await importAesGcmKey(wkRaw);
    const mk = await aesGcmDecrypt(wk, ub64(envelope.iv2), ub64(envelope.wrappedMk));

    // Decrypt
    const msg = await aesGcmDecrypt(await importAesGcmKey(mk), ub64(envelope.iv), ub64(envelope.ciphertext));
    return new TextDecoder().decode(msg);
}

export async function fetchUsers(token: string): Promise<User[]> {
    const res = await fetch(`${API_BASE_URL}/users`, { headers: getAuthHeaders(token, true) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.users || [];
}

export async function fetchUserPublicKey(userId: number, token: string): Promise<string | null> {
    const res = await fetch(`${API_BASE_URL}/crypto/public-key/of/${userId}`, { headers: getAuthHeaders(token, true) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.publicKey;
}

export async function fetchDMHistory(userId: number, token: string, limit: number = 50): Promise<DmEnvelope[]> {
    const response = await fetch(`${API_BASE_URL}/dm/history/${userId}?limit=${limit}`, { 
        headers: getAuthHeaders(token, true) 
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.messages || [];
}

export async function sendDMViaWebSocket(recipientId: number, recipientPublicKeyB64: string, plaintext: string, authToken: string): Promise<void> {
    const keys = getCurrentKeys();
    if (!keys) throw new Error("Keys not initialized");

    // Encryption key
    const mk = randomBytes(32);
    const wkSalt = randomBytes(16);
    const shared = ecdhSharedSecret(keys.privateKey, ub64(recipientPublicKeyB64));
    const wkRaw = await deriveWrappingKey(shared, wkSalt, new Uint8Array([1]));
    const wk = await importAesGcmKey(wkRaw);

    // Encrypt the message
    const encMsg = await aesGcmEncrypt(await importAesGcmKey(mk), new TextEncoder().encode(plaintext));
    const wrap = await aesGcmEncrypt(wk, mk);

    const payload: SendDMRequest = {
        recipientId: recipientId,
        iv: b64(encMsg.iv),
        ciphertext: b64(encMsg.ciphertext),
        salt: b64(wkSalt),
        iv2: b64(wrap.iv),
        wrappedMk: b64(wrap.ciphertext)
    };

    await request({
        type: "dmSend",
        credentials: { 
            scheme: "Bearer", 
            credentials: authToken
        },
        data: payload
    });
}
