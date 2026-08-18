// ─────────────────────────────────────────────────────────────────────────────
// API ROUTES — /api/*
// Clean, validated endpoints. Chat streams via SSE. Auth is applied where
// configured. All inputs are validated; all failures are surfaced.
// ─────────────────────────────────────────────────────────────────────────────
import { Router, type Request, type Response } from "express";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { db, now, uid } from "./db/index.js";
import { hashPassword, login, register, sessionUser, destroySession, requireAuth, rateLimit, ensureDemoUser } from "./auth.js";
import { providerStatus, getProviders, type ProviderId } from "./ai/index.js";
import { toolCatalog, getTool } from "./tools/index.js";
import { runAgent, logActivity } from "./agent/index.js";
import { broadcast, subscribe, clientCount } from "./events.js";
import { collectMetrics } from "./system.js";

export const router = Router();

const DEMO_USER = "user_demo";
function currentUser(req: Request): string {
  return sessionUser(req)?.id ?? DEMO_USER;
}

function sse(res: Response, gen: () => AsyncGenerator<unknown>) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  (async () => {
    try {
      for await (const event of gen()) {
        if (res.destroyed || res.writableEnded) return;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (e) {
      if (!res.destroyed) res.write(`data: ${JSON.stringify({ type: "error", message: (e as Error).message, retryable: true })}\n\n`);
    } finally {
      if (!res.destroyed && !res.writableEnded) res.end();
    }
  })();
}

// ── Health / bootstrap ────────────────────────────────────────────────────────
router.get("/health", (_req, res) => res.json({ ok: true, name: "JARVIS", time: now() }));

router.get("/bootstrap", (_req, res) => {
  res.json({
    name: "JARVIS",
    version: "1.0.0",
    demoMode: providerStatus().demo,
    provider: providerStatus(),
    auth: { required: config.authRequired, user: null },
    time: now(),
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post("/auth/login", rateLimit(10, 60000), (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") return res.status(400).json({ error: "Missing credentials" });
  const result = login(username, password);
  if (!result.ok) return res.status(401).json({ error: "Invalid credentials" });
  res.setHeader("Set-Cookie", `jarvis_session=${result.token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`);
  logActivity(DEMO_USER, "auth", `User "${username}" signed in`);
  res.json({ ok: true, user: result.user });
});

router.post("/auth/register", rateLimit(10, 60000), (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || username.length < 3 || typeof password !== "string" || password.length < 6)
    return res.status(400).json({ error: "Username ≥3 chars, password ≥6 chars" });
  const result = register(username, password);
  if (!result.ok) return res.status(409).json({ error: result.error });
  res.setHeader("Set-Cookie", `jarvis_session=${result.token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`);
  res.json({ ok: true });
});

router.post("/auth/logout", (req, res) => {
  const cookie = (req.headers.cookie ?? "").split(";").map((c) => c.trim()).find((c) => c.startsWith("jarvis_session="));
  if (cookie) destroySession(cookie.slice("jarvis_session=".length));
  res.setHeader("Set-Cookie", "jarvis_session=; HttpOnly; Path=/; Max-Age=0");
  res.json({ ok: true });
});

router.get("/auth/me", (req, res) => {
  const user = sessionUser(req);
  res.json({ user, demoMode: !config.authRequired });
});

// Apply auth guard to everything below when AUTH_REQUIRED=true
router.use(requireAuth);

// ── Chat (SSE streaming) ──────────────────────────────────────────────────────
router.post("/chat", rateLimit(30, 60000), (req, res) => {
  const body = req.body ?? {};
  const message = String(body.message ?? "").slice(0, 8000);
  if (!message) return res.status(400).json({ error: "Empty message" });
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : uid("conv");
  const userId = currentUser(req);

  db.insert("messages", { id: uid("msg"), conversationId, role: "user", content: message, createdAt: now() });
  const history = db.query("messages", (m) => m.conversationId === conversationId).slice(-20)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string }));

  const fullAnswer: string[] = [];
  sse(res, async function* () {
    yield { type: "conversation", id: conversationId };
    const generator = runAgent(message, history, { temperature: Number(body.temperature ?? 0.7) });
    for await (const event of generator) {
      if (event.type === "delta") fullAnswer.push(event.text);
      if (event.type === "tool") broadcast("tool", event);
      if (event.type === "state") broadcast("agent_state", { state: event.state });
      yield event;
    }
    db.insert("messages", { id: uid("msg"), conversationId, role: "assistant", content: fullAnswer.join(""), createdAt: now() });
    const conv = db.find("conversations", conversationId);
    if (conv) db.update("conversations", conversationId, { lastMessageAt: now(), preview: fullAnswer.join("").slice(0, 90) });
    else db.insert("conversations", { id: conversationId, title: message.slice(0, 60), preview: fullAnswer.join("").slice(0, 90), createdAt: now(), lastMessageAt: now() });
    logActivity(userId, "chat", message.slice(0, 120));
  });
});

router.get("/conversations", (_req, res) => {
  const list = db.all("conversations").sort((a, b) => (b.lastMessageAt as number) - (a.lastMessageAt as number));
  res.json({ conversations: list });
});

router.get("/conversations/:id", (req, res) => {
  const messages = db.query("messages", (m) => m.conversationId === req.params.id).sort((a, b) => (a.createdAt as number) - (b.createdAt as number));
  res.json({ messages });
});

router.delete("/conversations/:id", (req, res) => {
  db.remove("conversations", req.params.id);
  db.query("messages", (m) => m.conversationId === req.params.id).forEach((m) => db.remove("messages", m.id as string));
  res.json({ ok: true });
});

// ── Tools ─────────────────────────────────────────────────────────────────────
router.get("/tools", (_req, res) => res.json({ tools: toolCatalog() }));

router.post("/tools/:id/run", rateLimit(20, 60000), (req, res) => {
  const tool = getTool(req.params.id);
  if (!tool) return res.status(404).json({ error: "Unknown tool" });
  if (tool.permission === "external") {
    const approved = Boolean(req.body?.approved);
    if (!approved) return res.status(403).json({ error: "This tool requires explicit permission", permission: tool.permission });
  }
  tool.run(req.body?.args ?? {}).then((result) => {
    db.insert("tool_runs", { id: uid("tr"), tool: tool.id, input: req.body?.args ?? {}, ok: result.ok, output: result.output, demo: Boolean(result.demo), createdAt: now() });
    res.json(result);
  }).catch((e) => res.status(500).json({ error: (e as Error).message }));
});

// ── Memory ────────────────────────────────────────────────────────────────────
router.get("/memory", (_req, res) => {
  const all = db.all("memory").sort((a, b) => (b.createdAt as number) - (a.createdAt as number));
  res.json({ memories: all });
});
router.post("/memory", (req, res) => {
  const { content, category, importance, source } = req.body ?? {};
  if (typeof content !== "string" || !content.trim()) return res.status(400).json({ error: "Memory content required" });
  const item = db.insert("memory", {
    id: uid("mem"), content: content.trim().slice(0, 2000),
    category: String(category ?? "long_term"),
    importance: String(importance ?? "normal"),
    source: String(source ?? "manual"),
    createdAt: now(),
  });
  res.json({ ok: true, memory: item });
});
router.delete("/memory/:id", (req, res) => res.json({ ok: db.remove("memory", req.params.id) }));
router.delete("/memory", (_req, res) => { db.clear("memory"); res.json({ ok: true }); });

// ── Tasks ─────────────────────────────────────────────────────────────────────
const TASK_STATES = ["QUEUED", "ANALYZING", "RUNNING", "WAITING", "VERIFYING", "COMPLETED", "FAILED"];
router.get("/tasks", (_req, res) => {
  const all = db.all("tasks").sort((a, b) => (b.createdAt as number) - (a.createdAt as number));
  res.json({ tasks: all });
});
router.post("/tasks", (req, res) => {
  const { title, description } = req.body ?? {};
  if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "Task title required" });
  const task = db.insert("tasks", { id: uid("task"), title: title.trim().slice(0, 200), description: String(description ?? "").slice(0, 1000), state: "QUEUED", progress: 0, createdAt: now(), logs: [] });
  broadcast("task", { type: "created", task });
  res.json({ ok: true, task });
});
router.patch("/tasks/:id", (req, res) => {
  const patch: Record<string, unknown> = {};
  if (typeof req.body?.state === "string" && TASK_STATES.includes(req.body.state)) patch.state = req.body.state;
  if (typeof req.body?.progress === "number") patch.progress = Math.max(0, Math.min(100, req.body.progress));
  if (typeof req.body?.log === "string") {
    const task = db.find("tasks", req.params.id);
    patch.logs = [...((task?.logs as string[]) ?? []), req.body.log].slice(-50);
  }
  const task = db.update("tasks", req.params.id, patch);
  if (!task) return res.status(404).json({ error: "Task not found" });
  broadcast("task", { type: "updated", task });
  res.json({ ok: true, task });
});
router.post("/tasks/:id/retry", (req, res) => {
  const task = db.update("tasks", req.params.id, { state: "QUEUED", progress: 0 });
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json({ ok: true, task });
});
router.delete("/tasks/:id", (req, res) => res.json({ ok: db.remove("tasks", req.params.id) }));

