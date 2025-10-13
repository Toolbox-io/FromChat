/**
 * @fileoverview WebSocket connection management for real-time chat
 * @description Handles WebSocket connections, message processing, and auto-reconnection
 * @author Cursor
 * @version 1.0.0
 */

import { API_WS_BASE_URL } from "./config";
import type { WebSocketMessage } from "./types";
import { delay } from "@/utils/utils";
import { CallSignalingHandler } from "./calls/signaling";

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
let globalMessageHandler: ((response: WebSocketMessage<any>) => void) | null = null;

/**
 * Call signaling handler
 */
let callSignalingHandler: CallSignalingHandler | null = null;

/**
 * Set the global WebSocket message handler
 * @param handler - Function to handle WebSocket messages
 */
export function setGlobalMessageHandler(handler: ((response: WebSocketMessage<any>) => void) | null): void {
    globalMessageHandler = handler;
}

/**
 * Set the call signaling handler
 * @param handler - Call signaling handler instance
 */
export function setCallSignalingHandler(handler: CallSignalingHandler | null): void {
    callSignalingHandler = handler;
}

export function request<Request, Response = any>(payload: WebSocketMessage<Request>): Promise<WebSocketMessage<Response>> {
    console.log("WebSocket request:", payload);
    return new Promise((resolve, reject) => {
        function requestInner() {
            let listener: ((e: MessageEvent) => void) | null = null;
            listener = (e) => {
                resolve(JSON.parse(e.data));
                websocket.removeEventListener("message", listener!);
            }
            websocket.addEventListener("message", listener);
            websocket.send(JSON.stringify(payload))

            setTimeout(() => reject("Request timed out"), 10000);
        }

        if (websocket.readyState == 0) {
            websocket.addEventListener("open", requestInner);
            setTimeout(() => reject("Request timed out"), 10000);
        } else {
            requestInner();
        }
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
    try {
        const response: WebSocketMessage<any> = JSON.parse(e.data);
        
        // Handle call signaling messages
        if (callSignalingHandler && response.type === "call_signaling" && response.data) {
            callSignalingHandler.handleWebSocketMessage(response.data);
        }
        
        // Route message to global handler if set
        if (globalMessageHandler) {
            globalMessageHandler(response);
        }
    } catch (error) {
        console.error("Error parsing WebSocket message:", error);
    }
});
websocket.addEventListener("error", onError);