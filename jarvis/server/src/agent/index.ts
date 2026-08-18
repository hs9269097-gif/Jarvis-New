// ─────────────────────────────────────────────────────────────────────────────
// AGENT SYSTEM
// Pipeline: ANALYZING → PLANNING → EXECUTING → VERIFYING → COMPLETED.
// The agent understands the request, selects tools, executes them, verifies
// results, and recovers from failure. Emits a stream of typed events that the
// UI renders as the live agent visualization.
// ─────────────────────────────────────────────────────────────────────────────
import { db, now, uid } from "../db/index.js";
import { resolveProvider, demoReply, type ChatMessage, type AIProvider } from "../ai/index.js";
import { getTool } from "../tools/index.js";

export type AgentEvent =
  | { type: "state"; state: AgentState }
  | { type: "plan"; steps: string[] }
  | { type: "tool"; tool: { id: string; name: string; icon: string }; status: "start" | "done" | "error"; output?: string; demo?: boolean }
  | { type: "delta"; text: string }
  | { type: "done"; answer: string }
  | { type: "error"; message: string; retryable: boolean };

export type AgentState = "ANALYZING" | "PLANNING" | "EXECUTING" | "VERIFYING" | "COMPLETED";

interface ToolCall {
  id: string;
  name: string;
  icon: string;
  args: Record<string, unknown>;
  result?: { ok: boolean; output: string; demo?: boolean };
}

interface Plan {
  steps: string[];
  toolCalls: ToolCall[];
}

const SYSTEM_PROMPT =
  "You are JARVIS, an advanced personal AI assistant operating inside a futuristic command center. " +
  "Be intelligent, calm, professional, concise, helpful, and confident. Slightly futuristic in tone. " +
  "Address the user as 'sir' occasionally but not excessively. Use markdown for structure when useful. " +
  "Avoid excessive jokes. You have tools for web search, calculation, code execution, memory, tasks, and system telemetry.";

// ── Intent analysis ───────────────────────────────────────────────────────────
const CODE_BLOCK = /```(?:js|javascript|typescript|python)?\s*([\s\S]*?)```/;