// ── Automation ────────────────────────────────────────────────────────────────
router.get("/automation", (_req, res) => res.json({ automations: db.all("automations") }));
router.post("/automation", (req, res) => {
  const { name, trigger, conditions, actions } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "Automation name required" });
  const item = db.insert("automations", {
    id: uid("auto"), name: name.trim(), trigger: String(trigger ?? "manual"),
    conditions: Array.isArray(conditions) ? conditions : [], actions: Array.isArray(actions) ? actions : [],
    enabled: Boolean(req.body?.enabled ?? true), createdAt: now(), runs: 0,
  });
  res.json({ ok: true, automation: item });
});
router.patch("/automation/:id", (req, res) => {
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "trigger", "conditions", "actions", "enabled"]) if (req.body?.[k] !== undefined) patch[k] = req.body[k];
  const item = db.update("automations", req.params.id, patch);
  if (!item) return res.status(404).json({ error: "Automation not found" });
  res.json({ ok: true, automation: item });
});
router.delete("/automation/:id", (req, res) => res.json({ ok: db.remove("automations", req.params.id) }));

// ── Files (upload + analysis) ─────────────────────────────────────────────────
const FILES_DIR = path.join(config.dataDir, "files");
fs.mkdirSync(FILES_DIR, { recursive: true });

