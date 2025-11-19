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

            // Sessions store: key = userId + deviceId, value = { userId, deviceId, record }
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
function toArrayBuffer(u8: Uint8Array | ArrayBuffer): ArrayBuffer {
    if (u8 instanceof ArrayBuffer) return u8;
    return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

// Helper to convert ArrayBuffer to Uint8Array
function toUint8Array(ab: ArrayBuffer | Uint8Array): Uint8Array {
    if (ab instanceof Uint8Array) return ab;
    return new Uint8Array(ab);
}

export class SignalProtocolStorage implements StorageType {
    private userId: string;

    constructor(userId: string) {
        this.userId = userId;
    }

    // Identity Key Management
    async getIdentityKeyPair(): Promise<KeyPairType | undefined> {
        const store = await getStore("identityKeys");
        const result = await new Promise<{ publicKey: ArrayBuffer; privateKey: ArrayBuffer } | undefined>((resolve, reject) => {
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
        const result = await new Promise<{ publicKey: ArrayBuffer; privateKey: ArrayBuffer } | undefined>((resolve, reject) => {
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
        const result = await new Promise<{ publicKey: ArrayBuffer; privateKey: ArrayBuffer; keyId: number } | undefined>((resolve, reject) => {
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

    async storeSignedPreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
        const signedPreKeyId = typeof keyId === "number" ? keyId : parseInt(keyId, 10);
        const store = await getStore("signedPreKeys", "readwrite");
        await new Promise<void>((resolve, reject) => {
            const request = store.put({
                userId: this.userId,
                keyId: signedPreKeyId,
                publicKey: toUint8Array(keyPair.pubKey),
                privateKey: toUint8Array(keyPair.privKey)
            });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
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
        // encodedAddress format: "userId.deviceId"
        const parts = encodedAddress.split(".");
        const deviceId = parts.length > 1 ? parts[1] : encodedAddress;
        
        const store = await getStore("sessions");
        const result = await new Promise<{ record: string } | undefined>((resolve, reject) => {
            const request = store.get([this.userId, deviceId]);
            request.onsuccess = () => {
                const data = request.result;
                resolve(data ? data.record : undefined);
            };
            request.onerror = () => reject(request.error);
        });

        return result;
    }

    async storeSession(encodedAddress: string, record: string): Promise<void> {
        // encodedAddress format: "userId.deviceId"
        const parts = encodedAddress.split(".");
        const deviceId = parts.length > 1 ? parts[1] : encodedAddress;
        
        const store = await getStore("sessions", "readwrite");
        await new Promise<void>((resolve, reject) => {
            const request = store.put({
                userId: this.userId,
                deviceId: deviceId,
                record: record
            });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

