import { API_BASE_URL } from "../core/config";
import { getAuthHeaders } from "./api";
import { generateX25519KeyPair } from "../crypto/asymmetric";
import { encryptBackupWithPassword, decryptBackupWithPassword, encodeBlob, decodeBlob } from "../crypto/backup";
import { b64, ub64 } from "../utils/utils";
import type { BackupBlob, UploadPublicKeyRequest } from "../core/types";

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
		return { publicKey: currentPublicKey!, privateKey: currentPrivateKey! };
	}

	// First-time setup: generate keys and upload
	const pair = generateX25519KeyPair();
	currentPublicKey = pair.publicKey;
	currentPrivateKey = pair.privateKey;
	await uploadPublicKey(currentPublicKey, token);
	const encBlob = await encryptBackupWithPassword(password, { version: 1, privateKey: currentPrivateKey });
	await uploadBackupBlob(encodeBlob(encBlob), token);
	return { publicKey: currentPublicKey, privateKey: currentPrivateKey };
}