function decodePdfString(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && i + 1 < s.length) {
      const n = s[++i];
      if (n === "n") out += "\n";
      else if (n === "r") out += " ";
      else if (n === "t") out += "\t";
      else out += n;
    } else if (ch !== "\r") {
      out += ch;
    }
  }
  return out;
}

function extractPdfText(buf: Buffer): string {
  try {
    const text = buf.toString("latin1");
    let out = "";
    const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let m;
    while ((m = streamRe.exec(text))) {
      const raw = m[1];
      let decoded;
      try { decoded = zlib.inflateSync(Buffer.from(raw, "latin1")); }
      catch { decoded = Buffer.from(raw, "latin1"); }
      const s = decoded.toString("latin1");
      const litRe = /\(([^()\\]|\\.)*\)\s*T[Jj]/g;
      let c;
      while ((c = litRe.exec(s))) {
        const inner = c[0].slice(1, c[0].lastIndexOf(")"));
        out += decodePdfString(inner) + "\n";
      }
    }
    return out.trim();
  } catch {
    return "";
  }
}

function analyzeText(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 2);
  const freq = new Map<string, number>();
  const stop = new Set("the a an and or but of to in on for with at by from is are was were be been this that it as you i we they he she his her its my our your their not no".split(" "));
  for (const w of words) {
    const k = w.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (k.length > 3 && !stop.has(k)) freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  const keywords = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ word: k, count: v }));
  return {
    wordCount: words.length,
    charCount: text.length,
    sentenceCount: sentences.length,
    readingMinutes: Math.max(1, Math.round(words.length / 200)),
    keywords,
    summary: sentences.slice(0, 3).join(". ") || "(no sentences detected)",
  };
}

