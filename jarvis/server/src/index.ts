// ─────────────────────────────────────────────────────────────────────────────
// JARVIS SERVER — application entrypoint
// Express app: security headers, JSON body parsing, /api/* router, static
// serving of the built client (SPA fallback), and a central error handler.
// ─────────────────────────────────────────────────────────────────────────────
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { config } from "./config.js";
import { router, initServer } from "./routes.js";
import { providerStatus } from "./ai/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// src/index.ts (tsx dev) and dist/index.js (compiled) are both one level below
// the server root, so ../ resolves to <repo>/jarvis/server in each case.
const serverRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(serverRoot, "..");
const clientDist = path.join(projectRoot, "client", "dist");

const app = express();

// Behind Render/nginx/Cloudflare: trust the proxy so req.ip and secure cookies
// resolve correctly from X-Forwarded-* headers.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// ── Security headers ─────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("Permissions-Policy", "geolocation=(), camera=(), payment=()");
  next();
});

// ── Parsing ──────────────────────────────────────────────────────────────────
// 16 MB ceiling: base64-encoded uploads inflate ~33 %, and routes cap files at 12 MB.
app.use(express.json({ limit: "16mb" }));
app.use(express.urlencoded({ extended: true, limit: "16mb" }));
app.use(cookieParser());

// Same-origin in production (server serves the client). In dev the Vite server
// proxies /api, so CORS with credentials is only needed for direct calls.
app.use(
  cors({
    origin: (origin, cb) => cb(null, origin ?? true),
    credentials: true,
  }),
);

// ── Request logging (concise, dev-friendly) ──────────────────────────────────
if (config.nodeEnv !== "production") {
  app.use((req, res, next) => {
    const started = Date.now();
    res.on("finish", () => {
      if (!req.path.startsWith("/api")) return;
      if (req.path === "/api/system/metrics") return; // too chatty
      console.log(`[api] ${req.method} ${req.path} → ${res.statusCode} (${Date.now() - started}ms)`);
    });
    next();
  });
}

// ── API ──────────────────────────────────────────────────────────────────────
app.use("/api", router);

// Unknown API route → JSON 404 (never fall through to the SPA shell)
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Unknown API endpoint" });
});

// ── Static client + SPA fallback ─────────────────────────────────────────────
const hasClientBuild = fs.existsSync(path.join(clientDist, "index.html"));

if (hasClientBuild) {
  app.use(
    express.static(clientDist, {
      index: false,
      setHeaders: (res, filePath) => {
        // Hashed asset filenames can be cached hard; the HTML shell cannot.
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );
  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(clientDist, "index.html"));
  });
} else {
  app.get("*", (_req, res) => {
    res
      .status(200)
      .type("html")
      .send(
        `<!doctype html><html><head><meta charset="utf-8"><title>JARVIS — API online</title>
         <style>body{background:#04070d;color:#e6f1ff;font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;text-align:center}
         code{background:rgba(34,211,238,.12);color:#7ff3ff;padding:2px 8px;border-radius:6px}</style></head>
         <body><div><h1>JARVIS API is online</h1>
         <p>The client has not been built yet.</p>
         <p>Run <code>npm run build</code> to serve the UI from this origin,<br/>
         or <code>npm run dev</code> and open the Vite server on port 5173.</p></div></body></html>`,
      );
  });
}

// ── Central error handler ────────────────────────────────────────────────────
// Errors are always surfaced as JSON for /api and never silently swallowed.
app.use((err: Error & { status?: number; type?: string }, req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? (err.type === "entity.too.large" ? 413 : 500);
  console.error(`[error] ${req.method} ${req.path}:`, err.message);
  if (res.headersSent) return;
  res.status(status).json({
    error: status === 500 ? "Internal server error" : err.message,
    ...(config.nodeEnv !== "production" ? { detail: err.message } : {}),
  });
});

// ── Boot ─────────────────────────────────────────────────────────────────────
initServer();

const server = app.listen(config.port, config.host, () => {
  const status = providerStatus();
  console.log("");
  console.log("  ╭──────────────────────────────────────────────╮");
  console.log("  │  J A R V I S   ·   COMMAND CENTER ONLINE     │");
  console.log("  ╰──────────────────────────────────────────────╯");
  console.log(`  Listening   http://${config.host}:${config.port}`);
  console.log(`  AI provider ${status.activeLabel} (${status.active})${status.demo ? " — DEMO MODE" : ""}`);
  console.log(`  Client      ${hasClientBuild ? "built — served from this origin" : "not built (run: npm run build)"}`);
  console.log(`  Data dir    ${config.dataDir}`);
  console.log(`  Auth        ${config.authRequired ? "required" : "open (guest session)"}`);
  if (status.demo) {
    console.log("");
    console.log("  ⚠  No AI provider key detected — running the demo engine.");
    console.log("     Add ANTHROPIC_API_KEY (or another provider key) to jarvis/.env");
    console.log("     Looked for env files in: jarvis/.env, jarvis/server/.env, <repo>/.env");
  } else {
    console.log("  Demo mode  disabled — real provider in use, no simulated replies");
  }
  console.log("");
});

// Keep SSE connections from being killed by the default 2-minute header timeout.
server.headersTimeout = 0;
server.requestTimeout = 0;

// ── Graceful shutdown ────────────────────────────────────────────────────────
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[jarvis] ${signal} received — shutting down…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("[jarvis] unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[jarvis] uncaught exception:", err);
});

export { app, server };
