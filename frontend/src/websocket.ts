/**
 * @fileoverview WebSocket connection management for real-time chat
 * @description Handles WebSocket connections, message processing, and auto-reconnection
 * @author Cursor
 * @version 1.0.0
 */

import { API_WS_BASE_URL } from "./core/config";
import type { WebSocketMessage } from "./core/types";
import { delay } from "./utils/utils";

/**
 * Creates a new WebSocket connection to the chat server
 * @returns {WebSocket} New WebSocket instance
 * @private
 */
function create(): WebSocket {
    let prefix = "ws://";
    if (location.protocol.includes("https")) {
        prefix = "wss://";
    }

    return new WebSocket(`${prefix}${API_WS_BASE_URL}/chat/ws`);
}

/**
 * Global WebSocket instance
 * @type {WebSocket}
 */
export let websocket: WebSocket = create();

/**
 * Global WebSocket message handler reference
 * This will be set by the active panel to handle incoming messages
 */
let globalMessageHandler: ((response: WebSocketMessage) => void) | null = null;

/**
 * Set the global WebSocket message handler
 * @param handler - Function to handle WebSocket messages
 */
export function setGlobalMessageHandler(handler: ((response: WebSocketMessage) => void) | null): void {
    globalMessageHandler = handler;
}

export function request(payload: WebSocketMessage): Promise<WebSocketMessage> {
    return new Promise((resolve, reject) => {
        let listener: ((e: MessageEvent) => void) | null = null;
        listener = (e) => {
            resolve(JSON.parse(e.data));
            websocket.removeEventListener("message", listener!);
        }
        websocket.addEventListener("message", listener);
        websocket.send(JSON.stringify(payload))

        setTimeout(() => reject("Request timed out"), 10000);
    })
}

/**
 * This function will wait 3 seconds and them attempts to reconnect the WebSocket.
 * If it fails, tries again in an endless loop until the connection is established
 * again.
 * 
 * @private
 */
async function onError() {
    console.warn("WebSocket disconnected, retrying in 3 seconds...");
    await delay(3000);
    websocket = create();

    let listener: () => void | null;
    listener = () => {
        console.log("WebSocket successfully reconnected!");
        websocket.removeEventListener("open", listener);
    }

    websocket.addEventListener("open", listener);
    websocket.addEventListener("error", onError);
}

/**
 * Recreate WebSocket connection (useful when user logs in)
 */
export function reconnectWebSocket(): void {
    websocket = create();
    websocket.addEventListener("error", onError);
}

// --------------
// Initialization
// --------------

websocket.addEventListener("message", (e) => {
    try {
        const response: WebSocketMessage = JSON.parse(e.data);
        
        // Route message to global handler if set
        if (globalMessageHandler) {
            globalMessageHandler(response);
        }
    } catch (error) {
        console.error("Error parsing WebSocket message:", error);
    }
});
websocket.addEventListener("error", onError);