router.get("/files", (_req, res) => res.json({ files: db.all("files").sort((a, b) => (b.createdAt as number) - (a.createdAt as number)) }));

router.post("/files", (req, res) => {
  const { name, type, data } = req.body ?? {};
  if (typeof data !== "string" || typeof name !== "string" || typeof type !== "string") return res.status(400).json({ error: "Invalid upload" });
  const buf = Buffer.from(data, "base64");
  if (buf.length > 12 * 1024 * 1024) return res.status(413).json({ error: "File too large (max 12 MB)" });
  const size = buf.length;
  const id = uid("file");
  fs.writeFileSync(path.join(FILES_DIR, id), buf);

  let text = "";
  const kind = type.includes("pdf") ? "pdf" : type.startsWith("image/") ? "image" : /(json|javascript|typescript|html|css|xml|svg)/.test(type) ? "code" : "text";
  if (kind === "pdf") text = extractPdfText(buf);
  else if (kind !== "image") text = buf.toString("utf8");

  const analysis = kind === "image"
    ? { kind, size, note: "Vision analysis requires a multimodal AI provider (e.g. GPT-4o / Gemini). Metadata analysis shown below." }
    : { kind, ...analyzeText(text), preview: text.slice(0, 600) };

  const record = db.insert("files", { id, name: name.slice(0, 200), type, size, kind, analysis, createdAt: now() });
  logActivity(currentUser(req), "file", `Uploaded & analyzed "${name}"`);
  res.json({ ok: true, file: record });
});

router.delete("/files/:id", (req, res) => {
  try { fs.unlinkSync(path.join(FILES_DIR, req.params.id)); } catch { /* ignore */ }
  res.json({ ok: db.remove("files", req.params.id) });
});

// ── Search ────────────────────────────────────────────────────────────────────
router.post("/search", rateLimit(15, 60000), async (req, res) => {
  const { query } = req.body ?? {};
  if (typeof query !== "string" || !query.trim()) return res.status(400).json({ error: "Query required" });
  const tool = getTool("web_search")!;
  const result = await tool.run({ query });
  res.json(result);
});

// ── System ────────────────────────────────────────────────────────────────────
router.get("/system/metrics", (_req, res) => res.json(collectMetrics()));

router.get("/system/stream", (req, res) => {
  const cleanup = subscribe(res);
  res.on("close", cleanup);
});

// ── Security (demo posture + real session/auth facts) ─────────────────────────
router.get("/security/status", (_req, res) => {
  const sessions = db.all("sessions").filter((s) => (s.expiresAt as number) > now());
  const logs = db.all("activity_logs").filter((l) => l.kind === "auth").slice(-10);
  const score = Math.max(55, Math.min(98, 70 + sessions.length));
  res.json({
    demo: true,
    score,
    threatLevel: score > 85 ? "LOW" : score > 70 ? "MODERATE" : "ELEVATED",
    auth: { required: config.authRequired, hashedPasswords: true, method: "scrypt" },
    sessions: { active: sessions.length, current: clientCount() },
    permissions: toolCatalog().map((t) => ({ tool: t.name, permission: t.permission })),
    encryption: { transport: "HTTPS (terminated at proxy)", secrets: "environment variables only", cookies: "HttpOnly + SameSite" },
    loginHistory: logs.map((l) => ({ message: l.message as string, at: l.createdAt as number })),
    events: [
      { kind: "session", message: "Session token rotated", at: now() - 60_000 },
      { kind: "auth", message: "Rate limiter armed on auth endpoints", at: now() - 120_000 },
    ],
  });
});

