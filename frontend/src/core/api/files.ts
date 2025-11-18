import { API_BASE_URL } from "@/core/config";
import { getAuthHeaders } from "./account";

/**
 * Gets the URL for a normal (unencrypted) file
 */
export function getNormalFileUrl(filename: string): string {
    return `${API_BASE_URL}/uploads/files/normal/${filename}`;
}

/**
 * Gets the URL for an encrypted file
 */
export function getEncryptedFileUrl(filename: string): string {
    return `${API_BASE_URL}/uploads/files/encrypted/${filename}`;
}

/**
 * Fetches a normal file (unencrypted)
 */
export async function fetchNormalFile(filename: string, token: string): Promise<Blob> {
    const res = await fetch(getNormalFileUrl(filename), {
        headers: getAuthHeaders(token, false)
    });
    if (!res.ok) throw new Error("Failed to fetch file");
    return await res.blob();
}

/**
 * Fetches an encrypted file
 */
export async function fetchEncryptedFile(filename: string, token: string): Promise<Blob> {
    const res = await fetch(getEncryptedFileUrl(filename), {
        headers: getAuthHeaders(token, false)
    });
    if (!res.ok) throw new Error("Failed to fetch encrypted file");
    return await res.blob();
}

