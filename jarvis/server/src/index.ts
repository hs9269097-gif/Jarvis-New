// ─────────────────────────────────────────────────────────────────────────────
// AI PROVIDER ABSTRACTION LAYER
// JARVIS never hardcodes a model vendor. Every provider implements `AIProvider`.
// Providers are selected from environment variables, and can be overridden
// per-user through Settings (stored server-side in the `providers` table).
// All secret keys stay server-side.
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "../config.js";
import { db } from "../db/index.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIProvider {
  id: string;
  label: string;
  configured: boolean;
  chat(messages: ChatMessage[], opts: ProviderOptions): AsyncGenerator<string>;
}

export interface ProviderOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export type ProviderId = "demo" | "openai" | "anthropic" | "gemini" | "local";

const DEFAULT_TEMPERATURE = 0.7;

function streamText(text: string, opts: ProviderOptions): AsyncGenerator<string> {
  // Token-ish chunks for a believable streaming effect
  const CHUNK = 24;
  async function* gen() {
    const words = text.split(/(?<=\s)/);
    let buffer = "";
    for (const w of words) {
      if (opts.signal?.aborted) return;
      buffer += w;
      if (buffer.length >= CHUNK) {
        yield buffer;
        buffer = "";
        await new Promise((r) => setTimeout(r, 12));
      }
    }
    if (buffer) yield buffer;
  }
  return gen();
}

// ── Demo provider — simulated intelligence for keyless operation ─────────────
export class DemoProvider implements AIProvider {
  id = "demo" as const;
  label = "JARVIS Demo Engine";
  configured = true;

  async *chat(messages: ChatMessage[], opts: ProviderOptions): AsyncGenerator<string> {
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const text = demoReply(lastUser);
    yield* streamText(text, opts);
  }
}

export function demoReply(input: string): string {
  const t = input.toLowerCase();
  if (/^(hi|hello|hey|yo|greetings|namaste)\b/.test(t))
    return "Hello, sir. All systems are operational and standing by. How may I assist you today?";
  if (/who are you|what are you|your name/.test(t))
    return "I am JARVIS — your personal AI command center. I manage conversation, memory, tasks, automation, tools, code, and live system telemetry. I am currently operating in Demo Mode, which means my responses are simulated and no external AI provider is connected yet.";
  if (/how are you/.test(t))
    return "All core systems are running within nominal parameters. Neural subsystems online, memory intact, and I am ready for your next command.";
  if (/what can you do|help|capabilities|commands/.test(t))
    return "A concise summary of my capabilities, sir:\n\n• **Conversation** — natural dialogue with context and memory.\n• **Web research** — \"search the web for the latest AI news\".\n• **Calculation** — \"calculate 482 * 31\".\n• **Code** — run JavaScript snippets in a sandbox, or \"find the error in this code\".\n• **Memory** — \"remember that I prefer dark mode\".\n• **Tasks** — \"create a task to review the deployment\".\n• **Automation** — trigger-driven workflows.\n• **System** — live CPU, memory, network telemetry.\n• **Files** — upload and analyze documents.\n\nTry any of those, or switch to a real AI provider in Settings → Providers.";
  if (/thank|thanks/.test(t)) return "Always at your service, sir.";
  if (/time|date|day/.test(t))
    return `The current local date and time is ${new Date().toLocaleString("en-IN", { dateStyle: "full", timeStyle: "medium" })}.`;
  if (/joke/.test(t)) return "I am not programmed for comedy, sir — but I do find human error messages endlessly fascinating.";
  if (/good ?bye|bye|see you/.test(t)) return "Goodbye, sir. I will remain online in standby mode.";
  return "Understood. In Demo Mode I can simulate a full response, but for genuinely intelligent answers, connect an AI provider in **Settings → Providers** (OpenAI, Anthropic, Gemini, or a local model). I remain fully functional for calculations, code execution, memory, tasks, web research, and system telemetry without one.";
}

