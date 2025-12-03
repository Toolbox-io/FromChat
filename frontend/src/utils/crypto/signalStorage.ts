/**
 * IndexedDB storage implementation for Signal Protocol
 * Stores identity keys, prekeys, signed prekeys, and session states
 */

import type { StorageType, KeyPairType, Direction } from "@privacyresearch/libsignal-protocol-typescript";

const DB_NAME = "signal_protocol_db";
const DB_VERSION = 1;

interface SignalDB {
    identityKeys: IDBObjectStore;
    preKeys: IDBObjectStore;
    signedPreKeys: IDBObjectStore;
    sessions: IDBObjectStore;
    registrationId: IDBObjectStore;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Identity keys store: key = userId, value = { publicKey, privateKey }
            if (!db.objectStoreNames.contains("identityKeys")) {
                db.createObjectStore("identityKeys", { keyPath: "userId" });
            }

            // Prekeys store: key = userId + preKeyId, value = { userId, preKeyId, publicKey, privateKey }
            if (!db.objectStoreNames.contains("preKeys")) {
                const preKeysStore = db.createObjectStore("preKeys", { keyPath: ["userId", "preKeyId"] });
                preKeysStore.createIndex("userId", "userId", { unique: false });
            }

            // Signed prekeys store: key = userId, value = { userId, keyId, publicKey, privateKey, signature }
            if (!db.objectStoreNames.contains("signedPreKeys")) {
                db.createObjectStore("signedPreKeys", { keyPath: "userId" });
            }

            // Sessions store: key = userId + recipientId, value = { userId, recipientId, deviceId, record }
            // Note: recipientId is stored in the deviceId field for backward compatibility
            // The actual deviceId is always 1 for now
            if (!db.objectStoreNames.contains("sessions")) {
                const sessionsStore = db.createObjectStore("sessions", { keyPath: ["userId", "deviceId"] });
                sessionsStore.createIndex("userId", "userId", { unique: false });
            }

            // Registration ID store: key = userId, value = { userId, registrationId }
            if (!db.objectStoreNames.contains("registrationId")) {
                db.createObjectStore("registrationId", { keyPath: "userId" });
            }
        };
    });

    return dbPromise;
}

async function getStore(storeName: keyof SignalDB, mode: IDBTransactionMode = "readonly"): Promise<IDBObjectStore> {
    const db = await openDB();
    const tx = db.transaction([storeName], mode);
    return tx.objectStore(storeName);
}

// Helper to convert Uint8Array to ArrayBuffer
function toArrayBuffer(u8: Uint8Array | ArrayBuffer | ArrayBufferLike): ArrayBuffer {
    if (u8 instanceof ArrayBuffer) return u8;
    
    // Check if SharedArrayBuffer is available (requires COOP/COEP headers)
    const SharedArrayBufferConstructor = typeof SharedArrayBuffer !== "undefined" ? SharedArrayBuffer : null;
    
    if (SharedArrayBufferConstructor && u8 instanceof SharedArrayBufferConstructor) {
        // Convert SharedArrayBuffer to ArrayBuffer by copying
        const view = new Uint8Array(u8);
        const copy = new Uint8Array(view.length);
        copy.set(view);
        // copy.buffer is always ArrayBuffer for a newly created Uint8Array
        return copy.buffer as ArrayBuffer;
    }
    
    // Uint8Array case - buffer might be SharedArrayBuffer, so copy it
    if (u8 instanceof Uint8Array) {
        const buffer = u8.buffer;
        if (SharedArrayBufferConstructor && buffer instanceof SharedArrayBufferConstructor) {
            const copy = new Uint8Array(u8.length);
            copy.set(u8);
            // copy.buffer is always ArrayBuffer for a newly created Uint8Array
            return copy.buffer as ArrayBuffer;
        }
        const sliced = buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
        // Ensure we return ArrayBuffer, not SharedArrayBuffer
        if (SharedArrayBufferConstructor && sliced instanceof SharedArrayBufferConstructor) {
            const copy = new Uint8Array(sliced);
            // copy.buffer is always ArrayBuffer for a newly created Uint8Array
            return copy.buffer as unknown as ArrayBuffer;
        }
        // TypeScript doesn't know that slice() returns ArrayBuffer when buffer is ArrayBuffer
        // But we've already checked it's not SharedArrayBuffer, so it must be ArrayBuffer
        return sliced as unknown as ArrayBuffer;
    }
    
    // Fallback: treat as ArrayBuffer
    return u8 as unknown as ArrayBuffer;
}

