/**
 * Signal Protocol service wrapper
 * Provides high-level API for encrypting/decrypting messages using Signal Protocol
 */

import {
    SessionBuilder,
    SessionCipher,
    KeyHelper,
    SignalProtocolAddress,
    type DeviceType
} from "@privacyresearch/libsignal-protocol-typescript";
import { SignalProtocolStorage } from "./signalStorage";
import { b64, ub64 } from "../utils";

// Helper to ensure we get a proper ArrayBuffer (not SharedArrayBuffer)
function toArrayBuffer(buffer: ArrayBuffer | SharedArrayBuffer): ArrayBuffer {
    if (buffer instanceof ArrayBuffer) return buffer;
    // Convert SharedArrayBuffer to ArrayBuffer by copying
    const view = new Uint8Array(buffer);
    const copy = new Uint8Array(view.length);
    copy.set(view);
    return copy.buffer;
}

export interface PreKeyBundleData {
    registrationId: number;
    identityKey: string; // base64
    signedPreKey: {
        keyId: number;
        publicKey: string; // base64
        signature: string; // base64
    };
    preKey?: {
        keyId: number;
        publicKey: string; // base64
    };
}

export class SignalProtocolService {
    private storage: SignalProtocolStorage;

    constructor(userId: string) {
        this.storage = new SignalProtocolStorage(userId);
    }

    /**
     * Initialize Signal Protocol for this user
     * Generates identity keys, registration ID, and prekeys if they don't exist
     */
    async initialize(): Promise<void> {
        // Check if already initialized
        const existingIdentity = await this.storage.getIdentityKeyPair();
        if (existingIdentity) {
            return; // Already initialized
        }

        // Generate identity key pair
        const identityKeyPair = await KeyHelper.generateIdentityKeyPair();
        await this.storage.saveIdentityKeyPair(identityKeyPair);

        // Generate registration ID
        const registrationId = KeyHelper.generateRegistrationId();
        await this.storage.saveLocalRegistrationId(registrationId);

        // Generate signed prekey
        const signedPreKeyId = 1;
        const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, signedPreKeyId);
        await this.storage.storeSignedPreKey(signedPreKeyId, signedPreKey.keyPair);
        
        // Store signature separately (we'll need it for the bundle)
        // For now, we'll regenerate it when needed since storage doesn't store signatures

