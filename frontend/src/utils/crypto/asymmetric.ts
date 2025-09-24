import { hkdfExtractAndExpand } from "../crypto/kdf";

export interface X25519KeyPair {
	publicKey: Uint8Array;
	privateKey: Uint8Array;
}

export type KeyPair = X25519KeyPair;

export async function generateX25519KeyPair(): Promise<X25519KeyPair> {
	const nacl = await import("tweetnacl");
	
	const kp = nacl.box.keyPair();
	return { publicKey: kp.publicKey, privateKey: kp.secretKey };
}

export async function ecdhSharedSecret(myPrivateKey: Uint8Array, theirPublicKey: Uint8Array): Promise<Uint8Array> {
	const nacl = await import("tweetnacl");

	// nacl.box.before returns shared key (Curve25519, XSalsa20-Poly1305 context). We use it as IKM into HKDF.
	return nacl.box.before(theirPublicKey, myPrivateKey);
}

export async function deriveWrappingKey(sharedSecret: Uint8Array, salt: Uint8Array, info: Uint8Array): Promise<Uint8Array> {
	return hkdfExtractAndExpand(sharedSecret.buffer as ArrayBuffer, salt, info, 32);
}