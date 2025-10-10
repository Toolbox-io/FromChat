import { defineConfig, PluginOption } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";
import autoprefixer from "autoprefixer";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";
import path from "path";
import { visualizer } from 'rollup-plugin-visualizer';

const outDir = process.env.VITE_ELECTRON ? "build/electron/dist" : "build/normal/dist";

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
    visualizer({
        filename: `${outDir}/stats.html`,
        open: true,
        gzipSize: true
    })
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
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src")
        }
    },
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
    appType: "spa",
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
        outDir: outDir,
        chunkSizeWarningLimit: 1024
    }
});