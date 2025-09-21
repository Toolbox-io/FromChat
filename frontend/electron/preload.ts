import { contextBridge, ipcRenderer } from "electron";
import type { ElectronInterface, Platform } from "../electron";

const electronInterface: ElectronInterface = {
    desktop: true,
    platform: process.platform as Platform,
    notifications: {
        requestPermission: () => ipcRenderer.invoke('request-notification-permission'),
        show: (options: any) => ipcRenderer.invoke('show-notification', options)
    }
}

contextBridge.exposeInMainWorld("electronInterface", electronInterface);