import { defineConfig, PluginOption } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";
import autoprefixer from "autoprefixer";
import electron from "vite-plugin-electron/simple";

function hmrAutoAcceptPlugin(): PluginOption {
    const injectionLine = "if(import.meta.hot){import.meta.hot.accept()}";
    const fileRegex = /\.(m?jsx?|tsx?)$/;

    return {
        name: "hmr-auto-accept",
        apply: "serve",
        enforce: "post",
        transform(code, id) {
            if (!fileRegex.test(id)) return null;
            if (id.endsWith(".d.ts")) return null;
            if (id.includes("node_modules")) return null;
            if (id.startsWith("\0") || id.includes("virtual:") || id.includes("/@vite/")) return null;
            if (code.includes("import.meta.hot.accept()")) return null;

            if (!code.endsWith("\n")) {
                code += "\n";
            }
            code += injectionLine;
            return { code: code, map: null };
        },
    };
}

const plugins: PluginOption[] = [
    hmrAutoAcceptPlugin(),
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
    })
]

if (process.env.VITE_ELECTRON) {
    plugins.push(
        electron({
            main: {
                entry: "electron/main.ts",
            },
            preload: {
                input: "frontend/electron/preload.ts"
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
            plugins: [autoprefixer()],
        },
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
        assetsInlineLimit: 0
    }
});