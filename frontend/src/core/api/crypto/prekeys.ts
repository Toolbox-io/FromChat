import { API_BASE_URL } from "@/core/config";
import { getAuthHeaders } from "../user/auth";
import type { PreKeyBundleData } from "@/utils/crypto/signalProtocol";

/**
 * Uploads Signal Protocol prekey bundle for the current user
 * This uploads the base bundle (identity, signed prekey) and one prekey
 */
export async function uploadPreKeyBundle(bundle: PreKeyBundleData, token: string): Promise<void> {
    const payload = { bundle };

    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE_URL}/crypto/signal/prekey-bundle`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Failed to upload prekey bundle");
}

/**
 * Uploads all available prekeys to the server for rotation in a single request
 */
export async function uploadAllPreKeys(
    baseBundle: Omit<PreKeyBundleData, "preKey">,
    prekeys: Array<{ keyId: number; publicKey: string }>,
    token: string
): Promise<void> {
    const headers = getAuthHeaders(token, true);
    const payload = {
        baseBundle,
        prekeys
    };
    
    const res = await fetch(`${API_BASE_URL}/crypto/signal/prekeys/bulk`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
        throw new Error(`Failed to upload prekeys: ${res.statusText}`);
    }
}

/**
 * Custom error for prekey exhaustion
 */
export class PrekeyExhaustedError extends Error {
    constructor(public readonly recipientId: number) {
        super("Recipient's encryption keys are temporarily unavailable. They need to come online to refresh their keys.");
        this.name = "PrekeyExhaustedError";
    }
}

/**
 * Fetches Signal Protocol prekey bundle for another user
 * @throws {PrekeyExhaustedError} If the recipient has no unused prekeys available
 */
export async function fetchPreKeyBundle(userId: number, token: string): Promise<PreKeyBundleData> {
    const headers = getAuthHeaders(token, true);
    const res = await fetch(`${API_BASE_URL}/crypto/signal/prekey-bundle/of/${userId}`, {
        method: "GET",
        headers
    });
    if (!res.ok) {
        if (res.status === 404) {
            throw new Error("Recipient has not set up encryption. They need to log in to initialize their encryption keys.");
        }
        throw new Error("Failed to fetch prekey bundle");
    }
    const data = await res.json();
    const bundle = data.bundle;
    
    // Check if bundle exists but has no prekey (all prekeys exhausted)
    if (!bundle) {
        throw new PrekeyExhaustedError(userId);
    }
    
    // If bundle exists but has no preKey field, it means all prekeys are exhausted
    // The backend returns bundle without preKey when no unused prekeys are available
    if (!bundle.preKey) {
        throw new PrekeyExhaustedError(userId);
    }
    
    return bundle;
}


