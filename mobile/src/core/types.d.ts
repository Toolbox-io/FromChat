/**
 * @fileoverview Global TypeScript type definitions
 * @description Contains all type definitions used throughout the application
 * @author Cursor
 * @version 1.0.0
 */


/**
 * HTTP headers object type
 * @typedef {Object.<string, string>} Headers
 */
export type Headers = {[x: string]: string}

/**
 * API error response structure
 * @interface ErrorResponse
 * @property {string} message - Error message from the server
 */
export interface ErrorResponse {
    message: string;
}

/**
 * 2D coordinate structure
 * @interface Size2D
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 */
export interface Size2D {
    x: number;
    y: number;
}

export interface Rect extends Size2D {
    width: number;
    height: number;
}

// App types

/**
 * Chat message structure
 * @interface Message
 * @property {number} id - Unique message identifier
 * @property {string} username - Username of the message sender
 * @property {string} content - Message content
 * @property {boolean} is_read - Whether the message has been read
 * @property {boolean} is_edited - Whether the message has been edited
 * @property {string} timestamp - ISO timestamp of the message
 * @property {string} [profile_picture] - URL to sender's profile picture
 * @property {Message} [reply_to] - The message this is replying to
 */
export interface Message {
    id: number;
    username: string;
    content: string;
    is_read: boolean;
    is_edited: boolean;
    timestamp: string;
    profile_picture?: string;
    reply_to?: Message;
    files?: Attachment[];

    runtimeData?: {
        dmEnvelope?: DmEnvelope;
        sendingState?: {
            status: 'sending' | 'sent' | 'failed';
            tempId?: string; // Temporary ID for tracking until server confirms
            retryData?: {
                content: string;
                replyToId?: number;
                files?: File[];
            };
        };
    }
}

/**
 * Collection of messages
 * @interface Messages
 * @property {Message[]} messages - Array of message objects
 */
export interface Messages {
    messages: Message[];
}

/**
 * User information structure
 * @interface User
 * @property {number} id - Unique user identifier
 * @property {string} created_at - ISO timestamp of account creation
 * @property {string} last_seen - ISO timestamp of last activity
 * @property {boolean} online - Whether the user is currently online
 * @property {string} username - Username
 * @property {string} [bio] - User biography
 */
export interface User {
    id: number;
    created_at: string;
    last_seen: string;
    online: boolean;
    username: string;
    admin?: boolean;
    bio?: string;
    profile_picture: string;
}

/**
 * User profile response structure
 * @interface UserProfile
 * @property {number} id - Unique user identifier
 * @property {string} username - Username
 * @property {string} [profile_picture] - URL to user's profile picture
 * @property {string} [bio] - User biography
 * @property {boolean} online - Whether the user is currently online
 * @property {string} last_seen - ISO timestamp of last activity
 * @property {string} created_at - ISO timestamp of account creation
 */
export interface UserProfile {
    id: number;
    username: string;
    profile_picture?: string;
    bio?: string;
    online: boolean;
    last_seen: string;
    created_at: string;
}

// ----------
// API models
// ----------

// Requests

/**
 * Login request structure
 * @interface LoginRequest
 * @property {string} username - Username for authentication
 * @property {string} password - Password for authentication
 */
export interface LoginRequest {
    username: string;
    password: string;
}

/**
 * Registration request structure
 * @interface RegisterRequest
 * @property {string} username - Desired username
 * @property {string} password - Desired password
 * @property {string} confirm_password - Password confirmation
 */
export interface RegisterRequest {
    username: string;
    password: string;
    confirm_password: string;
}

export interface UploadPublicKeyRequest {
    publicKey: string;
}

export interface SendDMRequest {
    recipientId: number;
    iv: string;
    ciphertext: string;
    salt: string;
    iv2: string;
    wrappedMk: string;
    replyToId?: number;
}

// Responses

/**
 * Login response structure
 * @interface LoginResponse
 * @property {User} user - User information
 * @property {string} token - JWT authentication token
 */
export interface LoginResponse {
    user: User;
    token: string;
}

export interface BackupBlob {
    blob: string;
}

