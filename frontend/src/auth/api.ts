import { API_BASE_URL } from "../core/config";
import { showLogin } from "../navigation";
import type { Headers, User, WebSocketMessage } from "../core/types";
import { clearAlerts } from "./auth";
import { request } from "../websocket";

/**
 * Current authenticated user information
 * @type {User | null}
 */
export let currentUser: User | null = null;

/**
 * JWT authentication token
 * @type {string | null}
 */
export let authToken: string | null = null;

/**
 * Sets the current user to the values provided.
 * @param token The authentication JWT token.
 * @param user The current authenticated user.
 */
export function setUser(token: string, user: User) {
    authToken = token
    currentUser = user

    try {
        const payload: WebSocketMessage = {
            type: "ping",
            credentials: {
                scheme: "Bearer",
                credentials: authToken
            },
            data: {}
        }

        request(payload).then(() => {
            console.log("Ping succeeded")
        })
    } catch {}
}

/**
 * Generates authentication headers for API requests
 * @param {boolean} json - Whether to include JSON content type header
 * @returns {Headers} Headers object with authentication and content type
 */
export function getAuthHeaders(json: boolean = true): Headers {
    const headers: Headers = {};

    if (json) {
        headers["Content-Type"] = "application/json";
    }

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
}

/**
 * Checks authentication status on page load
 */
export async function checkAuthStatus(): Promise<void> {
    // For JWT, we don't have a persistent token on page load
    // So we'll just show the login form
    showLogin();
}

/**
 * Logs out the current user and clears session data
 */
export async function logout(): Promise<void> {
    try {
        await fetch(`${API_BASE_URL}/logout`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    currentUser = null;
    authToken = null;
    showLogin();
    clearAlerts();
}