        // Generate prekeys (typically 100 prekeys)
        const preKeyCount = 100;
        for (let i = 1; i <= preKeyCount; i++) {
            const preKey = await KeyHelper.generatePreKey(i);
            await this.storage.storePreKey(i, preKey.keyPair);
        }
    }

    /**
     * Get prekey bundle for this user to share with others
     */
    async getPreKeyBundle(): Promise<PreKeyBundleData> {
        const identityKeyPair = await this.storage.getIdentityKeyPair();
        if (!identityKeyPair) {
            throw new Error("Signal Protocol not initialized");
        }

        const registrationId = await this.storage.getLocalRegistrationId();
        if (!registrationId) {
            throw new Error("Registration ID not found");
        }

        const signedPreKey = await this.storage.loadSignedPreKey(1);
        if (!signedPreKey) {
            throw new Error("Signed prekey not found");
        }

        // Regenerate signed prekey to get signature (since storage doesn't store it)
        // In production, you'd store the signature separately
        const signedPreKeyWithSig = await KeyHelper.generateSignedPreKey(identityKeyPair, 1);
        await this.storage.storeSignedPreKey(1, signedPreKeyWithSig.keyPair);

        // Get a prekey to include
        const preKey = await this.storage.loadPreKey(1);
        if (!preKey) {
            throw new Error("No prekeys available");
        }

        return {
            registrationId: registrationId,
            identityKey: b64(new Uint8Array(identityKeyPair.pubKey)),
            signedPreKey: {
                keyId: 1,
                publicKey: b64(new Uint8Array(signedPreKey.pubKey)),
                signature: b64(new Uint8Array(signedPreKeyWithSig.signature))
            },
            preKey: {
                keyId: 1,
                publicKey: b64(new Uint8Array(preKey.pubKey))
            }
        };
    }

    /**
     * Process a prekey bundle from another user and establish a session
     */
    async processPreKeyBundle(recipientId: number, bundle: PreKeyBundleData): Promise<void> {
        const address = new SignalProtocolAddress(recipientId.toString(), 1);

        const identityKeyBuf = ub64(bundle.identityKey);
        const signedPreKeyPubBuf = ub64(bundle.signedPreKey.publicKey);
        const signedPreKeySigBuf = ub64(bundle.signedPreKey.signature);
        
        const deviceBundle: DeviceType = {
            identityKey: toArrayBuffer(identityKeyBuf.buffer.slice(identityKeyBuf.byteOffset, identityKeyBuf.byteOffset + identityKeyBuf.byteLength)),
            signedPreKey: {
                keyId: bundle.signedPreKey.keyId,
                publicKey: toArrayBuffer(signedPreKeyPubBuf.buffer.slice(signedPreKeyPubBuf.byteOffset, signedPreKeyPubBuf.byteOffset + signedPreKeyPubBuf.byteLength)),
                signature: toArrayBuffer(signedPreKeySigBuf.buffer.slice(signedPreKeySigBuf.byteOffset, signedPreKeySigBuf.byteOffset + signedPreKeySigBuf.byteLength))
            },
            preKey: bundle.preKey ? {
                keyId: bundle.preKey.keyId,
                publicKey: (() => {
                    const preKeyBuf = ub64(bundle.preKey!.publicKey);
                    return toArrayBuffer(preKeyBuf.buffer.slice(preKeyBuf.byteOffset, preKeyBuf.byteOffset + preKeyBuf.byteLength));
                })()
            } : undefined,
            registrationId: bundle.registrationId
        };

        const sessionBuilder = new SessionBuilder(this.storage, address);
        await sessionBuilder.processPreKey(deviceBundle);
    }

    /**
     * Encrypt a message for a recipient
     */
    async encryptMessage(recipientId: number, plaintext: string): Promise<{ type: number; body: string }> {
        const address = new SignalProtocolAddress(recipientId.toString(), 1);

        const sessionCipher = new SessionCipher(this.storage, address);
        const plaintextBuffer = toArrayBuffer(new TextEncoder().encode(plaintext).buffer);
        const { type, body } = await sessionCipher.encrypt(plaintextBuffer);

        if (!body) {
            throw new Error("Encryption failed: no body in ciphertext");
        }

        // ciphertext.body is a base64 string, but we need to convert it properly
        // According to the library, body is a serialized protobuf message as base64 string
        return { type, body };
    }

    /**
     * Decrypt a message from a sender
     */
    async decryptMessage(senderId: number, ciphertext: { type: number; body: string }): Promise<string> {
        const address = new SignalProtocolAddress(senderId.toString(), 1);

        const sessionCipher = new SessionCipher(this.storage, address);

        // Handle both PreKeyWhisperMessage (type 3) and WhisperMessage (type 1)
        const { buffer, byteOffset, byteLength } = ub64(ciphertext.body);
        const bodyBuffer = toArrayBuffer(buffer.slice(byteOffset, byteOffset + byteLength));
        let plaintextBytes: ArrayBuffer;
        
        if (ciphertext.type === 3) {
            // PreKeyWhisperMessage
            plaintextBytes = await sessionCipher.decryptPreKeyWhisperMessage(bodyBuffer);
        } else {
            // WhisperMessage
            plaintextBytes = await sessionCipher.decryptWhisperMessage(bodyBuffer);
        }

        return new TextDecoder().decode(plaintextBytes);
    }

    /**
     * Check if a session exists for a recipient
     */
    async hasSession(recipientId: number): Promise<boolean> {
        const address = new SignalProtocolAddress(recipientId.toString(), 1);
        const sessionCipher = new SessionCipher(this.storage, address);
        return await sessionCipher.hasOpenSession();
    }
}

