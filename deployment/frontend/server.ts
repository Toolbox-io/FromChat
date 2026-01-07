import express from 'express';
import type { Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { resolve } from 'path';

const app = express();
const port = Number(process.env.PORT) || 8301;
const backendHost = process.env.BACKEND_HOST || "http://localhost:8300";
const filePath = process.env.STATIC_FILE_PATH || ".";

// Direct WebSocket proxy for chat - bypass gateway (must come before general API proxy)
app.use('/api/chat/ws', createProxyMiddleware({
    target: 'http://messaging_service:8305',
    changeOrigin: true,
    pathRewrite: { '^/api/chat/ws': '/messaging/chat/ws' },
    ws: true
}));

// API proxy middleware (exclude WebSocket paths)
app.use('/api', (req, res, next) => {
    // Skip WebSocket upgrade requests - let them be handled by specific proxies
    if (req.headers.upgrade === 'websocket') {
        return next();
    }
    createProxyMiddleware({
        target: backendHost,
        changeOrigin: true,
        pathRewrite: { '^/api': '' },
        ws: true
    })(req, res, next);
});

// Serve static files
app.use(express.static(resolve(filePath)));

// SPA routing - catch all handler for client-side routing
app.use((_req: Request, res: Response) => {
    res.sendFile(resolve(filePath, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Backend host: ${backendHost}`);
    console.log(`Server launched on http://0.0.0.0:${port}`);
});
