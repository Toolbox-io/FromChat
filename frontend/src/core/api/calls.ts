import { API_BASE_URL } from "@/core/config";
import { getAuthHeaders } from "./user/auth";
import type { IceServersResponse } from "@/core/types";

/**
 * Fetches ICE server configuration for WebRTC
 */
export async function iceServers(token: string): Promise<IceServersResponse> {
    const res = await fetch(`${API_BASE_URL}/webrtc/ice`, {
        headers: getAuthHeaders(token, true)
    });
    if (!res.ok) throw new Error("Failed to fetch ICE servers");
    return await res.json();
}


