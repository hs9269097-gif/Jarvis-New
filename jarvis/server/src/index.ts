// ─────────────────────────────────────────────────────────────────────────────
// JARVIS SERVER ENTRY
// Express app: REST + SSE APIs, static serving of the production client build,
// CORS for dev, and the initialization of seeds + real-time telemetry.
// ─────────────────────────────────────────────────────────────────────────────
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { router, initServer } from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "20mb" }));

// Global error + request logging
app.use((req, _res, next) => {
  if (req.path.startsWith("/api")) console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use("/api", router);

// Serve production client build if present
const clientDist = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

// Central error handler — never silently fail
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[server] error:", err.message);
  if (!res.headersSent) res.status(500).json({ error: "JARVIS could not complete this operation.", detail: err.message });
});

initServer();

app.listen(config.port, "0.0.0.0", () => {
  console.log(`\n  ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗`);
  console.log(`  ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝`);
  console.log(`  ██║███████║██████╔╝██║   ██║██║███████╗`);
  console.log(`  ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║`);
  console.log(`  ██║██║  ██║██║  ██║ ╚████╔╝ ██║███████║`);
  console.log(`  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝`);
  console.log(`\n  JARVIS command center online — http://localhost:${config.port}`);
  console.log(`  AI provider: ${process.env.AI_PROVIDER ?? "demo"}  |  auth required: ${config.authRequired}`);
  console.log(`  Demo mode: ${!process.env.AI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY}\n`);
});
