import { contextBridge, ipcRenderer } from "electron";
import type { ElectronInterface, Platform } from "../electron";

contextBridge.exposeInMainWorld("electronInterface", {
    desktop: true,
    platform: process.platform as Platform,
    notifications: {
        requestPermission: () => ipcRenderer.invoke('request-notification-permission'),
        show: (options) => ipcRenderer.invoke('show-notification', options)
    }
} satisfies ElectronInterface);