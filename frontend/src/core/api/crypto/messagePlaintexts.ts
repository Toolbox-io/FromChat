/**
 * API functions for managing encrypted message plaintexts on the server
 */

import { API_BASE_URL } from "@/core/config";
import api from "@/core/api";

export interface MessagePlaintextData {
    messageId: number;
    recipientId: number;
    encryptedData: string;
}

export interface MessagePlaintextResponse {
    messageId: number;
    recipientId: number;
    encryptedData: string;
    createdAt: string;
}

/**
 * Upload encrypted message plaintexts to the server
 */
export async function uploadMessagePlaintexts(
    messages: MessagePlaintextData[],
    token: string
): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/crypto/signal/message-plaintexts`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...api.user.auth.getAuthHeaders(token, false)
        },
        body: JSON.stringify({ messages })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Failed to upload message plaintexts" }));
        throw new Error(error.detail || "Failed to upload message plaintexts");
    }
}

/**
 * Fetch encrypted message plaintexts from the server
 */
export async function fetchMessagePlaintexts(
    token: string,
    recipientId?: number
): Promise<MessagePlaintextResponse[]> {
    let url = `${API_BASE_URL}/crypto/signal/message-plaintexts`;
    if (recipientId !== undefined) {
        const separator = url.includes("?") ? "&" : "?";
        url = `${url}${separator}recipient_id=${recipientId}`;
    }

    const response = await fetch(url, {
        method: "GET",
        headers: api.user.auth.getAuthHeaders(token, false)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Failed to fetch message plaintexts" }));
        throw new Error(error.detail || "Failed to fetch message plaintexts");
    }

    const data = await response.json();
    return data.messages || [];
}