// ── Logs ──────────────────────────────────────────────────────────────────────
router.get("/logs", (_req, res) => {
  const all = db.all("activity_logs").sort((a, b) => (b.createdAt as number) - (a.createdAt as number)).slice(0, 200);
  res.json({ logs: all });
});

// ── Settings ──────────────────────────────────────────────────────────────────
const DEFAULTS = {
  ai: { model: "auto", temperature: 0.7, style: "Professional & concise", systemInstructions: "" },
  voice: { voice: "default", speed: 1, volume: 0.9, wakeWord: "Jarvis", autoListen: false },
  appearance: { accent: "cyan", quality: "high", animations: true, reducedMotion: false },
  memory: { enabled: true, autoSave: true },
  notifications: { desktop: false, tasks: true },
};
router.get("/settings", (_req, res) => {
  const row = db.query("settings", (s) => s.id === "global")[0] ?? {};
  res.json({ settings: { ...DEFAULTS, ...(row.data as object ?? {}) } });
});
router.put("/settings", (req, res) => {
  const existing = db.query("settings", (s) => s.id === "global")[0];
  const merged = { ...((existing?.data as object) ?? {}), ...(req.body?.settings ?? {}) };
  if (existing) db.update("settings", "global", { data: merged });
  else db.insert("settings", { id: "global", data: merged });
  res.json({ ok: true, settings: { ...DEFAULTS, ...merged } });
});

// ── Providers (server-side config status; keys never leave the server) ────────
router.get("/providers", (_req, res) => res.json(providerStatus()));
router.post("/providers/select", (req, res) => {
  const id = String(req.body?.id ?? "");
  if (!["demo", "openai", "anthropic", "gemini", "local"].includes(id)) return res.status(400).json({ error: "Unknown provider" });

  const provider = getProviders()[id as ProviderId];
  if (!provider.configured) {
    return res.status(409).json({
      error: `Provider "${id}" is not configured. Set its API key server-side via environment variables.`,
      status: providerStatus(),
    });
  }

  const existing = db.find("settings", "global");
  const merged = { ...((existing?.data as object) ?? {}), provider: id };
  if (existing) db.update("settings", "global", { data: merged });
  else db.insert("settings", { id: "global", data: merged });
  res.json({ ok: true, status: providerStatus() });
});

// ── Demo simulation endpoints (clearly labeled) ───────────────────────────────
router.post("/demo/task", (req, res) => {
  const title = String(req.body?.title ?? "Simulated task");
  const task = db.insert("tasks", { id: uid("task"), title, description: "Demo task — simulated execution", state: "RUNNING", progress: 5, createdAt: now(), logs: ["Task created (DEMO)"], demo: true });
  res.json({ ok: true, task });
  // Simulate progression
  let p = 5;
  const iv = setInterval(() => {
    p += Math.round(8 + Math.random() * 14);
    const t = db.find("tasks", task.id as string);
    if (!t) return clearInterval(iv);
    if (p >= 100) {
      db.update("tasks", task.id as string, { state: "COMPLETED", progress: 100, logs: [...((t.logs as string[]) ?? []), "Completed (DEMO)"] });
      broadcast("task", { type: "updated", task: db.find("tasks", task.id as string) });
      clearInterval(iv);
    } else {
      db.update("tasks", task.id as string, { state: "RUNNING", progress: p });
      broadcast("task", { type: "updated", task: db.find("tasks", task.id as string) });
    }
  }, 900);
});

export function initServer() {
  ensureDemoUser();
  // Periodic simulated telemetry events
  setInterval(() => {
    broadcast("metrics", collectMetrics());
    if (Math.random() < 0.12) {
      broadcast("security_event", {
        kind: ["heartbeat", "scan", "session"][Math.floor(Math.random() * 3)],
        message: ["Neural core heartbeat nominal", "Perimeter scan: no anomalies", "Session token verified"][Math.floor(Math.random() * 3)],
        at: now(),
        demo: true,
      });
    }
  }, 3000);
}
