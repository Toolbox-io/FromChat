import { API_BASE_URL } from "../core/config";
import { getAuthHeaders } from "./api";
import { generateX25519KeyPair } from "../crypto/asymmetric";
import { encryptBackupWithPassword, decryptBackupWithPassword, encodeBlob, decodeBlob } from "../crypto/backup";

let currentPublicKey: Uint8Array | null = null;
let currentPrivateKey: Uint8Array | null = null;

function b64(a: Uint8Array): string { return btoa(String.fromCharCode(...a)); }
function ub64(s: string): Uint8Array {
	const bin = atob(s);
	const arr = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
	return arr;
}

async function fetchPublicKey(): Promise<Uint8Array | null> {
	const res = await fetch(`${API_BASE_URL}/crypto/public-key`, { method: "GET", headers: getAuthHeaders(true) });
	if (!res.ok) return null;
	const data = await res.json();
	if (!data?.publicKey) return null;
	return ub64(data.publicKey);
}

async function uploadPublicKey(publicKey: Uint8Array): Promise<void> {
	await fetch(`${API_BASE_URL}/crypto/public-key`, {
		method: "POST",
		headers: getAuthHeaders(true),
		body: JSON.stringify({ publicKey: b64(publicKey) })
	});
}

async function fetchBackupBlob(): Promise<string | null> {
	const res = await fetch(`${API_BASE_URL}/crypto/backup`, { method: "GET", headers: getAuthHeaders(true) });
	if (!res.ok) return null;
	const data = await res.json();
	return data?.blob ?? null;
}

async function uploadBackupBlob(blobJson: string): Promise<void> {
	await fetch(`${API_BASE_URL}/crypto/backup`, {
		method: "POST",
		headers: getAuthHeaders(true),
		body: JSON.stringify({ blob: blobJson })
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

export async function ensureKeysOnLogin(password: string): Promise<UserKeyPairMemory> {
	// Try to restore from backup
	const blobJson = await fetchBackupBlob();
	if (blobJson) {
		const blob = decodeBlob(blobJson);
		const bundle = await decryptBackupWithPassword(password, blob);
		currentPrivateKey = bundle.privateKey;
		// Ensure public key exists on server; if not, derive from private (not possible via libsafely), so keep previous
		// In our simple scheme, we rely on server having the public key or we reupload generated one on first setup
		const serverPub = await fetchPublicKey();
		if (serverPub) {
			currentPublicKey = serverPub;
		} else {
			// We don't have the corresponding public key from server; regenerate pair to resync
			const pair = generateX25519KeyPair();
			currentPublicKey = pair.publicKey;
			currentPrivateKey = pair.privateKey;
			await uploadPublicKey(currentPublicKey);
			const newBlob = await encryptBackupWithPassword(password, { version: 1, privateKey: currentPrivateKey });
			await uploadBackupBlob(encodeBlob(newBlob));
		}
		return { publicKey: currentPublicKey!, privateKey: currentPrivateKey! };
	}

	// First-time setup: generate keys and upload
	const pair = generateX25519KeyPair();
	currentPublicKey = pair.publicKey;
	currentPrivateKey = pair.privateKey;
	await uploadPublicKey(currentPublicKey);
	const encBlob = await encryptBackupWithPassword(password, { version: 1, privateKey: currentPrivateKey });
	await uploadBackupBlob(encodeBlob(encBlob));
	return { publicKey: currentPublicKey, privateKey: currentPrivateKey };
}


