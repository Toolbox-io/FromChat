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
    console.log("[Session API] Fetching sessions from server...");
    console.log("[Session API] URL:", `${API_BASE_URL}/crypto/signal/sessions`);
    
    const headers = getAuthHeaders(token, true);
    
    const res = await fetch(`${API_BASE_URL}/crypto/signal/sessions`, {
        method: "GET",
        headers
    });
    
    console.log("[Session API] Response status:", res.status, res.statusText);
    
    if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown error");
        console.error("[Session API] Failed to fetch sessions:", {
            status: res.status,
            statusText: res.statusText,
            errorText
        });
        throw new Error(`Failed to fetch sessions: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log("[Session API] Response data:", {
        hasSessions: !!data.sessions,
        sessionCount: data.sessions?.length || 0
    });
    
    return data.sessions || [];
}

