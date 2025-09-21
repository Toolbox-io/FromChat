import { defineConfig, PluginOption } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";
import autoprefixer from "autoprefixer";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const serviceWorkerPath = resolve(__dirname, "src/service-worker/service-worker.ts");

const plugins: PluginOption[] = [
    react(),
    createHtmlPlugin({
        minify: {
            collapseWhitespace: true,
            removeComments: true,
            removeRedundantAttributes: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            useShortDoctype: true,
            minifyCSS: true,
            minifyJS: true
        }
    }),
    {
        name: 'service-worker-redirect',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (req.url === '/assets/serviceWorker.js') {
                    try {
                        const traspiled = await server.transformRequest(serviceWorkerPath);

                        res.writeHead(200, {
                            'Content-Type': "application/javascript"
                        });
                        res.end(traspiled!.code);
                    } catch (e) {
                        try {
                            res.writeHead(500);
                            res.end();
                        } catch (e) {}
                    }
                } else {
                    next();
                }
            });
        }
      }
]

if (process.env.VITE_ELECTRON) {
    plugins.push(
        electron({
            main: {
                entry: "electron/main.ts",
                vite: {
                    build: {
                        outDir: "build/electron/core"
                    }
                }
            },
            preload: {
                input: "frontend/electron/preload.ts",
                vite: {
                    build: {
                        outDir: "build/electron/core"
                    }
                }
            },
            renderer: {},
        })
    );
}

export default defineConfig({
    plugins: plugins,
    server: {
        host: '0.0.0.0',
        port: 8301,
        strictPort: true,
        proxy: {
            "/api": {
                target: "http://127.0.0.1:8300/",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ""),
                ws: true
            }
        },
        allowedHosts: ["beta.fromchat.ru"]
    },
    appType: "mpa",
    css: {
        postcss: {
            plugins: [autoprefixer()]
        }
    },
    build: {
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true
            },
            format: {
                comments: false
            }
        },
        cssMinify: true,
        assetsInlineLimit: 0,
        outDir: process.env.VITE_ELECTRON ? "build/electron/dist" : "build/normal/dist",
        rollupOptions: {
            input: {
                main: resolve(__dirname, "index.html"),
                serviceWorker: serviceWorkerPath
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    // Проверяем имя чанка
                    if (chunkInfo.name === 'serviceWorker') {
                        return 'assets/serviceWorker.js'; // Указываем фиксированное имя для этого скрипта
                    }
                    // Для остальных файлов используем стандартное именование с хэшем
                    return 'assets/[name]-[hash].js';
                }
            }
        }
    }
});