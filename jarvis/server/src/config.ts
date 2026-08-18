import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function env(key: string, fallback = ""): string {
  const v = process.env[key];
  return v ? v : fallback;
}

// Load local server configuration without adding a runtime dependency.
// Real process environment variables always win over values in either file.
// src/config.ts → ../../ = project root ; dist/config.js → ../../ = project root
const root = path.resolve(__dirname, "../..");
const envFiles = [path.join(root, ".env"), path.join(root, "server", ".env")];
for (const envFile of envFiles) {
  if (!fs.existsSync(envFile)) continue;
  const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export const config = {
  port: Number(env("PORT", "8787")),
  sessionSecret: env("SESSION_SECRET", "jarvis-dev-secret-change-me"),
  authRequired: env("AUTH_REQUIRED", "false") === "true",
  // DATA_DIR lets the app write to a mounted persistent volume (e.g. Render
  // Disk at /data). Falls back to <repo>/server/data when unset.
  dataDir: env("DATA_DIR", path.join(root, "server", "data")),

  ai: {
    // Empty means auto-detect the first configured real provider.
    provider: env("AI_PROVIDER", ""),
    apiKey: env("AI_API_KEY", ""),
    baseUrl: env("AI_BASE_URL", ""),
    model: env("AI_MODEL", ""),
    anthropicKey: env("ANTHROPIC_API_KEY", ""),
    geminiKey: env("GEMINI_API_KEY", ""),
    localBaseUrl: env("LOCAL_AI_BASE_URL", ""),
    localModel: env("LOCAL_AI_MODEL", ""),
  },

  search: {
    provider: env("SEARCH_PROVIDER", ""),
    apiKey: env("SEARCH_API_KEY", ""),
  },
};
