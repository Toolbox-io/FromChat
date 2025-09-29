# FromChat Android App

A complete Android Jetpack Compose implementation of the FromChat messaging application with all features from the frontend.

## Features

### ✅ Authentication
- User login and registration
- Secure token-based authentication
- Session persistence
- Automatic login restoration

### ✅ Chat Functionality
- Public chat rooms
- Direct messages (DMs)
- Real-time messaging via WebSocket
- Message history
- Message editing and deletion
- Reply to messages

### ✅ File Sharing
- File upload and download
- Multiple file selection
- File type detection (images, videos, audio, documents)
- File size display
- Encrypted file sharing for DMs

### ✅ End-to-End Encryption
- X25519 key exchange
- AES-GCM encryption
- Key backup and restoration
- Encrypted direct messages
- Encrypted file sharing

### ✅ User Profile Management
- User profile display
- Profile editing
- Online status
- User information
- Profile pictures

### ✅ Settings
- Notification preferences
- Sound and vibration settings
- Dark/light theme
- Language selection
- Auto-download settings
- Image quality settings

### ✅ Push Notifications
- Real-time notifications
- Message notifications
- DM notifications
- Notification channels
- Customizable notification settings

### ✅ UI/UX
- Material Design 3
- Jetpack Compose
- Responsive design
- Smooth animations
- Intuitive navigation
- Tab-based interface

## Architecture

### Data Layer
- **Models**: Type-safe data models with Kotlin serialization
- **API Service**: HTTP client with Ktor for REST API calls
- **WebSocket Service**: Real-time communication
- **Auth Service**: Authentication and session management
- **Chat Service**: Chat operations and message handling
- **File Service**: File operations and management
- **Notification Service**: Push notification handling
- **Settings Service**: User preferences and configuration

### State Management
- **AppState**: Global application state
- **ChatState**: Chat-specific state
- **UserState**: User authentication state
- Reactive state updates with Compose

### UI Layer
- **Screens**: Login, Register, Chat, Profile, Settings
- **Components**: Reusable UI components
- **Navigation**: Navigation between screens
- **Theming**: Material Design 3 theming

## Dependencies

- **Jetpack Compose**: Modern UI toolkit
- **Material Design 3**: Design system
- **Ktor**: HTTP client and WebSocket
- **Kotlin Serialization**: JSON serialization
- **Navigation Compose**: Navigation between screens
- **Coroutines**: Asynchronous programming
- **ViewModel**: State management

## Security Features

- **End-to-End Encryption**: All DMs are encrypted
- **Secure Key Storage**: Keys stored in Android Keystore
- **Token-based Authentication**: JWT tokens for API access
- **Encrypted File Sharing**: Files encrypted before transmission
- **Secure WebSocket**: Encrypted WebSocket connections

## File Structure

```
android/app/src/main/java/ru/FromChat/
├── data/
│   ├── api/           # API service and HTTP client
│   ├── auth/          # Authentication service
│   ├── chat/          # Chat service and messaging
│   ├── files/         # File handling and management
│   ├── models/        # Data models and types
│   ├── notifications/ # Push notification service
│   ├── settings/      # Settings and preferences
│   ├── state/         # Application state management
│   └── websocket/     # WebSocket service
├── services/          # Application services
├── ui/
│   ├── components/    # Reusable UI components
│   ├── screens/      # Screen composables
│   └── Theme.kt      # Material Design theming
└── utils/
    └── crypto/       # Encryption utilities
```

## Getting Started

1. **Clone the repository**
2. **Open in Android Studio**
3. **Sync Gradle files**
4. **Build and run**

## Configuration

### API Configuration
Update the API host in `Constants.kt`:
```kotlin
const val API_HOST = "your-api-host.com"
```

### Build Configuration
The app is configured for:
- **Min SDK**: 24 (Android 7.0)
- **Target SDK**: 36 (Android 14)
- **Compile SDK**: 36

## Permissions

The app requires the following permissions:
- `INTERNET`: Network access
- `POST_NOTIFICATIONS`: Push notifications
- `READ_EXTERNAL_STORAGE`: File access
- `WRITE_EXTERNAL_STORAGE`: File storage
- `VIBRATE`: Notification vibration

## Features Comparison with Frontend

| Feature | Frontend | Android | Status |
|---------|----------|---------|--------|
| Authentication | ✅ | ✅ | Complete |
| Public Chat | ✅ | ✅ | Complete |
| Direct Messages | ✅ | ✅ | Complete |
| File Sharing | ✅ | ✅ | Complete |
| End-to-End Encryption | ✅ | ✅ | Complete |
| Push Notifications | ✅ | ✅ | Complete |
| User Profiles | ✅ | ✅ | Complete |
| Settings | ✅ | ✅ | Complete |
| Real-time Updates | ✅ | ✅ | Complete |
| Message History | ✅ | ✅ | Complete |
| File Encryption | ✅ | ✅ | Complete |
| Key Management | ✅ | ✅ | Complete |

## Testing

The app includes comprehensive testing for:
- Authentication flows
- Chat functionality
- File operations
- Encryption/decryption
- WebSocket connections
- State management

## Performance

- **Optimized UI**: Efficient Compose rendering
- **Background Processing**: Coroutines for async operations
- **Memory Management**: Proper lifecycle management
- **Network Optimization**: Efficient API calls and WebSocket usage

## Security

- **Encrypted Storage**: Sensitive data encrypted
- **Secure Communication**: HTTPS and WSS protocols
- **Key Management**: Secure key generation and storage
- **Authentication**: Secure token-based auth

## Future Enhancements

- Voice messages
- Video calls
- Group chats
- Message reactions
- Advanced file sharing
- Offline support
- Message search
- Custom themes

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
