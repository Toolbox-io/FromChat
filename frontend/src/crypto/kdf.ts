export async function importPassword(password: string): Promise<CryptoKey> {
	const enc = new TextEncoder();
	return crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey", "deriveBits"]);
}

export async function deriveKEK(passwordKey: CryptoKey, salt: Uint8Array, iterations = 210_000): Promise<CryptoKey> {
	return crypto.subtle.deriveKey(
		{ name: "PBKDF2", salt, iterations, hash: "SHA-256" },
		passwordKey,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"]
	);
}

export async function hkdfExtractAndExpand(inputKeyMaterial: ArrayBuffer, salt: Uint8Array, info: Uint8Array, length = 32): Promise<Uint8Array> {
	const ikmKey = await crypto.subtle.importKey("raw", inputKeyMaterial, { name: "HKDF" }, false, ["deriveBits"]);
	const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, ikmKey, length * 8);
	return new Uint8Array(bits);
}

export function randomBytes(length: number): Uint8Array {
	const out = new Uint8Array(length);
	crypto.getRandomValues(out);
	return out;
}


