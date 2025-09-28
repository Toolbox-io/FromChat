// Import types from the main project
import type {
  User,
  Message,
  UserProfile,
  Attachment,
  DmEnvelope,
  DmFile,
  WebSocketMessage,
  Headers,
  LoginRequest,
  RegisterRequest,
  LoginResponse,
  SendMessageRequest,
  FetchDMResponse,
  DmEncryptedJSON,
  BaseDmEnvelope,
  BackupBlob,
  UploadPublicKeyRequest,
  DialogProps
} from '../../frontend/src/core/types';

// Re-export types from the main project
export type {
  User,
  Message,
  UserProfile,
  Attachment,
  DmEnvelope,
  DmFile,
  WebSocketMessage,
  Headers,
  LoginRequest,
  RegisterRequest,
  LoginResponse,
  SendMessageRequest,
  FetchDMResponse,
  DmEncryptedJSON,
  BaseDmEnvelope,
  BackupBlob,
  UploadPublicKeyRequest,
  DialogProps
};

// Additional types needed for mobile
export interface MessageFile {
  id: number;
  path: string;
  name: string;
  message_id: number;
}

export interface RegisterResponse {
  token: string;
  user: User;
}

export interface EditMessageRequest {
  content: string;
}

export interface FetchMessagesResponse {
  messages: Message[];
}

export interface UserKeyPairMemory {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface MessagePanel {
  type: "public" | "dm";
  chatName: string;
  messages: Message[];
}

export interface DMPanelData {
  recipientId: number;
  recipientUsername: string;
  messages: Message[];
}

export interface PushSubscriptionRequest {
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
}

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
  silent: boolean;
}

// Mobile-specific types
export interface MobileNavigationProps {
  navigation: unknown;
  route: unknown;
}

export interface ScreenProps {
  navigation: unknown;
}

export interface TabBarIconProps {
  focused: boolean;
  color: string;
  size: number;
}