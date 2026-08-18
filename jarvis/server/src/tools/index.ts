// ─────────────────────────────────────────────────────────────────────────────
// MODULAR TOOL REGISTRY
// Every tool exposes metadata + an async `run`. Tools that touch external
// systems require `permission`. Nothing dangerous runs silently.
// ─────────────────────────────────────────────────────────────────────────────
import vm from "node:vm";
import os from "node:os";
import { config } from "../config.js";
import { db, now, uid } from "../db/index.js";

export interface ToolResult {
  ok: boolean;
  output: string;
  data?: unknown;
  demo?: boolean;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  permission: "none" | "user" | "external";
  status: "online" | "offline" | "degraded";
  run(args: Record<string, unknown>): Promise<ToolResult>;
}

// ── Safe arithmetic evaluator (no eval) ───────────────────────────────────────
function evaluateMath(expr: string): number {
  const tokens = expr.replace(/\s+/g, "").split(/([+\-*/%^()])/).filter(Boolean);
  let pos = 0;
  function peek() { return tokens[pos]; }
  function parseExpr(): number {
    let left = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = tokens[pos++]!;
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }
  function parseTerm(): number {
    let left = parseFactor();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = tokens[pos++]!;
      const right = parseFactor();
      if (op === "*") left *= right;
      else if (op === "/") left /= right;
      else left %= right;
    }
    return left;
  }
  function parseFactor(): number {
    let val: number;
    if (peek() === "-") { pos++; val = -parseFactor(); }
    else if (peek() === "+") { pos++; val = parseFactor(); }
    else if (peek() === "(") { pos++; val = parseExpr(); if (peek() !== ")") throw new Error("Mismatched parenthesis"); pos++; }
    else if (peek() === "^") { pos++; const exp = parseFactor(); val = Math.pow(parseFactor(), exp); }
    else {
      const t = tokens[pos];
      if (!t || !/^\d*\.?\d+$/.test(t)) throw new Error(`Unexpected token: ${t ?? "end"}`);
      pos++;
      val = Number(t);
    }
    if (peek() === "^") { pos++; val = Math.pow(val, parseFactor()); }
    return val;
  }
  const result = parseExpr();
  if (pos !== tokens.length) throw new Error("Trailing characters in expression");
  return result;
}

function sanitizeExpr(expr: string): string {
  return expr.replace(/[^0-9+\-*/%^().\s]/g, "");
}

// ── Sandboxed JavaScript runner ───────────────────────────────────────────────
function runSandboxed(code: string): { output: string; error?: string; ms: number } {
  const started = performance.now();
  const logs: string[] = [];
  const sandbox: Record<string, unknown> = {
    console: {
      log: (...a: unknown[]) => logs.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ")),
      warn: (...a: unknown[]) => logs.push("[warn] " + a.join(" ")),
      error: (...a: unknown[]) => logs.push("[error] " + a.join(" ")),
    },
    Math,
    JSON,
    Date,
    Array, Object, String, Number, Boolean,
  };
  const context = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  try {
    const result = vm.runInContext(code, context, { timeout: 1500 });
    logs.push("=> " + (typeof result === "string" ? result : JSON.stringify(result ?? "undefined")));
    return { output: logs.join("\n"), ms: Math.round(performance.now() - started) };
  } catch (e) {
    return { output: logs.join("\n"), error: (e as Error).message, ms: Math.round(performance.now() - started) };
  }
}

