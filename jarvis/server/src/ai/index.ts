// ─────────────────────────────────────────────────────────────────────────────
// AI PROVIDER ABSTRACTION LAYER
// JARVIS never hardcodes a model vendor. Every provider implements `AIProvider`.
// Providers are selected from environment variables, and can be overridden
// per-user through Settings (stored server-side).
// All secret keys stay server-side and are never sent to the browser.
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
/** Upstream requests are abandoned after this long without completing. */
const REQUEST_TIMEOUT_MS = 120_000;

/**
 * Combine the caller's AbortSignal with a timeout so a hung provider can never
 * wedge a chat stream open forever. Returns the signal plus a cleanup fn.
 */
function withTimeout(signal?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error("Provider request timed out")), REQUEST_TIMEOUT_MS);
  const onAbort = () => ctrl.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) ctrl.abort(signal.reason);
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: ctrl.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

/** Turn an upstream error body into a short, safe, human-readable message. */
async function describeHttpError(res: Response, vendor: string): Promise<string> {
  let detail = "";
  try {
    const text = (await res.text()).slice(0, 800);
    try {
      const j = JSON.parse(text) as { error?: { message?: string; type?: string } | string; message?: string };
      const e = j.error;
      detail = (typeof e === "string" ? e : e?.message) || j.message || text;
    } catch {
      detail = text;
    }
  } catch {
    /* body already consumed or unreadable */
  }
  // Never echo a key back, even if the vendor included it in the error.
  detail = detail.replace(/sk-[A-Za-z0-9_\-]{8,}/g, "sk-***");

  const hint =
    res.status === 401 || res.status === 403
      ? " — check that your API key is valid and has credit."
      : res.status === 404
        ? " — the requested model name may not exist for this account."
        : res.status === 429
          ? " — rate limit or quota exceeded; wait a moment and retry."
          : res.status >= 500
            ? " — the provider is having trouble; retry shortly."
            : "";
  return `${vendor} error ${res.status}${detail ? `: ${detail}` : ""}${hint}`;
}

/**
 * Read an SSE byte stream and yield each `data:` payload as a string.
 * Handles chunk boundaries splitting mid-line and both \n and \r\n endings.
 */
async function* sseLines(res: Response, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const s = line.trim();
        if (!s || s.startsWith(":")) continue; // comment / keep-alive ping
        if (!s.startsWith("data:")) continue;
        yield s.slice(5).trim();
      }
      if (signal?.aborted) break;
    }
    // Flush any final line left in the buffer without a trailing newline.
    const tail = buf.trim();
    if (tail.startsWith("data:")) yield tail.slice(5).trim();
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* already closed */
    }
  }
}

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
  readonly id: string;
  readonly label: string;
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private model: string,
    id = "openai",
    label = "OpenAI-compatible",
  ) {
    this.id = id;
    this.label = label;
  }
  get configured() {
    return Boolean(this.apiKey);
  }
  async *chat(messages: ChatMessage[], opts: ProviderOptions): AsyncGenerator<string> {
    const { signal, done } = withTimeout(opts.signal);
    try {
      const res = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
          max_tokens: opts.maxTokens ?? config.ai.maxTokens,
          stream: true,
        }),
        signal,
      });
      if (!res.ok || !res.body) throw new Error(await describeHttpError(res, this.label));

      for await (const payload of sseLines(res, signal)) {
        if (payload === "[DONE]") return;
        try {
          const json = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
            error?: { message?: string };
          };
          if (json.error?.message) throw new Error(`${this.label}: ${json.error.message}`);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch (e) {
          // Re-throw real provider errors; ignore partial/unparsable JSON frames.
          if (e instanceof Error && e.message.startsWith(this.label)) throw e;
        }
      }
    } finally {
      done();
    }
  }
}

// ── Anthropic provider ────────────────────────────────────────────────────────

/**
 * The Anthropic Messages API is strict: the `messages` array may not be empty,
 * must start with a `user` turn, and may not contain two consecutive turns with
 * the same role. Conversation history replayed from the database can violate
 * all three, which returns a 400. Normalise it here.
 */
