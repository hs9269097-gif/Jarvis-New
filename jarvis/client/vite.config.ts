import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API server port must stay in sync with the server's PORT env var.
const API_PORT = process.env.PORT ?? "8787";
const API_TARGET = process.env.VITE_API_TARGET ?? `http://127.0.0.1:${API_PORT}`;

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind all interfaces so the dev server is reachable from containers and
    // remote preview environments, not just loopback.
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    // Accept proxied preview hostnames (e.g. *.e2b.app, Codespaces, ngrok).
    // Without this Vite answers "Blocked request. This host is not allowed."
    allowedHosts: true,
    proxy: {
      // The browser is not necessarily on the same machine as the API, so the
      // client always calls a relative /api path and the dev server proxies it.
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        // Server-Sent Events must not be buffered by the proxy.
        ws: true,
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            if (proxyRes.headers["content-type"]?.includes("text/event-stream")) {
              proxyRes.headers["cache-control"] = "no-cache, no-transform";
            }
          });
        },
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: true,
  },
  build: {
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three", "@react-three/fiber", "@react-three/drei"],
          markdown: ["react-markdown", "remark-gfm"],
        },
      },
    },
  },
});
