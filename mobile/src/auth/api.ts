import type { Headers } from "../core/types";

/**
 * Generates authentication headers for API requests
 * @param {boolean} json - Whether to include JSON content type header
 * @returns {Headers} Headers object with authentication and content type
 */
export function getAuthHeaders(token: string | null, json: boolean = true): Headers {
    const headers: Headers = {};

    if (json) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}