// ── Web search (real via provider, else simulated) ────────────────────────────
async function webSearch(query: string): Promise<ToolResult> {
  const provider = config.search.provider.toLowerCase();
  const key = config.search.apiKey;
  if (provider && key) {
    try {
      let items: { title: string; url: string; snippet: string }[] = [];
      if (provider === "brave") {
        const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
          headers: { "X-Subscription-Token": key, Accept: "application/json" },
        });
        const j = (await r.json()) as { web?: { results?: { title: string; url: string; description: string }[] } };
        items = (j.web?.results ?? []).map((x) => ({ title: x.title, url: x.url, snippet: x.description }));
      } else if (provider === "tavily") {
        const r = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: key, query, max_results: 5 }),
        });
        const j = (await r.json()) as { results?: { title: string; url: string; content: string }[] };
        items = (j.results ?? []).map((x) => ({ title: x.title, url: x.url, snippet: x.content }));
      } else if (provider === "serpapi") {
        const r = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${key}`);
        const j = (await r.json()) as { organic_results?: { title: string; link: string; snippet: string }[] };
        items = (j.organic_results ?? []).map((x) => ({ title: x.title, url: x.link, snippet: x.snippet }));
      }
      if (items.length) return { ok: true, output: JSON.stringify(items), data: items };
    } catch (e) {
      return { ok: false, output: `Search provider failed: ${(e as Error).message}` };
    }
  }
  // Simulated demo results
  const demo = [
    { title: `${query} — Overview (DEMO)`, url: "https://example.com/overview", snippet: `Simulated summary of "${query}". This is demo data because no search API key is configured. Add one in Settings → Providers.` },
    { title: `Latest developments: ${query} (DEMO)`, url: "https://example.com/latest", snippet: "A simulated source listing recent developments, trends, and expert commentary on this topic." },
    { title: `Analysis & data: ${query} (DEMO)`, url: "https://example.com/analysis", snippet: "Simulated analytical breakdown with key figures, timelines, and comparative context." },
  ];
  return { ok: true, output: JSON.stringify(demo), data: demo, demo: true };
}

// ── Registry ──────────────────────────────────────────────────────────────────
export const tools: Tool[] = [
  {
    id: "web_search",
    name: "Web Search",
    description: "Search the web, read sources, and synthesize findings.",
    icon: "globe",
    permission: "external",
    status: "online",
    async run(args) {
      return webSearch(String(args.query ?? ""));
    },
  },
  {
    id: "calculator",
    name: "Calculator",
    description: "Evaluate safe arithmetic expressions.",
    icon: "sigma",
    permission: "none",
    status: "online",
    async run(args) {
      try {
        const expr = sanitizeExpr(String(args.expression ?? args.query ?? ""));
        const value = evaluateMath(expr);
        return { ok: true, output: `${expr} = ${value}` };
      } catch (e) {
        return { ok: false, output: `Calculation failed: ${(e as Error).message}` };
      }
    },
  },
  {
    id: "code_runner",
    name: "Code Runner",
    description: "Execute JavaScript in an isolated sandbox with a 1.5s timeout.",
    icon: "code",
    permission: "user",
    status: "online",
    async run(args) {
      const code = String(args.code ?? "");
      if (!code) return { ok: false, output: "No code provided." };
      if (code.length > 20000) return { ok: false, output: "Code exceeds 20 KB safety limit." };
      const res = runSandboxed(code);
      return res.error
        ? { ok: false, output: res.output ? `${res.output}\nRuntimeError: ${res.error}` : `RuntimeError: ${res.error}` }
        : { ok: true, output: res.output };
    },
  },
  {
    id: "clock",
    name: "Clock",
    description: "Current date and time.",
    icon: "clock",
    permission: "none",
    status: "online",
    async run() {
      return { ok: true, output: new Date().toLocaleString("en-IN", { dateStyle: "full", timeStyle: "long" }) };
    },
  },
  {
    id: "memory",
    name: "Memory",
    description: "Store and recall long-term memories.",
    icon: "database",
    permission: "none",
    status: "online",
    async run(args) {
      const action = String(args.action ?? "recall");
      if (action === "remember") {
        const content = String(args.content ?? "");
        db.insert("memory", {
          id: uid("mem"),
          content,
          category: "long_term",
          importance: String(args.importance ?? "normal"),
          source: "voice_command",
          createdAt: now(),
        });
        return { ok: true, output: `Memory stored: "${content}"` };
      }
      const all = db.all("memory").slice(-5).map((m) => `• ${m.content}`).join("\n");
      return { ok: true, output: all || "Memory is empty." };
    },
  },
  {
    id: "task",
    name: "Task Manager",
    description: "Create and manage tasks.",
    icon: "list",
    permission: "none",
    status: "online",
    async run(args) {
      const title = String(args.title ?? args.content ?? "New task");
      const task = db.insert("tasks", {
        id: uid("task"),
        title,
        description: String(args.description ?? ""),
        state: "QUEUED",
        progress: 0,
        createdAt: now(),
        logs: [],
      });
      return { ok: true, output: `Task created: "${task.title}"`, data: task };
    },
  },
  {
    id: "security_scan",
    name: "Security Scan",
    description: "Run a simulated security posture assessment.",
    icon: "shield",
    permission: "none",
    status: "online",
    async run() {
      const findings = [
        "Session tokens: signed & HttpOnly ✓",
        "Password storage: scrypt hash ✓",
        "Rate limiting: active ✓",
        "Input validation: enabled ✓",
        "Secrets: server-side only ✓",
      ];
      return { ok: true, output: findings.join("\n"), demo: true };
    },
  },
  {
    id: "system_info",
    name: "System Info",
    description: "Live server telemetry.",
    icon: "activity",
    permission: "none",
    status: "online",
    async run() {
      const load = os.loadavg();
      const total = os.totalmem();
      const free = os.freemem();
      return {
        ok: true,
        output: `CPU ${os.cpus().length} cores · load ${load.map((x) => x.toFixed(2)).join("/")} · RAM ${(((total - free) / total) * 100).toFixed(1)}% used · up ${Math.round(os.uptime() / 3600)}h`,
      };
    },
  },
];

const toolMap = new Map(tools.map((t) => [t.id, t]));

export function getTool(id: string): Tool | undefined {
  return toolMap.get(id);
}

export function toolCatalog() {
  return tools.map(({ id, name, description, icon, permission, status }) => ({ id, name, description, icon, permission, status }));
}
