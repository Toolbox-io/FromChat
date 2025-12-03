import { API_BASE_URL } from "@/core/config";
import { getAuthHeaders } from "./account";
import type { UploadPublicKeyRequest, BackupBlob } from "@/core/types";
import { b64, ub64 } from "@/utils/utils";
import type { PreKeyBundleData } from "@/utils/crypto/signalProtocol";

/**
 * Fetches the current user's public key
 */
export async function fetchPublicKey(token: string): Promise<Uint8Array | null> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE_URL}/crypto/public-key`, { method: "GET", headers });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.publicKey) return null;
    return ub64(data.publicKey);
}

/**
 * Uploads the current user's public key
 */
export async function uploadPublicKey(publicKey: Uint8Array, token: string): Promise<void> {
    const payload: UploadPublicKeyRequest = {
        publicKey: b64(publicKey)
    }

    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE_URL}/crypto/public-key`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Failed to upload public key");
}

/**
 * Fetches another user's public key by user ID
 */
export async function fetchUserPublicKey(userId: number, token: string): Promise<string | null> {
    const res = await fetch(`${API_BASE_URL}/crypto/public-key/of/${userId}`, { headers: getAuthHeaders(token, true) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.publicKey;
}

/**
 * Fetches the current user's backup blob
 */
export async function fetchBackupBlob(token: string): Promise<string | null> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE_URL}/crypto/backup`, {
        method: "GET",
        headers
    });
    if (res.ok) {
        const response: BackupBlob = await res.json();
        return response.blob;
    } else {
        return null;
    }
}

/**
 * Uploads the current user's backup blob
 */
export async function uploadBackupBlob(blobJson: string, token: string): Promise<void> {
    const payload: BackupBlob = { blob: blobJson }

    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE_URL}/crypto/backup`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Failed to upload backup blob");
}

/**
 * Uploads Signal Protocol prekey bundle for the current user
 */
export async function uploadPreKeyBundle(bundle: PreKeyBundleData, token: string): Promise<void> {
    // Re-export from prekeys.ts
    const { uploadPreKeyBundle: upload } = await import("./crypto/prekeys");
    return upload(bundle, token);
}

/**
 * Uploads all available prekeys to the server for rotation
 */
export async function uploadAllPreKeys(
    baseBundle: Omit<PreKeyBundleData, "preKey">,
    prekeys: Array<{ keyId: number; publicKey: string }>,
    token: string
): Promise<void> {
    // Re-export from prekeys.ts
    const { uploadAllPreKeys: upload } = await import("./crypto/prekeys");
    return upload(baseBundle, prekeys, token);
}

/**
 * Fetches Signal Protocol prekey bundle for another user
 */
export async function fetchPreKeyBundle(userId: number, token: string): Promise<any | null> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE_URL}/crypto/signal/prekey-bundle/of/${userId}`, {
        method: "GET",
        headers
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.bundle || null;
}

