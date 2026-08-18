import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { initServer, router } from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const clientDist = path.join(projectRoot, "client", "dist");
const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());

app.use("/api", router);

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: false }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use("/api/*", (_req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const err = error as Error & { status?: number; type?: string };
  const status = err.status === 413 || err.type === "entity.too.large" ? 413 : 500;
  console.error("[server]", err.message || err);
  res.status(status).json({ error: status === 413 ? "Request is too large" : "Internal server error" });
});

initServer();

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`[server] JARVIS listening on http://0.0.0.0:${config.port}`);
});

function shutdown(signal: string) {
  console.log(`[server] ${signal} received; shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
