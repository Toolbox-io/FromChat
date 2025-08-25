/**
 * @fileoverview WebSocket connection management for real-time chat
 * @description Handles WebSocket connections, message processing, and auto-reconnection
 * @author Cursor
 * @version 1.0.0
 */

import { handleWebSocketMessage } from "./chat/chat";
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

// --------------
// Initialization
// --------------

websocket.addEventListener("message", (e) => {
    handleWebSocketMessage(JSON.parse(e.data));
});
websocket.addEventListener("error", onError);