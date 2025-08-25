export interface AesGcmCiphertext {
	iv: Uint8Array;
	ciphertext: Uint8Array;
}

export async function aesGcmEncrypt(key: CryptoKey, plaintext: Uint8Array | ArrayBuffer): Promise<AesGcmCiphertext> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const plaintextBuffer = plaintext instanceof Uint8Array ? plaintext.buffer as ArrayBuffer : plaintext;
	const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintextBuffer);
	return { iv, ciphertext: new Uint8Array(ct) };
}

export async function aesGcmDecrypt(key: CryptoKey, iv: Uint8Array | ArrayBuffer, ciphertext: Uint8Array | ArrayBuffer): Promise<Uint8Array> {
	const ivBuffer = iv instanceof Uint8Array ? iv.buffer as ArrayBuffer : iv;
	const ciphertextBuffer = ciphertext instanceof Uint8Array ? ciphertext.buffer as ArrayBuffer : ciphertext;
	const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBuffer }, key, ciphertextBuffer);
	return new Uint8Array(pt);
}

export async function importAesGcmKey(rawKey: Uint8Array | ArrayBuffer): Promise<CryptoKey> {
	const keyBuffer = rawKey instanceof Uint8Array ? rawKey.buffer as ArrayBuffer : rawKey;
	return crypto.subtle.importKey("raw", keyBuffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}