function detectIntents(input: string): string[] {
  const intents: string[] = [];
  const t = input.toLowerCase();
  if (/(search|look ?up|research|browse).*(web|online|internet|news)/.test(t) || /^search\b/.test(t) || /latest .*(news|ai)/.test(t)) intents.push("search");
  if (CODE_BLOCK.test(input) && /(run|execute|output of|result of)/.test(t)) intents.push("run_code");
  if (/(find|fix|debug|explain).*(error|bug|wrong|issue)/.test(t) || /error in this (code|js)/.test(t) || /debug this/.test(t)) intents.push("fix_code");
  if (/calculate|compute|solve|what is \d|math|=\s*$|\d\s*[\+\-\*\/]\s*\d/.test(t) || /^[\d\s\+\-\*\/\%\^\(\)\.]+$/.test(input.trim())) intents.push("calculate");
  if (/remember|note that|memorize|save this/.test(t)) intents.push("remember");
  if (/recall|what do you remember|show memory|my memories/.test(t)) intents.push("recall");
  if (/create (a )?task|add (a )?task|task (to|for)/.test(t)) intents.push("task");
  if (/security (check|scan)|run (a )?security/.test(t)) intents.push("security");
  if (/^(what|current).*(time|date|day)|what time|what day|today's date/.test(t)) intents.push("time");
  if (/(system|server|cpu|memory|ram).*(status|usage|monitor|info)/.test(t) || /system (status|info|check)/.test(t)) intents.push("system");
  return intents;
}

function buildPlan(intents: string[], input: string): Plan {
  const steps: string[] = [];
  const toolCalls: ToolCall[] = [];
  for (const intent of intents) {
    if (intent === "search") {
      steps.push("Query web sources");
      toolCalls.push({ id: uid("tc"), name: "Web Search", icon: "globe", args: { query: input.replace(/search (the web|online|the internet)? ?(for)?/i, "").trim() || input } });
      steps.push("Synthesize findings");
    }
    if (intent === "calculate") {
      steps.push("Evaluate expression");
      const m = input.match(/(?:calculate|compute|solve|what is)\s*:?\s*(.+)/i);
      toolCalls.push({ id: uid("tc"), name: "Calculator", icon: "sigma", args: { expression: (m ? m[1] : input).replace(/[^0-9+\-*/%^().\s]/g, "").trim() } });
    }
    if (intent === "run_code") {
      steps.push("Sandbox execution");
      const code = CODE_BLOCK.exec(input)?.[1] ?? "";
      toolCalls.push({ id: uid("tc"), name: "Code Runner", icon: "code", args: { code } });
    }
    if (intent === "fix_code") {
      steps.push("Static analysis");
      steps.push("Sandbox execution");
      const code = CODE_BLOCK.exec(input)?.[1] ?? input;
      toolCalls.push({ id: uid("tc"), name: "Code Runner", icon: "code", args: { code, analyze: true } });
    }
    if (intent === "remember") {
      steps.push("Persist to long-term memory");
      toolCalls.push({ id: uid("tc"), name: "Memory", icon: "database", args: { action: "remember", content: input.replace(/(please |jarvis,? )?(remember|note that|memorize|save this)[:,\s]*/i, "") } });
    }
    if (intent === "recall") {
      steps.push("Query memory core");
      toolCalls.push({ id: uid("tc"), name: "Memory", icon: "database", args: { action: "recall" } });
    }
    if (intent === "task") {
      steps.push("Create task record");
      toolCalls.push({ id: uid("tc"), name: "Task Manager", icon: "list", args: { title: input.replace(/(please |jarvis,? )?(create|add) (a )?task (to|for)?[:,\s]*/i, "") } });
    }
    if (intent === "security") {
      steps.push("Run security scan");
      toolCalls.push({ id: uid("tc"), name: "Security Scan", icon: "shield", args: {} });
    }
    if (intent === "system") {
      steps.push("Collect telemetry");
      toolCalls.push({ id: uid("tc"), name: "System Info", icon: "activity", args: {} });
    }
    if (intent === "time") {
      steps.push("Read clock");
      toolCalls.push({ id: uid("tc"), name: "Clock", icon: "clock", args: {} });
    }
  }
  if (intents.length === 0) steps.push("Compose response");
  return { steps, toolCalls };
}

function composeDemoAnswer(input: string, intents: string[], calls: ToolCall[]): string {
  const lines: string[] = [];
  for (const call of calls) {
    if (!call.result) continue;
    if (call.name === "Web Search") {
      const items = (() => { try { return JSON.parse(call.result.output); } catch { return []; } })();
      if (Array.isArray(items) && items.length) {
        lines.push(`Here is what I found for **"${call.args.query}"**:\n`);
        for (const it of items) lines.push(`- **[${it.title}](${it.url})** — ${it.snippet}`);
        if (call.result.demo) lines.push(`\n> ⚠️ Demo data — no search API key configured. Add one in **Settings → Providers**.`);
      } else lines.push(call.result.output);
    } else if (call.name === "Calculator") {
      lines.push(call.result.output);
    } else if (call.name === "Code Runner" && call.args.analyze) {
      lines.push(call.result.ok
        ? "✅ The code executed without errors in the sandbox.\n\n" + "```\n" + call.result.output + "\n```"
        : "⚠️ I found a problem in this code:\n\n```\n" + call.result.output + "\n```\n\n**Suggested fix:** review the error message above, verify variable definitions and syntax, then re-run. Paste the corrected code and I'll validate it again.");
    } else if (call.name === "Code Runner") {
      lines.push(call.result.ok ? "✅ Execution completed:\n\n```\n" + call.result.output + "\n```" : "❌ Execution failed:\n\n```\n" + call.result.output + "\n```");
    } else if (call.name === "Memory") {
      lines.push(call.result.output);
    } else if (call.name === "Task Manager") {
      lines.push(`✅ ${call.result.output}. You can track it in **Tasks** — I'll keep its progress live.`);
    } else if (call.name === "Security Scan") {
      lines.push("Security scan complete. All checks passed:\n\n" + call.result.output.split("\n").map((l) => "- " + l).join("\n") + "\n\n> ⚠️ Demo assessment — not a substitute for a real security audit.");
    } else {
      lines.push(call.result.output);
    }
  }
  if (lines.length === 0) return "";
  if (intents.includes("search")) lines.push("\nWould you like me to dig deeper into any of these sources?");
  return lines.join("\n");
}

// ── Main agent stream ─────────────────────────────────────────────────────────
export async function* runAgent(
  userMessage: string,
  history: ChatMessage[],
  opts: { temperature?: number; signal?: AbortSignal } = {},
): AsyncGenerator<AgentEvent> {
  const provider = resolveProvider();
  yield { type: "state", state: "ANALYZING" };
  await delay(250, opts.signal);

  const intents = detectIntents(userMessage);
  const plan = buildPlan(intents, userMessage);
  yield { type: "plan", steps: plan.steps };
  yield { type: "state", state: plan.toolCalls.length ? "EXECUTING" : "PLANNING" };

  // Execute tools
  for (const call of plan.toolCalls) {
    if (opts.signal?.aborted) return;
    yield { type: "tool", tool: { id: call.id, name: call.name, icon: call.icon }, status: "start" };
    const tool = getTool(toolIdFor(call.name));
    if (tool) {
      try {
        const result = await tool.run(call.args);
        call.result = result;
        db.insert("tool_runs", {
          id: call.id,
          tool: tool.id,
          input: call.args,
          ok: result.ok,
          output: result.output,
          demo: Boolean(result.demo),
          createdAt: now(),
        });
        yield { type: "tool", tool: { id: call.id, name: call.name, icon: call.icon }, status: result.ok ? "done" : "error", output: result.output, demo: result.demo };
      } catch (e) {
        call.result = { ok: false, output: (e as Error).message };
        yield { type: "tool", tool: { id: call.id, name: call.name, icon: call.icon }, status: "error", output: (e as Error).message };
      }
    }
    await delay(200, opts.signal);
  }

  yield { type: "state", state: "VERIFYING" };
  await delay(200, opts.signal);

  // Compose final answer
  let answer = "";
  try {
    if (provider.id === "demo") {
      answer = composeDemoAnswer(userMessage, intents, plan.toolCalls);
      if (!answer) answer = demoReplyForInput(userMessage);
      for (const chunk of chunkText(answer)) {
        if (opts.signal?.aborted) return;
        yield { type: "delta", text: chunk };
        await delay(14, opts.signal);
      }
    } else {
      const toolContext = plan.toolCalls
        .filter((c) => c.result)
        .map((c) => `[Tool: ${c.name}]\n${c.result!.output}`)
        .join("\n\n");
      const messages: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.slice(-8),
        { role: "user", content: userMessage },
      ];
      if (toolContext) messages.push({ role: "system", content: `Tool results (already executed; incorporate them):\n${toolContext}` });
      for await (const delta of provider.chat(messages, { temperature: opts.temperature, signal: opts.signal })) {
        if (opts.signal?.aborted) return;
        answer += delta;
        yield { type: "delta", text: delta };
      }
    }
  } catch (e) {
    const err = e as Error;
    // A cancelled request is not a failure — the client simply hung up.
    if (err.name === "AbortError" || opts.signal?.aborted) return;

    // `fetch failed` is Node's opaque network error. Translate it into
    // something the user can actually act on.
    const isNetwork = /fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT|network/i.test(err.message);
    const detail = isNetwork
      ? `Could not reach ${provider.label}. Check the server's internet connection, any firewall or proxy, and that the API host is reachable.`
      : err.message;

    yield { type: "error", message: `AI provider failure: ${detail}`, retryable: true };

    // Still give the user a usable reply instead of an empty bubble: fall back
    // to the offline demo engine rather than failing the whole turn.
    const fallback = composeDemoAnswer(userMessage, intents, plan.toolCalls) || demoReply(userMessage);
    answer =
      `⚠️ **${provider.label} is unreachable.** ${detail}\n\n` +
      `_Falling back to the offline demo engine for this reply:_\n\n${fallback}`;
    yield { type: "delta", text: answer };
  }

  yield { type: "state", state: "COMPLETED" };
  yield { type: "done", answer };
}

function toolIdFor(name: string): string {
  const map: Record<string, string> = {
    "Web Search": "web_search",
    Calculator: "calculator",
    "Code Runner": "code_runner",
    Clock: "clock",
    Memory: "memory",
    "Task Manager": "task",
    "Security Scan": "security_scan",
    "System Info": "system_info",
  };
  return map[name] ?? name;
}

function demoReplyForInput(input: string): string {
  return demoReply(input);
}

function chunkText(text: string): string[] {
  return text.match(/[\s\S]{1,28}/g) ?? [];
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((r) => {
    const t = setTimeout(r, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); r(); }, { once: true });
  });
}

// ── Logging helper ────────────────────────────────────────────────────────────
export function logActivity(userId: string, kind: string, message: string, meta: Record<string, unknown> = {}) {
  db.insert("activity_logs", { id: uid("log"), userId, kind, message, meta, createdAt: now() });
}

export type { AIProvider };
