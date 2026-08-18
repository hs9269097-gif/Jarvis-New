import { motion } from "framer-motion";
import type { ChatMessage, ToolEvent } from "../types";
import { Markdown } from "./Markdown";
import { Icon, type IconName } from "./icons";
import { Tag } from "./ui";

const AGENT_PIPE = ["ANALYZING", "PLANNING", "EXECUTING", "VERIFYING", "COMPLETED"];

function AgentSteps({ steps }: { steps: string[] }) {
  const display = steps.length ? steps : ["Analyzing request", "Planning", "Composing response"];
  const max = Math.max(display.length, 5);
  const seq = [...display, ...Array(Math.max(0, max - display.length)).fill("")];
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1">
      {seq.map((s, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className={`tech-text text-[8.5px] tracking-[0.14em] ${s ? "text-cyan-200/90" : "text-dim/40"}`}>{s || "—"}</span>
          {i < seq.length - 1 && <Icon name="activity" size={9} className="text-dim/40" />}
        </span>
      ))}
    </div>
  );
}

function ToolChips({ tools }: { tools: ToolEvent[] }) {
  if (!tools.length) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {tools.map((t) => (
        <span
          key={t.id}
          className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-[9px] tech-text tracking-[0.1em] ${
            t.status === "done" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
            : t.status === "error" ? "border-red-400/30 bg-red-400/10 text-red-300"
            : "border-cyan-400/30 bg-cyan-400/10 text-cyan-300 animate-pulse"
          }`}
        >
          <Icon name={(t.icon as IconName) || "zap"} size={10} />
          {t.name}
          {t.demo && <span className="text-amber-300/80">· DEMO</span>}
        </span>
      ))}
    </div>
  );
}

export function AIMessage({ message, onRetry }: { message: ChatMessage; onRetry?: (text: string) => void }) {
  if (message.role === "user") {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-tr-sm border border-cyan-400/25 bg-gradient-to-b from-cyan-400/15 to-cyan-400/5 px-3.5 py-2.5">
          <p className="whitespace-pre-wrap text-sm text-ink">{message.content}</p>
        </div>
      </motion.div>
    );
  }
  if (message.role === "system") {
    return (
      <div className="flex justify-center">
        <Tag tone="gray">{message.content}</Tag>
      </div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex">
      <div className="mr-2 mt-1 grid h-6 w-6 shrink-0 place-items-center">
        <span className="relative grid h-6 w-6 place-items-center rounded-full border border-cyan-400/30 bg-cyan-400/5">
          <span className="absolute inset-0 animate-spin-slow rounded-full border border-cyan-300/30" style={{ borderTopColor: "transparent" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_#22d3ee]" />
        </span>
      </div>
      <div className="max-w-[92%] flex-1">
        <div className="glass relative rounded-xl rounded-tl-sm px-3.5 py-2.5">
          <div className="pointer-events-none absolute -inset-px rounded-xl bg-gradient-to-br from-cyan-400/5 to-transparent" />
          <div className="mb-1 flex items-center gap-2">
            <span className="tech-text text-[9px] tracking-[0.25em] text-cyan-300">JARVIS</span>
            {message.error && <Tag tone="red">FAULT</Tag>}
          </div>
          {message.steps && <AgentSteps steps={message.steps} />}
          {message.toolEvents && <ToolChips tools={message.toolEvents} />}
          {message.content ? (
            <Markdown>{message.content}</Markdown>
          ) : message.error ? (
            <div className="text-sm text-red-200/90">
              <p>JARVIS could not complete this operation.</p>
              {onRetry && (
                <button onClick={() => onRetry(message.id)} className="btn-ghost mt-2 !px-2.5 !py-1 text-xs">
                  <Icon name="retry" size={12} /> Retry
                </button>
              )}
            </div>
          ) : (
            <span className="flex items-center gap-2 py-1 text-cyan-300/80">
              <span className="h-3 w-3 animate-spin rounded-full border border-cyan-300/40 border-t-cyan-300" />
              <span className="tech-text text-[10px] tracking-[0.2em] animate-pulse-soft">JARVIS IS THINKING</span>
            </span>
          )}
          {message.streaming && message.content && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-cyan-300 align-middle" />}
        </div>
      </div>
    </motion.div>
  );
}
