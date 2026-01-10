# FromChat Protocol

Simple ECDH-based encryption protocol for direct messages.

## Overview

The FromChat Protocol provides end-to-end encryption for direct messages using:
- **X25519** (ECDH) for key exchange
- **HKDF** for key derivation
- **AES-GCM** for symmetric encryption

This module is completely independent and can be used in any JavaScript/TypeScript project.

## Protocol Flow

### Encryption

1. Generate a random message key (mk) - 32 bytes
2. Generate a random salt (wkSalt) - 16 bytes
3. Derive shared secret from ECDH: `ecdhSharedSecret(myPrivateKey, theirPublicKey)`
4. Derive wrapping key: `deriveWrappingKey(sharedSecret, wkSalt, info)` using HKDF
5. Encrypt message with mk using AES-GCM → (iv, ciphertext)
6. Encrypt (wrap) mk with wrapping key using AES-GCM → (iv2, wrappedMk)
7. Send: `{ iv, ciphertext, salt, iv2, wrappedMk }`

### Decryption

1. Derive shared secret from ECDH
2. Derive wrapping key from shared secret using salt from message
3. Decrypt wrappedMk to get mk
4. Decrypt ciphertext with mk

## Usage

```typescript
import { FromChatProtocol } from "@fromchat/protocol";

// Initialize with your private key
const protocol = new FromChatProtocol(privateKey);

// Encrypt a message
const encrypted = await protocol.encryptMessage(recipientPublicKey, "Hello!");

// Decrypt a message
const decrypted = await protocol.decryptMessage(senderPublicKey, encrypted);
```

## API

### `FromChatProtocol`

#### Constructor
- `constructor(privateKey: Uint8Array)` - Initialize protocol with your X25519 private key

#### Methods
- `encryptMessage(recipientPublicKey: Uint8Array, plaintext: string): Promise<EncryptedMessage>` - Encrypt a message
- `decryptMessage(senderPublicKey: Uint8Array, message: EncryptedMessage): Promise<string>` - Decrypt a message

### Types

```typescript
interface EncryptedMessage {
  iv: string;        // Base64 encoded IV for message encryption
  ciphertext: string; // Base64 encoded encrypted message
  salt: string;      // Base64 encoded salt for wrapping key derivation
  iv2: string;       // Base64 encoded IV for message key wrapping
  wrappedMk: string; // Base64 encoded wrapped message key
}
```

## Backup & Key Management

The protocol also includes utilities for backing up and restoring private keys:

```typescript
import { 
  encryptBackupWithPassword, 
  decryptBackupWithPassword,
  encodeBlob,
  decodeBlob 
} from "@fromchat/protocol";

// Create a backup of a private key
const bundle = { version: 1, privateKey: myPrivateKey };
const encrypted = await encryptBackupWithPassword("my-password", bundle);
const backupString = encodeBlob(encrypted); // Store this string

// Restore from backup
const encryptedBlob = decodeBlob(backupString);
const restored = await decryptBackupWithPassword("my-password", encryptedBlob);
```

## Security Notes

- Each message uses a fresh random message key
- The protocol does not provide forward secrecy
- Keys are derived using HKDF with SHA-256
- All encryption uses AES-GCM with 12-byte IVs
- Backup encryption uses PBKDF2 with 210,000 iterations