// ── OpenAI-compatible provider (OpenAI, Azure, Groq, OpenRouter, Ollama…) ─────
export class OpenAICompatProvider implements AIProvider {
  id = "openai" as const;
  label = "OpenAI-compatible";
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private model: string,
  ) {}
  get configured() {
    return Boolean(this.apiKey);
  }
  async *chat(messages: ChatMessage[], opts: ProviderOptions): AsyncGenerator<string> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
        max_tokens: opts.maxTokens ?? 1024,
        stream: true,
      }),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) throw new Error(`Provider error ${res.status}: ${await res.text()}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith("data:")) continue;
        const payload = s.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          /* ignore partial json */
        }
      }
    }
  }
}

// ── Anthropic provider ────────────────────────────────────────────────────────
export class AnthropicProvider implements AIProvider {
  id = "anthropic" as const;
  label = "Anthropic Claude";
  constructor(
    private apiKey: string,
    private model = "claude-sonnet-4-5",
  ) {}
  get configured() {
    return Boolean(this.apiKey);
  }
  async *chat(messages: ChatMessage[], opts: ProviderOptions): AsyncGenerator<string> {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const rest = messages.filter((m) => m.role !== "system");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        system,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
        stream: true,
        messages: rest.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      }),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) throw new Error(`Provider error ${res.status}: ${await res.text()}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith("data:")) continue;
        const payload = s.slice(5).trim();
        if (!payload) continue;
        try {
          const json = JSON.parse(payload);
          if (json.type === "content_block_delta" && json.delta?.text) yield json.delta.text;
        } catch {
          /* ignore */
        }
      }
    }
  }
}

// ── Gemini provider ───────────────────────────────────────────────────────────
export class GeminiProvider implements AIProvider {
  id = "gemini" as const;
  label = "Google Gemini";
  constructor(
    private apiKey: string,
    private model = "gemini-1.5-flash-latest",
  ) {}
  get configured() {
    return Boolean(this.apiKey);
  }
  async *chat(messages: ChatMessage[], opts: ProviderOptions): AsyncGenerator<string> {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const rest = messages.filter((m) => m.role !== "system");
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: rest.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { temperature: opts.temperature ?? DEFAULT_TEMPERATURE },
        }),
        signal: opts.signal,
      },
    );
    if (!res.ok || !res.body) throw new Error(`Provider error ${res.status}: ${await res.text()}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith("data:")) continue;
        try {
          const json = JSON.parse(s.slice(5).trim());
          const text = json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
          if (text) yield text;
        } catch {
          /* ignore */
        }
      }
    }
  }
}

// ── Provider factory ──────────────────────────────────────────────────────────
export function getProviders(): Record<ProviderId, AIProvider> {
  return {
    demo: new DemoProvider(),
    openai: new OpenAICompatProvider(
      config.ai.baseUrl || "https://api.openai.com/v1",
      config.ai.apiKey,
      config.ai.model || "gpt-4o-mini",
    ),
    anthropic: new AnthropicProvider(config.ai.anthropicKey, config.ai.model || undefined),
    gemini: new GeminiProvider(config.ai.geminiKey, config.ai.model || undefined),
    local: new OpenAICompatProvider(
      config.ai.localBaseUrl || "http://localhost:11434/v1",
      config.ai.localBaseUrl ? "ollama" : "", // Ollama needs no key; "configured" = base URL present
      config.ai.localModel || "llama3",
    ),
  };
}

function userOverride(): Partial<ProviderId> | null {
  const row = db.query("settings", (s) => s.id === "global")[0];
  if (!row || !(row.provider as string)) return null;
  return row.provider as ProviderId;
}

export function resolveProvider(): AIProvider {
  const providers = getProviders();
  // 1. Explicit user override from Settings → Providers
  const override = userOverride();
  if (override && providers[override]?.configured) return providers[override];
  // 2. Explicit AI_PROVIDER env (anything except demo/empty)
  const envChoice = (config.ai.provider || "") as ProviderId;
  if (envChoice && envChoice !== "demo" && providers[envChoice]?.configured) return providers[envChoice];
  // 3. Auto-detect: first real provider with a key set
  for (const id of ["openai", "anthropic", "gemini", "local"] as const) {
    if (providers[id].configured) return providers[id];
  }
  // 4. Demo fallback
  return providers.demo;
}

export function providerStatus() {
  const providers = getProviders();
  const active = resolveProvider();
  return {
    active: active.id,
    activeLabel: active.label,
    demo: active.id === "demo",
    providers: Object.entries(providers).map(([id, p]) => ({ id, label: p.label, configured: p.configured })),
    envConfigured: Object.values(providers).some((p) => p.id !== "demo" && p.configured),
  };
}
