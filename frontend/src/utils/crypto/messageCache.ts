/**
 * Message cache for storing sent message plaintexts
 * Since Signal Protocol doesn't allow decrypting your own sent messages,
 * we store the plaintext locally and optionally sync to server
 */

const DB_NAME = "message_cache_db";
const DB_VERSION = 1;
const STORE_NAME = "sent_messages";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                // Key: [userId, messageId], Value: { plaintext, timestamp }
                const store = db.createObjectStore(STORE_NAME, { keyPath: ["userId", "messageId"] });
                store.createIndex("userId", "userId", { unique: false });
                store.createIndex("messageId", "messageId", { unique: false });
            }
        };
    });

    return dbPromise;
}

async function getStore(mode: IDBTransactionMode = "readonly"): Promise<IDBObjectStore> {
    const db = await openDB();
    const tx = db.transaction([STORE_NAME], mode);
    return tx.objectStore(STORE_NAME);
}

interface CachedMessage {
    userId: number;
    messageId: number;
    plaintext: string;
    timestamp: string;
}

/**
 * Store a sent message's plaintext in the cache
 */
export async function cacheSentMessage(userId: number, messageId: number, plaintext: string): Promise<void> {
    try {
        const store = await getStore("readwrite");
        await new Promise<void>((resolve, reject) => {
            const request = store.put({
                userId,
                messageId,
                plaintext,
                timestamp: new Date().toISOString()
            });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.warn("Failed to cache sent message:", error);
    }
}

/**
 * Retrieve a sent message's plaintext from the cache
 */
export async function getCachedMessage(userId: number, messageId: number): Promise<string | null> {
    try {
        const store = await getStore();
        const result = await new Promise<CachedMessage | undefined>((resolve, reject) => {
            const request = store.get([userId, messageId]);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return result?.plaintext || null;
    } catch (error) {
        console.warn("Failed to get cached message:", error);
        return null;
    }
}

/**
 * Get all cached messages for a user
 */
export async function getAllCachedMessages(userId: number): Promise<Map<number, string>> {
    const cache = new Map<number, string>();
    try {
        const store = await getStore();
        const index = store.index("userId");
        const result = await new Promise<CachedMessage[]>((resolve, reject) => {
            const request = index.getAll(userId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        result.forEach(msg => {
            cache.set(msg.messageId, msg.plaintext);
        });
    } catch (error) {
        console.warn("Failed to get all cached messages:", error);
    }
    return cache;
}

/**
 * Clear cached messages for a user (e.g., on logout)
 */
export async function clearCachedMessages(userId: number): Promise<void> {
    try {
        const store = await getStore("readwrite");
        const index = store.index("userId");
        await new Promise<void>((resolve, reject) => {
            const request = index.openCursor(IDBKeyRange.only(userId));
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.warn("Failed to clear cached messages:", error);
    }
}