function normalizeAnthropicMessages(messages: ChatMessage[]): { role: "user" | "assistant"; content: string }[] {
  const cleaned = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content.trim() }))
    .filter((m) => m.content.length > 0);

  // Drop leading assistant turns — the conversation must open with the user.
  while (cleaned.length && cleaned[0]!.role === "assistant") cleaned.shift();

  // Merge consecutive same-role turns into one.
  const merged: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of cleaned) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${m.content}`;
    else merged.push({ ...m });
  }

  // Never send an empty array.
  if (!merged.length) merged.push({ role: "user", content: "Hello" });
  return merged;
}

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
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n")
      .trim();
    const rest = normalizeAnthropicMessages(messages);

    const { signal, done } = withTimeout(opts.signal);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          // Omit `system` entirely when empty — the API rejects an empty string.
          ...(system ? { system } : {}),
          max_tokens: opts.maxTokens ?? config.ai.maxTokens,
          temperature: Math.min(1, Math.max(0, opts.temperature ?? DEFAULT_TEMPERATURE)),
          stream: true,
          messages: rest,
        }),
        signal,
      });
      if (!res.ok || !res.body) throw new Error(await describeHttpError(res, this.label));

      for await (const payload of sseLines(res, signal)) {
        if (!payload) continue;
        let json: {
          type?: string;
          delta?: { text?: string };
          error?: { message?: string };
        };
        try {
          json = JSON.parse(payload);
        } catch {
          continue; // partial frame
        }
        // Anthropic reports mid-stream failures as an `error` event.
        if (json.type === "error") throw new Error(`${this.label}: ${json.error?.message ?? "stream error"}`);
        if (json.type === "content_block_delta" && json.delta?.text) yield json.delta.text;
        if (json.type === "message_stop") return;
      }
    } finally {
      done();
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
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n")
      .trim();
    const rest = messages
      .filter((m) => m.role !== "system" && m.content.trim())
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
    if (!rest.length) rest.push({ role: "user", parts: [{ text: "Hello" }] });

    const { signal, done } = withTimeout(opts.signal);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Header auth keeps the key out of URLs (and therefore out of logs).
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify({
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
            contents: rest,
            generationConfig: {
              temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
              maxOutputTokens: opts.maxTokens ?? config.ai.maxTokens,
            },
          }),
          signal,
        },
      );
      if (!res.ok || !res.body) throw new Error(await describeHttpError(res, this.label));

      for await (const payload of sseLines(res, signal)) {
        if (!payload) continue;
        try {
          const json = JSON.parse(payload) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
            error?: { message?: string };
          };
          if (json.error?.message) throw new Error(`${this.label}: ${json.error.message}`);
          const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
          if (text) yield text;
        } catch (e) {
          if (e instanceof Error && e.message.startsWith(this.label)) throw e;
        }
      }
    } finally {
      done();
    }
  }
}

// ── Provider factory ──────────────────────────────────────────────────────────
export const PROVIDER_IDS: ProviderId[] = ["demo", "openai", "anthropic", "gemini", "local"];

export function isProviderId(v: unknown): v is ProviderId {
  return typeof v === "string" && (PROVIDER_IDS as string[]).includes(v);
}

export function getProviders(): Record<ProviderId, AIProvider> {
  return {
    demo: new DemoProvider(),
    openai: new OpenAICompatProvider(
      config.ai.baseUrl || "https://api.openai.com/v1",
      config.ai.apiKey,
      config.ai.model || "gpt-4o-mini",
      "openai",
      "OpenAI-compatible",
    ),
    // Each vendor reads its OWN model env var. AI_MODEL is OpenAI-specific and
    // must never leak into Anthropic/Gemini — sending "gpt-4o-mini" to
    // Anthropic returns a 404 "model not found".
    anthropic: new AnthropicProvider(config.ai.anthropicKey, config.ai.anthropicModel),
    gemini: new GeminiProvider(config.ai.geminiKey, config.ai.geminiModel),
    local: new OpenAICompatProvider(
      config.ai.localBaseUrl || "http://localhost:11434/v1",
      // Ollama / LM Studio need no real key; "configured" = base URL present.
      config.ai.localBaseUrl ? "local-no-key-required" : "",
      config.ai.localModel || "llama3",
      "local",
      "Local model",
    ),
  };
}

/**
 * The user's provider choice from Settings → Providers.
 * Settings rows are stored as { id: "global", data: { provider: "anthropic" } },
 * so the value lives under `data` — reading `row.provider` always returned
 * undefined, which silently ignored every manual provider selection.
 */
function userOverride(): ProviderId | null {
  const row = db.query("settings", (s) => s.id === "global")[0];
  if (!row) return null;
  const data = (row.data ?? {}) as Record<string, unknown>;
  const choice = data.provider ?? (row as Record<string, unknown>).provider;
  return isProviderId(choice) ? choice : null;
}

export function resolveProvider(): AIProvider {
  const providers = getProviders();

  // 1. Explicit user override from Settings → Providers.
  const override = userOverride();
  if (override) {
    // "demo" is a deliberate choice, not a fallback — honour it immediately.
    if (override === "demo") return providers.demo;
    if (providers[override].configured) return providers[override];
  }

  // 2. Explicit AI_PROVIDER env var.
  const envChoice = config.ai.provider;
  if (isProviderId(envChoice) && envChoice !== "demo" && providers[envChoice].configured) {
    return providers[envChoice];
  }
  // AI_PROVIDER=demo with no user override → demo, as requested.
  if (envChoice === "demo" && !override) return providers.demo;

  // 3. Auto-detect: first real provider with credentials configured.
  for (const id of ["anthropic", "openai", "gemini", "local"] as const) {
    if (providers[id].configured) return providers[id];
  }

  // 4. Demo fallback — always available, never fails.
  return providers.demo;
}

export function providerStatus() {
  const providers = getProviders();
  const active = resolveProvider();
  return {
    active: active.id,
    activeLabel: active.label,
    demo: active.id === "demo",
    providers: PROVIDER_IDS.map((id) => ({ id, label: providers[id].label, configured: providers[id].configured })),
    envConfigured: PROVIDER_IDS.some((id) => id !== "demo" && providers[id].configured),
  };
}
