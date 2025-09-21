import { app, BrowserWindow, Notification, ipcMain } from 'electron';
import path from "node:path";

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        title: 'Main window',
        minWidth: 800,
        minHeight: 420,
        webPreferences: {
            preload: path.join(import.meta.dirname, "preload.mjs")
        },
        titleBarStyle: "hidden",
        ...(process.platform !== 'darwin' ? { titleBarOverlay: true } : {}),
        trafficLightPosition: {
            x: 16 - 4,
            y: 16 - 4
        },
        titleBarOverlay: process.platform !== "darwin"
    });

    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        mainWindow.loadFile('frontend/build/electron/dist/index.html');
    }

    // Handle notification permission requests
    ipcMain.handle('request-notification-permission', async () => {
        if (Notification.isSupported()) {
            return 'granted';
        }
        return 'denied';
    });

    // Handle showing notifications
    ipcMain.handle('show-notification', async (event, options) => {
        if (Notification.isSupported()) {
            try {
                const notification = new Notification({
                    title: options.title,
                    body: options.body,
                    icon: options.icon,
                    silent: false,
                    urgency: 'normal'
                });

                notification.on('click', () => {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                });

                notification.show();
                return true;
            } catch (error) {
                console.error('Error creating notification:', error);
                return false;
            }
        }
        return false;
    });
});