export type Platform = "win32" | "darwin" | "linux"

export interface ElectronNotifications {
    requestPermission: () => Promise<NotificationPermission>;
    show: (options: {
        title: string;
        body: string;
        icon?: string;
        tag?: string;
    }) => Promise<boolean>;
}

export interface ElectronInterface {
    desktop: true,
    platform: Platform,
    notifications: ElectronNotifications
}

declare global {
    interface Window {
        electronInterface: ElectronInterface
    }
}