// Helper to convert ArrayBuffer to Uint8Array
function toUint8Array(ab: ArrayBuffer | Uint8Array): Uint8Array {
    if (ab instanceof Uint8Array) return ab;
    return new Uint8Array(ab);
}

// Global session sync callback - set by sessionSync service
let sessionSyncCallback: ((address: string, record: string) => Promise<void>) | null = null;
// Flag to prevent sync callback during restoration (to avoid re-uploading restored sessions)
let isRestoring = false;

export function setSessionSyncCallback(callback: ((address: string, record: string) => Promise<void>) | null): void {
    sessionSyncCallback = callback;
}

export function setRestoring(restoring: boolean): void {
    isRestoring = restoring;
}

export class SignalProtocolStorage implements StorageType {
    private userId: string;

    constructor(userId: string) {
        this.userId = userId;
    }

    // Identity Key Management
    async getIdentityKeyPair(): Promise<KeyPairType | undefined> {
        const store = await getStore("identityKeys");
        const result = await new Promise<KeyPairType | undefined>((resolve, reject) => {
            const request = store.get(this.userId);
            request.onsuccess = () => {
                const data = request.result;
                if (!data) {
                    resolve(undefined);
                    return;
                }
                resolve({
                    pubKey: toArrayBuffer(data.publicKey),
                    privKey: toArrayBuffer(data.privateKey)
                });
            };
            request.onerror = () => reject(request.error);
        });

        return result;
    }

    async getLocalRegistrationId(): Promise<number | undefined> {
        const store = await getStore("registrationId");
        const result = await new Promise<{ registrationId: number } | undefined>((resolve, reject) => {
            const request = store.get(this.userId);
            request.onsuccess = () => {
                const data = request.result;
                resolve(data ? { registrationId: data.registrationId } : undefined);
            };
            request.onerror = () => reject(request.error);
        });

        return result?.registrationId;
    }

    async isTrustedIdentity(identifier: string, identityKey: ArrayBuffer, direction: Direction): Promise<boolean> {
        // For now, always trust (can be enhanced with key verification)
        // In production, you'd check against previously stored identity keys
        return true;
    }

    async saveIdentity(encodedAddress: string, publicKey: ArrayBuffer, nonblockingApproval?: boolean): Promise<boolean> {
        // Store other users' identity keys if needed
        // For now, we trust all identities
        return true;
    }

