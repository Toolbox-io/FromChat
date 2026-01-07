import express from 'express';
import type { Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { resolve } from 'path';

const app = express();
const port = Number(process.env.PORT) || 8301;
const backendHost = process.env.BACKEND_HOST || "http://localhost:8300";
const filePath = process.env.STATIC_FILE_PATH || ".";

// API proxy middleware
app.use('/api', createProxyMiddleware({
    target: backendHost,
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
    ws: true
}));

// WebSockets are handled by the general API proxy above

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
