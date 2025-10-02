import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { resolve } from 'path';

const app = express();
const port = process.env.PORT || 3000;
const backendHost = process.env.BACKEND_HOST || "http://localhost:8300";
const filePath = process.env.STATIC_FILE_PATH || ".";

// API proxy middleware
app.use('/api', createProxyMiddleware({
    target: backendHost,
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
    ws: true
}));

// Serve static files
app.use(express.static(resolve(filePath)));

// SPA routing - catch all handler for client-side routing
app.use((_req, res) => {
    res.sendFile(resolve(filePath, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server launched on http://localhost:${port}`);
});
