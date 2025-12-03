/**
 * API functions for managing Signal Protocol sessions on the server
 */

import { API_BASE_URL } from "@/core/config";
import { getAuthHeaders } from "../user/auth";

export interface SessionData {
    recipientId: number;
    deviceId: number;
    encryptedData: string; // JSON string of encrypted session
}

/**
 * Upload encrypted Signal Protocol sessions to the server
 */
export async function uploadSessions(sessions: SessionData[], token: string): Promise<void> {
    const headers = getAuthHeaders(token, true);
    
    const payload = {
        sessions
    };

    const res = await fetch(`${API_BASE_URL}/crypto/signal/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
        throw new Error(`Failed to upload sessions: ${res.statusText}`);
    }
}

/**
 * Fetch all encrypted Signal Protocol sessions from the server
 */
export async function fetchSessions(token: string): Promise<SessionData[]> {
    const headers = getAuthHeaders(token, true);
    
    const res = await fetch(`${API_BASE_URL}/crypto/signal/sessions`, {
        method: "GET",
        headers
    });
    
    if (!res.ok) {
        throw new Error(`Failed to fetch sessions: ${res.statusText}`);
    }
    
    const data = await res.json();
    return data.sessions || [];
}