export interface BaseDmEnvelope {
    iv: string;
    ciphertext: string;
    salt: string;
    iv2: string;
    wrappedMk: string;
    recipientId: number;
}

export interface DmEnvelope extends BaseDmEnvelope {
    id: number;
    senderId: number;
    files?: DmFile[];
    timestamp: string;
}

export interface DmFile {
    name: string;
    id: number;
    path: string;
}

export interface DmEditedPayload { 
    id: number; 
    iv: string; 
    ciphertext: string; 
    timestamp: string 
}

export interface DmDeletedPayload { 
    id: number; 
    senderId: number; 
    recipientId: number 
}

export interface FetchDMResponse {
    messages: DmEnvelope[]
}

export interface DmEncryptedJSON {
    type: "text",
    data: {
        content: string;
        reply_to_id?: number;
        files?: Attachment[];
    }
}

// ---------------
// WebSocket types
// ---------------

/**
 * WebSocket message structure
 * @interface WebSocketMessage
 * @property {string} type - Message type identifier
 * @property {WebSocketCredentials} [credentials] - Authentication credentials
 * @property {any} [data] - Message payload data
 * @property {WebSocketError} [error] - Error information if applicable
 */
export interface WebSocketMessage<T> {
    type: string;
    credentials?: WebSocketCredentials;
    data?: T;
    error?: WebSocketError;
}

/**
 * WebSocket error structure
 * @interface WebSocketError
 * @property {number} code - Error code
 * @property {string} detail - Error detail message
 */
export interface WebSocketError {
    code: number;
    detail: string;
}

/**
 * WebSocket authentication credentials
 * @interface WebSocketCredentials
 * @property {string} scheme - Authentication scheme (e.g., "Bearer")
 * @property {string} credentials - Authentication token or credentials
 */
export interface WebSocketCredentials {
    scheme: string;
    credentials: string;
}

export interface Attachment {
    path: string;
    encrypted: boolean;
    name: string;
}

// -----------------------
// WebSocket message types
// -----------------------

// Utils
export interface DMEditPayload {
    id: number;
    iv: string;
    ciphertext: string;
    iv2: string;
    wrappedMk: string;
    salt: string;
}

// Requests
export interface DMEditRequest extends WebSocketMessage {
    type: "dmEdit",
    credentials: WebSocketCredentials;
    data: DMEditPayload
}

export interface SendMessageRequest extends WebSocketMessage {
    type: "sendMessage",
    credentials: WebSocketCredentials;
    data: {
        content: string;
        reply_to_id: number | null;
    }
}

// Messages
export interface DMNewWebSocketMessage extends WebSocketMessage {
    type: "dmNew",
    data: DmEnvelope
}

export interface DMEditedWebSocketMessage extends WebSocketMessage {
    type: "dmEdited",
    data: DMEditPayload
}

export interface DMDeletedWebSocketMessage extends WebSocketMessage {
    type: "dmDeleted",
    data: {
        id: number;
    }
}

export interface MessageEditedWebSocketMessage extends WebSocketMessage {
    type: "messageEdited",
    data: Partial<Message> & { id: number }
}

export interface MessageDeletedWebSocketMessage extends WebSocketMessage {
    type: "messageDeleted",
    data: {
        message_id: number;
    }
}

export interface NewMessageWebSocketMessage extends WebSocketMessage {
    type: "newMessage",
    data: Message
}

// Shared types
export type DMWebSocketMessage = DMNewWebSocketMessage | DMEditedWebSocketMessage | DMDeletedWebSocketMessage
export type ChatWebSocketMessage = MessageEditedWebSocketMessage | MessageDeletedWebSocketMessage | NewMessageWebSocketMessage

// -----------
// Encrypted message JSON (plaintext structure before encryption)
// -----------

export type ChatMessageKind = "text"; // Extendable for future kinds

export interface EncryptedTextMessageData {
    content: string;
    files?: Attachment[];
    reply_to_id?: number | null;
}

export interface EncryptedMessageJson {
    type: ChatMessageKind;
    data: EncryptedTextMessageData;
}

// -----------
// React types
// -----------
export interface DialogProps {
    isOpen: boolean;
    onOpenChange: (value: boolean) => void;
}