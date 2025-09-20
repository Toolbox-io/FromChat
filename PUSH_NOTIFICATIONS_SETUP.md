# Push Notifications Setup

This document explains how to set up push notifications for the FromChat messenger.

## Prerequisites

1. **HTTPS Required**: Push notifications only work over HTTPS in production. For development, localhost is allowed.

2. **VAPID Keys**: You need to generate VAPID (Voluntary Application Server Identification) keys for your application.

## Setup Instructions

### 1. Generate VAPID Keys

Run the VAPID key generation script:

```bash
cd backend
python generate_vapid_keys.py
```

This will output your private and public keys. Save these securely.

### 2. Set Environment Variables

Add the VAPID keys to your environment variables:

```bash
# In your .env file or environment
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_PUBLIC_KEY=your_public_key_here
```

### 3. Install Dependencies

Make sure all required dependencies are installed:

```bash
# Backend dependencies
pip install -r backend/requirements.txt

# Frontend dependencies (already included)
npm install
```

### 4. Database Migration

The push notification system will automatically create the required database tables when you start the server.

## How It Works

### Client Side

1. **Permission Request**: When a user logs in, the app requests push notification permission
2. **Service Worker**: A service worker (`/sw.js`) handles incoming push notifications
3. **Subscription**: The client subscribes to push notifications and sends the subscription to the server

### Server Side

1. **Subscription Storage**: User push subscriptions are stored in the database
2. **Message Notifications**: When a public message is sent, all users (except the sender) receive notifications
3. **DM Notifications**: When a DM is sent, the recipient receives a notification
4. **VAPID Authentication**: The server uses VAPID keys to authenticate with push services

## Features

- **Public Chat Notifications**: Notifications for new messages in public chat
- **Direct Message Notifications**: Notifications for new DMs
- **User Profile Integration**: Notifications include sender's profile picture and username
- **Settings Control**: Users can enable/disable push notifications in settings
- **Automatic Cleanup**: Invalid subscriptions are automatically removed

## Testing

1. Start the backend server
2. Open the frontend in a browser (HTTPS required for production)
3. Log in to trigger the permission request
4. Send a message or DM to test notifications

## Troubleshooting

### Common Issues

1. **Permission Denied**: Make sure the user grants notification permission
2. **No Notifications**: Check browser console for errors and ensure HTTPS is used
3. **Invalid Subscription**: The server automatically removes invalid subscriptions

### Browser Support

Push notifications are supported in:
- Chrome/Chromium 42+
- Firefox 44+
- Safari 16+
- Edge 17+

## Security Notes

- VAPID keys should be kept secure and not exposed to clients
- The private key should never be shared or committed to version control
- Use environment variables for all sensitive configuration

## Production Deployment

For production deployment:

1. Generate production VAPID keys
2. Set up HTTPS with a valid SSL certificate
3. Configure your push service endpoint
4. Test thoroughly with real devices

## API Endpoints

- `POST /push/subscribe` - Subscribe to push notifications
- `DELETE /push/unsubscribe` - Unsubscribe from push notifications

## Database Schema

The system creates a `push_subscription` table with:
- `user_id` - Foreign key to user
- `endpoint` - Push service endpoint
- `p256dh_key` - Encryption key
- `auth_key` - Authentication key
- `created_at` - Subscription timestamp
- `updated_at` - Last update timestamp
