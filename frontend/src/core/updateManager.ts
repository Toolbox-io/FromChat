/**
 * @fileoverview Update Manager for Telegram-like update system
 * @description Handles update sequence numbers, batching, and gap detection
 * @author Cursor
 * @version 1.0.0
 */

import { openDB, type IDBPDatabase } from "idb";

interface UpdateMessage<T = any> {
    type: string;
    data: T;
}

interface BatchedUpdatesMessage {
    type: "updates";
    seq: number;
    updates: UpdateMessage[];
}

const DB_NAME = "fromchat-updates";
const DB_VERSION = 1;
const STORE_NAME = "lastSequence";

let db: IDBPDatabase | null = null;

/**
 * Initialize IndexedDB for storing last sequence number
 */
async function initDB(): Promise<IDBPDatabase> {
    if (db) return db;
    
    db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(database) {
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME);
            }
        }
    });
    
    return db;
}

/**
 * Get the last received sequence number from IndexedDB
 */
export async function getLastSequence(): Promise<number> {
    try {
        return (await initDB())
            .transaction(STORE_NAME, "readonly")
            .objectStore(STORE_NAME)
            .get("lastSeq") || 0;
    } catch (error) {
        console.error("Failed to get last sequence:", error);
        return 0;
    }
}

/**
 * Store the last received sequence number in IndexedDB
 */
export async function setLastSequence(seq: number): Promise<void> {
    try {
        (await initDB()).transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(seq, "lastSeq");
    } catch (error) {
        console.error("Failed to set last sequence:", error);
    }
}

/**
 * Process a batched updates message
 * @param message - The batched updates message from the server
 * @param handler - Function to handle individual updates
 */
export async function processBatchedUpdates(
    message: BatchedUpdatesMessage,
    handler: (update: UpdateMessage) => void
): Promise<void> {
    const { seq, updates } = message;
    const lastSeq = await getLastSequence();
    
    // Log gap for debugging, but don't try to recover (getUpdates doesn't work properly)
    if (seq !== lastSeq + 1 && lastSeq > 0) {
        const gapSize = seq - (lastSeq + 1);
        console.warn(`Update gap detected: expected ${lastSeq + 1}, got ${seq} (gap size: ${gapSize}). Skipping ${gapSize} updates.`);
    }
    
    // Process all updates in the batch
    for (const update of updates) {
        handler(update);
    }
    
    // Update last sequence number
    await setLastSequence(seq);
}
