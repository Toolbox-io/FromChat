import { app, BrowserWindow } from 'electron';
import path from "node:path";

app.whenReady().then(() => {
    const win = new BrowserWindow({
        title: 'Main window',
        minWidth: 650,
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
    })

    // You can use `process.env.VITE_DEV_SERVER_URL` when the vite command is called `serve`
    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL)
    } else {
        // Load your file
        win.loadFile('dist/index.html');
    }
});