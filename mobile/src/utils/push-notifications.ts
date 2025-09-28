import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../core/config';
import { getAuthHeaders } from '../auth/api';
import type { WebSocketMessage } from '../core/types';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

let isInitialized = false;

/**
 * Show a message notification
 */
async function showMessageNotification(data: any): Promise<void> {
    await Notifications.scheduleNotificationAsync({
        content: {
            title: data.username || 'New Message',
            body: data.content || 'You have a new message',
            data: data,
        },
        trigger: null,
    });
}

/**
 * Handle WebSocket messages for notifications
 */
async function handleWebSocketMessage(response: WebSocketMessage<any>): Promise<void> {
    if (response.type === "new_message" && response.data) {
        await showMessageNotification(response.data);
    }
}

/**
 * Subscribe to web push notifications
 */
async function subscribeToWebPush(): Promise<void> {
    try {
        const token = await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig?.extra?.eas?.projectId,
        });

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        console.log('Push token:', token.data);
    } catch (error) {
        console.error('Failed to get push token:', error);
    }
}

/**
 * Initialize push notifications
 */
export async function initialize(): Promise<boolean> {
    if (isInitialized) {
        return true;
    }

    try {
        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            
            if (finalStatus !== 'granted') {
                console.log('Failed to get push token for push notification!');
                return false;
            }
            
            await subscribeToWebPush();
            isInitialized = true;
            return true;
        } else {
            console.log('Must use physical device for Push Notifications');
            return false;
        }
    } catch (error) {
        console.error('Failed to initialize notification service:', error);
        return false;
    }
}

/**
 * Subscribe to push notifications with server
 */
export async function subscribe(token: string): Promise<boolean> {
    if (!isInitialized) {
        return false;
    }

    try {
        const pushToken = await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig?.extra?.eas?.projectId,
        });

        const headers = getAuthHeaders(token, true);
        const response = await fetch(`${API_BASE_URL}/push/subscribe`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                endpoint: pushToken.data,
                p256dh_key: 'dummy-key', // Simplified for mobile
                auth_key: 'dummy-auth', // Simplified for mobile
            }),
        });

        return response.ok;
    } catch (error) {
        console.error('Failed to subscribe to push notifications:', error);
        return false;
    }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribe(): Promise<boolean> {
    try {
        // Implementation for unsubscribing
        return true;
    } catch (error) {
        console.error('Failed to unsubscribe from push notifications:', error);
        return false;
    }
}

/**
 * Check if push notifications are supported
 */
export function isSupported(): boolean {
    return Device.isDevice;
}

/**
 * Start electron receiver (not applicable for mobile)
 */
export async function startElectronReceiver(): Promise<void> {
    // Not applicable for mobile
}

/**
 * Stop electron receiver (not applicable for mobile)
 */
export async function stopElectronReceiver(): Promise<void> {
    // Not applicable for mobile
}