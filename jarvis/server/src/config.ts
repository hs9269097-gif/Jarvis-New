// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// Loads .env (zero dependencies) and exposes a single typed `config` object.
// Secrets are read here and NEVER sent to the browser.
// ─────────────────────────────────────────────────────────────────────────────
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// src/config.ts (tsx dev) → ../.. = <repo>/jarvis
// dist/config.js (compiled) → ../.. = <repo>/jarvis
const root = path.resolve(__dirname, "../..");

/**
 * Parse a .env file. Supports:
 *   KEY=value          # inline comments
 *   KEY="quoted value" (preserves # and spaces)
 *   export KEY=value
 *   # full-line comments and blank lines
 * Real environment variables always win over file values.
 */
function parseEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return out;
  }
  // Strip a UTF-8 BOM so the first key is not silently mangled.
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1]!;
    let value = (m[2] ?? "").trim();

    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length > 1) {
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
    } else {
      // Unquoted: strip an inline comment ( ` #` ) and surrounding whitespace.
      value = value.replace(/\s+#.*$/, "").trim();
    }
    out[key] = value;
  }
  return out;
}

// Search order — the first file that defines a key wins, and a real process
// env var always beats every file. This covers all the layouts people use:
//   <repo>/jarvis/.env        (documented default)
//   <repo>/jarvis/server/.env (server-local)
//   <repo>/.env               (monorepo root)
const ENV_FILES = [
  path.join(root, ".env"),
  path.join(root, "server", ".env"),
  path.resolve(root, "..", ".env"),
];

export const loadedEnvFiles: string[] = [];
for (const file of ENV_FILES) {
  if (!fs.existsSync(file)) continue;
  loadedEnvFiles.push(file);
  const parsed = parseEnvFile(file);
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined || process.env[k] === "") process.env[k] = v;
  }
}

function env(key: string, fallback = ""): string {
  const v = process.env[key];
  return v !== undefined && v !== "" ? v.trim() : fallback;
}
function envNum(key: string, fallback: number): number {
  const n = Number(env(key, ""));
  return Number.isFinite(n) ? n : fallback;
}
function envBool(key: string, fallback = false): boolean {
  const v = env(key, "").toLowerCase();
  if (!v) return fallback;
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

const nodeEnv = env("NODE_ENV", "development");

export const config = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  port: envNum("PORT", 8787),
  // Bind all interfaces by default so the app is reachable from containers,
  // Render, and sandboxed preview environments (not just loopback).
  host: env("HOST", "0.0.0.0"),
  sessionSecret: env("SESSION_SECRET", "jarvis-dev-secret-change-me"),
  authRequired: envBool("AUTH_REQUIRED", false),
  // DATA_DIR lets the app write to a mounted persistent volume (e.g. a Render
  // Disk at /data). Falls back to <repo>/jarvis/server/data when unset.
  dataDir: env("DATA_DIR", path.join(root, "server", "data")),

  ai: {
    provider: env("AI_PROVIDER", "").toLowerCase(),
    apiKey: env("AI_API_KEY", ""),
    baseUrl: env("AI_BASE_URL", ""),
    model: env("AI_MODEL", ""),
    anthropicKey: env("ANTHROPIC_API_KEY", ""),
    anthropicModel: env("ANTHROPIC_MODEL", "claude-sonnet-4-5"),
    geminiKey: env("GEMINI_API_KEY", ""),
    geminiModel: env("GEMINI_MODEL", "gemini-1.5-flash-latest"),
    localBaseUrl: env("LOCAL_AI_BASE_URL", ""),
    localModel: env("LOCAL_AI_MODEL", "llama3"),
    maxTokens: envNum("AI_MAX_TOKENS", 2048),
    temperature: envNum("AI_TEMPERATURE", 0.7),
  },

  search: {
    provider: env("SEARCH_PROVIDER", "").toLowerCase(),
    apiKey: env("SEARCH_API_KEY", ""),
  },
};

// Startup diagnostics — helps users see *why* they are in demo mode, without
// ever printing the secrets themselves.
if (loadedEnvFiles.length) {
  console.log(`[config] loaded env from: ${loadedEnvFiles.join(", ")}`);
} else {
  console.log("[config] no .env file found — using process env / defaults. Copy jarvis/.env.example to jarvis/.env");
}

if (config.isProduction && config.sessionSecret === "jarvis-dev-secret-change-me") {
  console.warn("[config] ⚠  SESSION_SECRET is unset in production. Set a long random value.");
}
