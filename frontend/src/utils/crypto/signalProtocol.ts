/**
 * Signal Protocol service wrapper
 * Provides high-level API for encrypting/decrypting messages using Signal Protocol
 */

import {
    SessionBuilder,
    SessionCipher,
    KeyHelper,
    SignalProtocolAddress,
    type DeviceType,
    type KeyPairType
} from "@privacyresearch/libsignal-protocol-typescript";
import { SignalProtocolStorage } from "./signalStorage";
import { b64, ub64 } from "../utils";
import api from "@/core/api";

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
    
    // Prekey configuration constants
    private static readonly PREKEY_COUNT = 20;
    private static readonly PREKEY_REGEN_THRESHOLD = 5; // Regenerate when fewer than this many prekeys are left
    private static readonly PREKEY_REGEN_COUNT = 10; // Number of prekeys to regenerate
    private static readonly SIGNED_PREKEY_ID = 1;
    private static readonly BATCH_SIZE = 10;

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
        const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, SignalProtocolService.SIGNED_PREKEY_ID);
        // Store both the key pair and its signature
        await this.storage.storeSignedPreKey(
            SignalProtocolService.SIGNED_PREKEY_ID, 
            signedPreKey.keyPair, 
            new Uint8Array(signedPreKey.signature)
        );

        // Generate prekeys (one-time keys for establishing new sessions)
        // Each new conversation consumes one prekey when the first message is sent
        // Generation is non-blocking (yields to event loop), so this doesn't freeze the UI
        for (let i = 1; i <= SignalProtocolService.PREKEY_COUNT; i++) {
            const preKey = await KeyHelper.generatePreKey(i);
            await this.storage.storePreKey(i, preKey.keyPair);
            
            // Yield to event loop every batchSize keys to prevent UI freezing
            if (i % SignalProtocolService.BATCH_SIZE === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }

    /**
     * Ensure signed prekey exists and is valid, regenerating if necessary
     */
    private async ensureSignedPreKey(identityKeyPair: KeyPairType): Promise<{ keyPair: KeyPairType; signature: Uint8Array }> {
        let signature = await this.storage.loadSignedPreKeySignature(SignalProtocolService.SIGNED_PREKEY_ID);
        let signedPreKey = await this.storage.loadSignedPreKey(SignalProtocolService.SIGNED_PREKEY_ID);
        
        if (!signedPreKey || !signature) {
            // Signed prekey or signature missing - regenerate both to ensure consistency
            const signedPreKeyWithSig = await KeyHelper.generateSignedPreKey(identityKeyPair, SignalProtocolService.SIGNED_PREKEY_ID);
            await this.storage.storeSignedPreKey(
                SignalProtocolService.SIGNED_PREKEY_ID, 
                signedPreKeyWithSig.keyPair, 
                new Uint8Array(signedPreKeyWithSig.signature)
            );
            signedPreKey = signedPreKeyWithSig.keyPair;
            signature = new Uint8Array(signedPreKeyWithSig.signature);
        }
        
        return { keyPair: signedPreKey, signature };
    }
    
    /**
     * Find an available prekey, regenerating if necessary
     */
    private async findOrRegeneratePreKey(): Promise<{ keyPair: KeyPairType; keyId: number }> {
        // Find the first available prekey
        let preKey: KeyPairType | undefined;
        let preKeyId = 0;
        let availableCount = 0;
        
        for (let i = 1; i <= SignalProtocolService.PREKEY_COUNT; i++) {
            const candidate = await this.storage.loadPreKey(i);
            if (candidate) {
                availableCount++;
                if (!preKey) {
                    preKey = candidate;
                    preKeyId = i;
                }
            }
        }
        
        // If we're running low on prekeys, regenerate more proactively
        if (availableCount < SignalProtocolService.PREKEY_REGEN_THRESHOLD) {
            console.warn(`Low on prekeys (${availableCount} remaining), regenerating...`);
            
            // Find the next available ID to regenerate from
            let nextId = SignalProtocolService.PREKEY_COUNT + 1;
            for (let i = 1; i <= SignalProtocolService.PREKEY_COUNT; i++) {
                const existing = await this.storage.loadPreKey(i);
                if (!existing) {
                    nextId = i;
                    break;
                }
            }
            
            // Regenerate prekeys starting from nextId
            for (let i = 0; i < SignalProtocolService.PREKEY_REGEN_COUNT; i++) {
                const keyId = nextId + i;
                const existing = await this.storage.loadPreKey(keyId);
                if (!existing) {
                    const newPreKey = await KeyHelper.generatePreKey(keyId);
                    await this.storage.storePreKey(keyId, newPreKey.keyPair);
                    if (!preKey) {
                        preKey = newPreKey.keyPair;
                        preKeyId = keyId;
                    }
                }
            }
        }
        
        // Emergency fallback if still no prekey
        if (!preKey) {
            console.error("No prekeys available, emergency regeneration...");
            const newPreKey = await KeyHelper.generatePreKey(1);
            await this.storage.storePreKey(1, newPreKey.keyPair);
            preKey = newPreKey.keyPair;
            preKeyId = 1;
        }
        
        return { keyPair: preKey, keyId: preKeyId };
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

        const { keyPair: signedPreKey, signature } = await this.ensureSignedPreKey(identityKeyPair);
        const { keyPair: preKey, keyId: preKeyId } = await this.findOrRegeneratePreKey();

        return {
            registrationId: registrationId,
            identityKey: b64(new Uint8Array(identityKeyPair.pubKey)),
            signedPreKey: {
                keyId: SignalProtocolService.SIGNED_PREKEY_ID,
                publicKey: b64(new Uint8Array(signedPreKey.pubKey)),
                signature: b64(signature)
            },
            preKey: {
                keyId: preKeyId,
                publicKey: b64(new Uint8Array(preKey.pubKey))
            }
        };
    }
    
    /**
     * Get all available prekeys for uploading to the server
     */
    async getAllPreKeys(): Promise<Array<{ keyId: number; publicKey: string }>> {
        const prekeys: Array<{ keyId: number; publicKey: string }> = [];
        
        // Check all possible prekey IDs (including regenerated ones beyond initial count)
        // We check up to PREKEY_COUNT + PREKEY_REGEN_COUNT to include regenerated prekeys
        const maxPreKeyId = SignalProtocolService.PREKEY_COUNT + SignalProtocolService.PREKEY_REGEN_COUNT;
        
        for (let i = 1; i <= maxPreKeyId; i++) {
            const prekey = await this.storage.loadPreKey(i);
            if (prekey) {
                prekeys.push({
                    keyId: i,
                    publicKey: b64(new Uint8Array(prekey.pubKey))
                });
            }
        }
        
        return prekeys;
    }
    
    /**
     * Get the base bundle (without prekey) for uploading all prekeys
     */
    async getBaseBundle(): Promise<Omit<PreKeyBundleData, "preKey">> {
        const identityKeyPair = await this.storage.getIdentityKeyPair();
        if (!identityKeyPair) {
            throw new Error("Signal Protocol not initialized");
        }

        const registrationId = await this.storage.getLocalRegistrationId();
        if (!registrationId) {
            throw new Error("Registration ID not found");
        }

        const { keyPair: signedPreKey, signature } = await this.ensureSignedPreKey(identityKeyPair);

        return {
            registrationId: registrationId,
            identityKey: b64(new Uint8Array(identityKeyPair.pubKey)),
            signedPreKey: {
                keyId: SignalProtocolService.SIGNED_PREKEY_ID,
                publicKey: b64(new Uint8Array(signedPreKey.pubKey)),
                signature: b64(signature)
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
        try {
            const address = new SignalProtocolAddress(recipientId.toString(), 1);

            const sessionCipher = new SessionCipher(this.storage, address);
            const plaintextBuffer = toArrayBuffer(new TextEncoder().encode(plaintext).buffer);
            const encryptResult = await sessionCipher.encrypt(plaintextBuffer);
            const { type, body } = encryptResult;

            if (!body) {
                throw new Error("Encryption failed: no body in ciphertext");
            }

        // The library returns body as ArrayBuffer or Uint8Array, we need to convert it to base64 string
        // Always convert to Uint8Array first, then to base64, regardless of input type
        let bodyArray: Uint8Array;
        const bodyAny = body as any;
        
        if (typeof body === "string") {
            // String input - check if it's already base64
            const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
            if (base64Regex.test(body)) {
                // Already base64, use as-is
                bodyArray = ub64(body);
            } else {
                // String contains binary data, convert to Uint8Array
                bodyArray = new Uint8Array([...body].map(c => c.charCodeAt(0)));
            }
        } else if (bodyAny instanceof Uint8Array) {
            bodyArray = bodyAny;
        } else if (bodyAny instanceof ArrayBuffer) {
            bodyArray = new Uint8Array(bodyAny);
        } else {
            // Try to convert unknown type
            if (bodyAny.buffer && bodyAny.buffer instanceof ArrayBuffer) {
                bodyArray = new Uint8Array(bodyAny.buffer, bodyAny.byteOffset || 0, bodyAny.byteLength || bodyAny.buffer.byteLength);
            } else {
                bodyArray = new Uint8Array(bodyAny as ArrayBuffer);
            }
        }
        
        // Convert to base64
        const bodyBase64 = b64(bodyArray);
        
        // Final validation - ensure the result is valid base64
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Regex.test(bodyBase64)) {
            throw new Error(`Failed to convert body to base64: result contains invalid characters. Length: ${bodyBase64.length}`);
        }
        
        // Test that it can be decoded
        try {
            atob(bodyBase64.substring(0, Math.min(4, bodyBase64.length)));
        } catch (error) {
            throw new Error(`Failed to convert body to base64: ${error instanceof Error ? error.message : String(error)}`);
        }

        return { type, body: bodyBase64 };
        } catch (error) {
            // Log detailed error information for debugging
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Signal Protocol encryption failed:", {
                recipientId,
                plaintextLength: plaintext.length,
                error: errorMessage
            });
            throw new Error(`Failed to encrypt message: ${errorMessage}`);
        }
    }

    /**
     * Decrypt a message from a sender
     */
    async decryptMessage(senderId: number, ciphertext: { type: number; body: string }): Promise<string> {
        if (!ciphertext.body || typeof ciphertext.body !== "string") {
            throw new Error("Invalid ciphertext: body is missing or not a string");
        }

        const address = new SignalProtocolAddress(senderId.toString(), 1);

        const sessionCipher = new SessionCipher(this.storage, address);

        // Handle both PreKeyWhisperMessage (type 3) and WhisperMessage (type 1)
        // ciphertext.body is a base64 string from the Signal Protocol library
        let bodyBuffer: ArrayBuffer;
        try {
            const { buffer, byteOffset, byteLength } = ub64(ciphertext.body);
            bodyBuffer = toArrayBuffer(buffer.slice(byteOffset, byteOffset + byteLength));
        } catch (error) {
            throw new Error(`Failed to decode ciphertext body: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        let plaintextBytes: ArrayBuffer;
        try {
            if (ciphertext.type === 3) {
                // PreKeyWhisperMessage - this will consume a prekey
                // Count available prekeys before decryption
                const prekeysBefore = await this.countAvailablePrekeys();
                
                plaintextBytes = await sessionCipher.decryptPreKeyWhisperMessage(bodyBuffer);
                
                // Check if a prekey was consumed (removed by the library)
                const prekeysAfter = await this.countAvailablePrekeys();
                if (prekeysBefore > prekeysAfter) {
                    // A prekey was consumed - refresh the bundle in the background
                    // This ensures new users can still message you while you're offline
                    this.refreshPreKeyBundle().catch(err => 
                        console.warn("Failed to refresh prekey bundle after consumption:", err)
                    );
                }
            } else {
                // WhisperMessage - uses existing session, no prekey consumed
                plaintextBytes = await sessionCipher.decryptWhisperMessage(bodyBuffer);
            }
        } catch (error) {
            // Log detailed error information for debugging
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Handle different types of decryption errors
            if (errorMessage.includes("Bad MAC")) {
                console.warn(`Bad MAC error detected for sender ${senderId} (type ${ciphertext.type}). Session may be out of sync.`);
                
                // For both types, remove the session so next message can re-establish it
                try {
                    await this.storage.removeSession(address.toString());
                    console.warn(`Removed corrupted session for sender ${senderId}. Sender needs to send a new message to re-establish session.`);
                } catch (resetError) {
                    console.error("Failed to remove session:", resetError);
                }
            } else if (
                errorMessage.includes("Tried to decrypt on a sending chain") || 
                errorMessage.includes("No record for device") ||
                errorMessage.includes("Message key not found") ||
                errorMessage.includes("counter was repeated") ||
                errorMessage.includes("key was not filled")
            ) {
                // These errors indicate the session state is corrupted, missing, or out of sync
                // Remove the session so it can be re-established
                console.warn(`Session state error for sender ${senderId}: ${errorMessage}. Removing session.`);
                try {
                    await this.storage.removeSession(address.toString());
                    console.warn(`Removed corrupted session for sender ${senderId}. Sender needs to send a new message to re-establish session.`);
                } catch (resetError) {
                    console.error("Failed to remove session:", resetError);
                }
            }
            
            console.error("Signal Protocol decryption failed:", {
                senderId,
                type: ciphertext.type,
                bodyLength: ciphertext.body.length,
                bodyFirst50: ciphertext.body.substring(0, 50),
                bodyLast50: ciphertext.body.substring(Math.max(0, ciphertext.body.length - 50)),
                bodyIsBase64: /^[A-Za-z0-9+/]*={0,2}$/.test(ciphertext.body),
                error: errorMessage
            });
            throw new Error(`Failed to decrypt message: ${errorMessage}`);
        }

        return new TextDecoder().decode(plaintextBytes);
    }
    
    /**
     * Count available prekeys
     */
    private async countAvailablePrekeys(): Promise<number> {
        let count = 0;
        const maxPreKeyId = SignalProtocolService.PREKEY_COUNT + SignalProtocolService.PREKEY_REGEN_COUNT;
        
        for (let i = 1; i <= maxPreKeyId; i++) {
            const prekey = await this.storage.loadPreKey(i);
            if (prekey) {
                count++;
            }
        }
        return count;
    }
    
    /**
     * Refresh prekey bundle after a prekey was consumed
     * This ensures new users can still message you while you're offline
     * Uploads all available prekeys to the server for rotation
     */
    private async refreshPreKeyBundle(): Promise<void> {
        try {
            const token = api.user.auth.getAuthToken();
            if (!token) {
                console.warn("No auth token, cannot refresh prekey bundle");
                return;
            }
            
            const baseBundle = await this.getBaseBundle();
            const prekeys = await this.getAllPreKeys();
            
            // Upload all prekeys in the background
            api.crypto.prekeys.uploadAllPreKeys(baseBundle, prekeys, token).catch(err => 
                console.warn("Failed to upload all prekeys:", err)
            );
        } catch (error) {
            console.error("Failed to refresh prekey bundle:", error);
        }
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

