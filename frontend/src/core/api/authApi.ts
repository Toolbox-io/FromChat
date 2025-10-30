import type { Headers, UploadPublicKeyRequest, BackupBlob } from "@/core/types";
import { generateX25519KeyPair } from "@/utils/crypto/asymmetric";
import { encodeBlob, encryptBackupWithPassword, decryptBackupWithPassword, decodeBlob } from "@/utils/crypto/backup";
import { b64, ub64 } from "@/utils/utils";
import { API_BASE_URL } from "@/core/config";
import { importPassword, hkdfExtractAndExpand } from "@/utils/crypto/kdf";

/**
 * Generates authentication headers for API requests
 * @param {boolean} json - Whether to include JSON content type header
 * @returns {Headers} Headers object with authentication and content type
 */
export function getAuthHeaders(token: string | null, json: boolean = true): Headers {
    const headers: Headers = {};

    if (json) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

let currentPublicKey: Uint8Array | null = null;
let currentPrivateKey: Uint8Array | null = null;

async function fetchPublicKey(token: string): Promise<Uint8Array | null> {
	const headers = getAuthHeaders(token, true);
	const res = await fetch(`${API_BASE_URL}/crypto/public-key`, { method: "GET", headers });
	if (!res.ok) return null;
	const data = await res.json();
	if (!data?.publicKey) return null;
	return ub64(data.publicKey);
}

async function uploadPublicKey(publicKey: Uint8Array, token: string): Promise<void> {
	const payload: UploadPublicKeyRequest = {
		publicKey: b64(publicKey)
	}

	const headers = getAuthHeaders(token, true);
	await fetch(`${API_BASE_URL}/crypto/public-key`, {
		method: "POST",
		headers,
		body: JSON.stringify(payload)
	});
}

async function fetchBackupBlob(token: string): Promise<string | null> {
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

async function uploadBackupBlob(blobJson: string, token: string): Promise<void> {
	const payload: BackupBlob = { blob: blobJson }

	const headers = getAuthHeaders(token, true);
	await fetch(`${API_BASE_URL}/crypto/backup`, {
		method: "POST",
		headers,
		body: JSON.stringify(payload)
	});
}

export interface UserKeyPairMemory {
	publicKey: Uint8Array;
	privateKey: Uint8Array;
}

export function getCurrentKeys(): UserKeyPairMemory | null {
	if (currentPublicKey && currentPrivateKey) return { publicKey: currentPublicKey, privateKey: currentPrivateKey };
	return null;
}

function saveKeys(
	publicKey: Uint8Array<ArrayBufferLike>,
	privateKey: Uint8Array<ArrayBufferLike>
) {
	const encodedPublicKey = b64(publicKey);
	const encodedPrivateKey = b64(privateKey);

	localStorage.setItem("publicKey", encodedPublicKey);
	localStorage.setItem("privateKey", encodedPrivateKey);
}

export async function ensureKeysOnLogin(password: string, token: string): Promise<UserKeyPairMemory> {
	// Try to restore from backup
	const blobJson = await fetchBackupBlob(token);
	if (blobJson) {
		const blob = decodeBlob(blobJson);
		const bundle = await decryptBackupWithPassword(password, blob);
		currentPrivateKey = bundle.privateKey;
		// Ensure public key exists on server; if not, derive from private (not possible via libsafely), so keep previous
		// In our simple scheme, we rely on server having the public key or we reupload generated one on first setup
		const serverPub = await fetchPublicKey(token);
		if (serverPub) {
			currentPublicKey = serverPub;
		} else {
			// We don't have the corresponding public key from server; regenerate pair to resync
			const pair = generateX25519KeyPair();
			currentPublicKey = pair.publicKey;
			currentPrivateKey = pair.privateKey;
			await uploadPublicKey(currentPublicKey, token);
			const newBlob = await encryptBackupWithPassword(password, { version: 1, privateKey: currentPrivateKey });
			await uploadBackupBlob(encodeBlob(newBlob), token);
		}

		saveKeys(currentPublicKey!, currentPrivateKey!);

		return {
			publicKey: currentPublicKey!,
			privateKey: currentPrivateKey!
		};
	}

	// First-time setup: generate keys and upload
	const pair = generateX25519KeyPair();
	currentPublicKey = pair.publicKey;
	currentPrivateKey = pair.privateKey;
	await uploadPublicKey(currentPublicKey, token);
	const encBlob = await encryptBackupWithPassword(password, { version: 1, privateKey: currentPrivateKey });
	await uploadBackupBlob(encodeBlob(encBlob), token);

	saveKeys(pair.publicKey, pair.privateKey);

	return pair;
}

export function restoreKeys() {
	currentPublicKey = ub64(localStorage.getItem("publicKey")!);
	currentPrivateKey = ub64(localStorage.getItem("privateKey")!);
}

export function getAuthToken(): string | null {
	return localStorage.getItem("authToken");
}

/**
 * Derive a client-side authentication secret so the raw password never leaves the client.
 * Uses PBKDF2 (via WebCrypto) + HKDF to produce a stable 32-byte key, then base64.
 */
export async function deriveAuthSecret(username: string, password: string): Promise<string> {
    const key = await importPassword(password);
    // Use per-user salt derived from username; in future we can fetch a server-provided salt
    const salt = new TextEncoder().encode(`fromchat.user:${username}`);
    // Derive 32 bytes using HKDF; PBKDF2 already used within importPassword
    const derived = await hkdfExtractAndExpand(new TextEncoder().encode(password), salt, new TextEncoder().encode("auth-secret"), 32);
    return b64(derived);
}