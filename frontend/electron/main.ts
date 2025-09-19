import { app, BrowserWindow } from 'electron';
import path from "node:path";

app.whenReady().then(() => {
    const win = new BrowserWindow({
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
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        win.loadFile('frontend/build/electron/dist/index.html');
    }
});