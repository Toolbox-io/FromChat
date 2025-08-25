export interface AesGcmCiphertext {
	iv: Uint8Array;
	ciphertext: Uint8Array;
}

export async function aesGcmEncrypt(key: CryptoKey, plaintext: Uint8Array): Promise<AesGcmCiphertext> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
	return { iv, ciphertext: new Uint8Array(ct) };
}

export async function aesGcmDecrypt(key: CryptoKey, iv: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array> {
	const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
	return new Uint8Array(pt);
}

export async function importAesGcmKey(rawKey: Uint8Array): Promise<CryptoKey> {
	return crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}