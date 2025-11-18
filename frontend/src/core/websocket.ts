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
import { onlineStatusManager } from "./onlineStatusManager";
import { typingManager } from "./typingManager";
import { useUserStore } from "@/state/user";

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
 * Reconnection state
 */
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // 30 seconds max delay
const INITIAL_RECONNECT_DELAY = 1000; // Start with 1 second
let isReconnecting = false;
let messageHandler: ((e: MessageEvent) => void) | null = null;
let errorHandler: ((e: Event) => void) | null = null;
let closeHandler: ((e: CloseEvent) => void) | null = null;
let openHandler: ((e: Event) => void) | null = null;

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

/**
 * Clean up all event listeners from the current WebSocket instance
 * @private
 */
function cleanupWebSocket(): void {
    if (websocket) {
        if (messageHandler) {
            websocket.removeEventListener("message", messageHandler);
        }
        if (errorHandler) {
            websocket.removeEventListener("error", errorHandler);
        }
        if (closeHandler) {
            websocket.removeEventListener("close", closeHandler);
        }
        if (openHandler) {
            websocket.removeEventListener("open", openHandler);
        }
        
        // Close if still connected
        if (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING) {
            try {
                websocket.close();
            } catch (e) {
                // Ignore errors during cleanup
            }
        }
    }
}

/**
 * Calculate exponential backoff delay
 * @param attempt - Current reconnection attempt number
 * @returns Delay in milliseconds
 * @private
 */
function getReconnectDelay(attempt: number): number {
    const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, attempt);
    return Math.min(delay, MAX_RECONNECT_DELAY);
}

/**
 * Handle WebSocket reconnection with exponential backoff
 * @private
 */
async function reconnect(): Promise<void> {
    if (isReconnecting) {
        return;
    }

    isReconnecting = true;
    
    // Clean up old connection
    cleanupWebSocket();

    const delayMs = getReconnectDelay(reconnectAttempts);
    reconnectAttempts++;

    await delay(delayMs);

    try {
        websocket = create();
        setupEventHandlers();
    } catch (error) {
        // If creation fails, try again
        isReconnecting = false;
        reconnect();
    }
}

/**
 * Setup event handlers for the WebSocket connection
 * @private
 */
function setupEventHandlers(): void {
    // Message handler
    messageHandler = (e: MessageEvent) => {
        try {
            const response: WebSocketMessage<any> = JSON.parse(e.data);

            // Handle call signaling messages
            if (callSignalingHandler && response.type === "call_signaling" && response.data) {
                callSignalingHandler.handleWebSocketMessage(response.data);
            }

            // Handle status and typing messages
            if (response.type === "statusUpdate") {
                onlineStatusManager.handleStatusUpdate(response as any);
            } else if (response.type === "typing") {
                typingManager.handleTyping(response as any);
            } else if (response.type === "stopTyping") {
                typingManager.handleStopTyping(response as any);
            } else if (response.type === "dmTyping") {
                typingManager.handleDmTyping(response as any);
            } else if (response.type === "stopDmTyping") {
                typingManager.handleStopDmTyping(response as any);
            } else if (response.type === "suspended") {
                // Handle account suspension
                const { setSuspended } = useUserStore.getState();
                const reason = response.data?.reason || "No reason provided";
                setSuspended(reason);
                // Close WebSocket connection
                websocket.close();
            } else if (response.type === "account_deleted") {
                // Handle account deletion - silent logout
                const { logout } = useUserStore.getState();
                logout();
                // Close WebSocket connection
                websocket.close();
            }

            // Route message to global handler if set
            if (globalMessageHandler) {
                globalMessageHandler(response);
            }
        } catch (error) {
            console.error("Error parsing WebSocket message:", error);
        }
    };
    websocket.addEventListener("message", messageHandler);

    // Open handler
    openHandler = () => {
        reconnectAttempts = 0; // Reset on successful connection
        isReconnecting = false;
    };
    websocket.addEventListener("open", openHandler);

    // Error handler
    errorHandler = () => {
        // Don't reconnect immediately on error - let close handler handle it
        // This prevents double reconnection attempts
    };
    websocket.addEventListener("error", errorHandler);

    // Close handler
    closeHandler = (e: CloseEvent) => {
        // Don't reconnect if it was a clean close (e.g., logout, suspension)
        if (e.code === 1000 || e.code === 1001) {
            return;
        }

        // Reconnect for unexpected closes
        if (!isReconnecting) {
            reconnect();
        }
    };
    websocket.addEventListener("close", closeHandler);
}

export function request<Request, Response = any>(payload: WebSocketMessage<Request>): Promise<WebSocketMessage<Response>> {
    console.log("WebSocket request:", payload);
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error("Request timed out"));
        }, 10000);

        function requestInner() {
            if (websocket.readyState !== WebSocket.OPEN) {
                clearTimeout(timeoutId);
                reject(new Error("WebSocket is not open"));
                return;
            }

            const listener = (e: MessageEvent) => {
                clearTimeout(timeoutId);
                try {
                    resolve(JSON.parse(e.data));
                } catch (error) {
                    reject(error);
                }
                websocket.removeEventListener("message", listener);
            };

            websocket.addEventListener("message", listener);
            
            try {
                websocket.send(JSON.stringify(payload));
            } catch (error) {
                clearTimeout(timeoutId);
                websocket.removeEventListener("message", listener);
                reject(error);
            }
        }

        if (websocket.readyState === WebSocket.CONNECTING) {
            const openListener = () => {
                websocket.removeEventListener("open", openListener);
                requestInner();
            };
            websocket.addEventListener("open", openListener);
        } else if (websocket.readyState === WebSocket.OPEN) {
            requestInner();
        } else {
            clearTimeout(timeoutId);
            reject(new Error("WebSocket is closed"));
        }
    });
}

// --------------
// Initialization
// --------------

setupEventHandlers();