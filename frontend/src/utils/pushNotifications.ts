import { API_BASE_URL } from "../core/config";

export interface PushSubscriptionData {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

export interface NotificationPayload {
    title: string;
    body: string;
    icon?: string;
    image?: string;
    tag?: string;
    data?: any;
}

class PushNotificationManager {
    private registration: ServiceWorkerRegistration | null = null;
    private subscription: PushSubscription | null = null;

    async initialize(): Promise<boolean> {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
            console.log("Push messaging is not supported");
            return false;
        }

        try {
            this.registration = await navigator.serviceWorker.register("/sw.js");
            console.log("Service Worker registered successfully");
            return true;
        } catch (error) {
            console.error("Service Worker registration failed:", error);
            return false;
        }
    }

    async requestPermission(): Promise<NotificationPermission> {
        if (!this.registration) {
            throw new Error("Service Worker not initialized");
        }

        const permission = await Notification.requestPermission();
        return permission;
    }

    async subscribe(): Promise<PushSubscription | null> {
        if (!this.registration) {
            throw new Error("Service Worker not initialized");
        }

        try {
            this.subscription = await this.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(
                    "BPFs0EYyE2XqAuY8vQ8B_ZggkJVhf9NmtKqSPtIKqy7lU0yGcM5qfpBz2ESRxNmC_CPbzoLbhKfF8fkKCFUwIjo"
                ).slice().buffer
            });

            console.log("Push subscription successful");
            return this.subscription;
        } catch (error) {
            console.error("Push subscription failed:", error);
            return null;
        }
    }

    async sendSubscriptionToServer(token: string): Promise<boolean> {
        if (!this.subscription) {
            throw new Error("No push subscription available");
        }

        const subscriptionData: PushSubscriptionData = {
            endpoint: this.subscription.endpoint,
            keys: {
                p256dh: this.arrayBufferToBase64(this.subscription.getKey("p256dh")!),
                auth: this.arrayBufferToBase64(this.subscription.getKey("auth")!)
            }
        };

        try {
            const response = await fetch(`${API_BASE_URL}/push/subscribe`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(subscriptionData)
            });

            return response.ok;
        } catch (error) {
            console.error("Failed to send subscription to server:", error);
            return false;
        }
    }

    async unsubscribe(): Promise<boolean> {
        if (!this.subscription) {
            return true;
        }

        try {
            const result = await this.subscription.unsubscribe();
            this.subscription = null;
            return result;
        } catch (error) {
            console.error("Failed to unsubscribe:", error);
            return false;
        }
    }

    private urlBase64ToUint8Array(base64String: string): Uint8Array {
        const padding = "=".repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    getSubscription(): PushSubscription | null {
        return this.subscription;
    }

    isSupported(): boolean {
        return "serviceWorker" in navigator && "PushManager" in window;
    }
}

export const pushNotificationManager = new PushNotificationManager();
