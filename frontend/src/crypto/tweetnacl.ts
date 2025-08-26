export interface KeyPair {
	publicKey: Uint8Array;
	secretKey: Uint8Array;
}

declare const nacl: {
	box: {
		before: (theirPublicKey: Uint8Array, myPrivateKey: Uint8Array) => Uint8Array,
		keyPair: () => KeyPair
	}
}

export default nacl;