    // Helper methods for initialization (not part of StorageType interface)
    async saveIdentityKeyPair(keyPair: KeyPairType): Promise<void> {
        const store = await getStore("identityKeys", "readwrite");
        await new Promise<void>((resolve, reject) => {
            const request = store.put({
                userId: this.userId,
                publicKey: toUint8Array(keyPair.pubKey),
                privateKey: toUint8Array(keyPair.privKey)
            });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async saveLocalRegistrationId(registrationId: number): Promise<void> {
        const store = await getStore("registrationId", "readwrite");
        await new Promise<void>((resolve, reject) => {
            const request = store.put({
                userId: this.userId,
                registrationId: registrationId
            });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // PreKey Management
    async loadPreKey(encodedAddress: string | number): Promise<KeyPairType | undefined> {
        const preKeyId = typeof encodedAddress === "number" ? encodedAddress : parseInt(encodedAddress, 10);
        const store = await getStore("preKeys");
        const result = await new Promise<KeyPairType | undefined>((resolve, reject) => {
            const request = store.get([this.userId, preKeyId]);
            request.onsuccess = () => {
                const data = request.result;
                if (!data) {
                    resolve(undefined);
                    return;
                }
                resolve({
                    pubKey: toArrayBuffer(data.publicKey),
                    privKey: toArrayBuffer(data.privateKey)
                });
            };
            request.onerror = () => reject(request.error);
        });

        return result;
    }

    async storePreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
        const preKeyId = typeof keyId === "number" ? keyId : parseInt(keyId, 10);
        const store = await getStore("preKeys", "readwrite");
        await new Promise<void>((resolve, reject) => {
            const request = store.put({
                userId: this.userId,
                preKeyId: preKeyId,
                publicKey: toUint8Array(keyPair.pubKey),
                privateKey: toUint8Array(keyPair.privKey)
            });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async removePreKey(keyId: number | string): Promise<void> {
        const preKeyId = typeof keyId === "number" ? keyId : parseInt(keyId, 10);
        const store = await getStore("preKeys", "readwrite");
        await new Promise<void>((resolve, reject) => {
            const request = store.delete([this.userId, preKeyId]);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Signed PreKey Management
    async loadSignedPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
        const signedPreKeyId = typeof keyId === "number" ? keyId : parseInt(keyId, 10);
        const store = await getStore("signedPreKeys");
        const result = await new Promise<KeyPairType | undefined>((resolve, reject) => {
            const request = store.get(this.userId);
            request.onsuccess = () => {
                const data = request.result;
                if (!data || data.keyId !== signedPreKeyId) {
                    resolve(undefined);
                    return;
                }
                resolve({
                    pubKey: toArrayBuffer(data.publicKey),
                    privKey: toArrayBuffer(data.privateKey)
                });
            };
            request.onerror = () => reject(request.error);
        });

        return result;
    }

    async storeSignedPreKey(keyId: number | string, keyPair: KeyPairType, signature?: Uint8Array): Promise<void> {
        const signedPreKeyId = typeof keyId === "number" ? keyId : parseInt(keyId, 10);
        const store = await getStore("signedPreKeys", "readwrite");
        await new Promise<void>((resolve, reject) => {
            interface SignedPreKeyData {
                userId: string;
                keyId: number;
                publicKey: Uint8Array;
                privateKey: Uint8Array;
                signature?: Uint8Array;
            }
            const data: SignedPreKeyData = {
                userId: this.userId,
                keyId: signedPreKeyId,
                publicKey: toUint8Array(keyPair.pubKey),
                privateKey: toUint8Array(keyPair.privKey)
            };
            if (signature) {
                data.signature = toUint8Array(signature);
            }
            const request = store.put(data);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    async loadSignedPreKeySignature(keyId: number | string): Promise<Uint8Array | undefined> {
        const signedPreKeyId = typeof keyId === "number" ? keyId : parseInt(keyId, 10);
        const store = await getStore("signedPreKeys");
        const result = await new Promise<{ signature?: Uint8Array } | undefined>((resolve, reject) => {
            const request = store.get(this.userId);
            request.onsuccess = () => {
                const data = request.result;
                if (!data || data.keyId !== signedPreKeyId) {
                    resolve(undefined);
                    return;
                }
                resolve(data.signature ? { signature: toUint8Array(data.signature) } : undefined);
            };
            request.onerror = () => reject(request.error);
        });
        return result?.signature;
    }

    async removeSignedPreKey(keyId: number | string): Promise<void> {
        const store = await getStore("signedPreKeys", "readwrite");
        await new Promise<void>((resolve, reject) => {
            const request = store.delete(this.userId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Session Management
    async loadSession(encodedAddress: string): Promise<string | undefined> {
        // encodedAddress format: "recipientId.deviceId" (from Signal Protocol)
        // recipientId is the other user's ID, deviceId is always 1 for now
        const parts = encodedAddress.split(".");
        const recipientId = parts[0]; // First part is the recipient's user ID
        
        // Load using recipientId as the key (stored in deviceId field for backward compatibility)
        // Ensure we search with string to match how we stored it
        const store = await getStore("sessions");
        const result = await new Promise<string | undefined>((resolve, reject) => {
            const request = store.get([this.userId, String(recipientId)]);
            request.onsuccess = () => {
                const data = request.result;
                if (data && data.record && typeof data.record === "string" && data.record.length > 0) {
                    resolve(data.record);
                } else {
                    // Try with number if string didn't work (backward compatibility)
                    if (!data && !isNaN(Number(recipientId))) {
                        const numRequest = store.get([this.userId, Number(recipientId)]);
                        numRequest.onsuccess = () => {
                            const numData = numRequest.result;
                            if (numData && numData.record && typeof numData.record === "string" && numData.record.length > 0) {
                                resolve(numData.record);
                            } else {
                                console.warn(`Session record missing or invalid for recipient ${recipientId} (address: ${encodedAddress})`);
                                resolve(undefined);
                            }
                        };
                        numRequest.onerror = () => {
                            console.warn(`Session record missing for recipient ${recipientId} (address: ${encodedAddress})`);
                            resolve(undefined);
                        };
                    } else {
                        console.warn(`Session record missing or invalid for recipient ${recipientId} (address: ${encodedAddress})`);
                        resolve(undefined);
                    }
                }
            };
            request.onerror = () => {
                console.error(`Failed to load session for recipient ${recipientId}:`, request.error);
                reject(request.error);
            };
        });

        return result;
    }

    async storeSession(encodedAddress: string, record: string): Promise<void> {
        // encodedAddress format: "recipientId.deviceId" (from Signal Protocol)
        // recipientId is the other user's ID, deviceId is always 1 for now
        const parts = encodedAddress.split(".");
        const recipientId = parts[0]; // First part is the recipient's user ID
        
        // Validate record
        if (!record || typeof record !== "string" || record.length === 0) {
            console.warn(`Invalid session record for address ${encodedAddress}`);
            return;
        }
        
        // Store with recipientId as the key (using deviceId field for backward compatibility)
        // Ensure recipientId is stored as string to match how we load it
        const store = await getStore("sessions", "readwrite");
        await new Promise<void>((resolve, reject) => {
            const request = store.put({
                userId: this.userId,
                deviceId: String(recipientId), // Store recipientId as string in deviceId field
                record: record
            });
            request.onsuccess = () => {
                resolve();
                // If session sync callback is set and we're not restoring, upload to server in background (non-blocking)
                // Do this AFTER resolve() to ensure storage completes even if sync fails
                if (sessionSyncCallback && !isRestoring) {
                    // Use setTimeout to make it truly async and non-blocking
                    setTimeout(() => {
                        sessionSyncCallback!(encodedAddress, record).then(() => {
                            console.log(`Session synced to server for ${encodedAddress}`);
                        }).catch(err => {
                            console.error(`Failed to sync session to server for ${encodedAddress}:`, err);
                        });
                    }, 0);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async removeSession(encodedAddress: string): Promise<void> {
        // encodedAddress format: "recipientId.deviceId" (from Signal Protocol)
        // recipientId is the other user's ID, deviceId is always 1 for now
        const parts = encodedAddress.split(".");
        const recipientId = parts[0]; // First part is the recipient's user ID
        
        // Remove using recipientId as the key (stored in deviceId field for backward compatibility)
        const store = await getStore("sessions", "readwrite");
        await new Promise<void>((resolve, reject) => {
            const request = store.delete([this.userId, recipientId]);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all sessions for this user
     * Returns array of { address, record } where address is "recipientId.deviceId"
     * Note: In IndexedDB, deviceId field actually stores the recipientId from the Signal Protocol address
     */
    async getAllSessions(): Promise<Array<{ address: string; record: string }>> {
        const store = await getStore("sessions");
        const sessions: Array<{ address: string; record: string }> = [];
        
        return new Promise((resolve, reject) => {
            const request = store.index("userId").openCursor(IDBKeyRange.only(this.userId));
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    const data = cursor.value;
                    // In Signal Protocol, address format is "recipientId.deviceId"
                    // We stored it with recipientId in the deviceId field (for backward compatibility)
                    // The actual deviceId is always 1 for now
                    const recipientId = data.deviceId; // This is actually the recipientId from the address
                    const deviceId = 1; // Always 1 for now
                    const address = `${recipientId}.${deviceId}`;
                    
                    // Validate that record exists and is a string
                    if (data.record && typeof data.record === "string" && data.record.length > 0) {
                        sessions.push({ address, record: data.record });
                    } else {
                        console.warn(`Invalid session record for recipient ${recipientId}:`, data);
                    }
                    cursor.continue();
                } else {
                    resolve(sessions);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }
}

