import { useEffect, useState } from "react";
import { EmptyState, Tag } from "../components/ui";
import { Icon, type IconName } from "../components/icons";
import { Frame } from "./Frame";
import { api } from "../services/api";

interface Log { id: string; kind: string; message: string; createdAt: number; }

const KIND_META: Record<string, { icon: IconName; tone: "cyan" | "violet" | "green" | "amber" | "red" | "gray" }> = {
  chat: { icon: "chat", tone: "cyan" },
  auth: { icon: "security", tone: "violet" },
  file: { icon: "files", tone: "green" },
  tool: { icon: "tools", tone: "amber" },
  task: { icon: "tasks", tone: "green" },
  system: { icon: "system", tone: "gray" },
};

export function Logs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const load = () => api.logs().then((r) => setLogs(r.logs)).catch(() => {});
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, []);

  const kinds = ["all", ...new Set(logs.map((l) => l.kind))];
  const filtered = logs.filter((l) => filter === "all" || l.kind === filter);

  return (
    <Frame icon="logs" title="ACTIVITY LOGS" subtitle="Execution & event history">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {kinds.map((k) => (
          <button key={k} onClick={() => setFilter(k)} className={`focus-ring rounded-md border px-2.5 py-1 text-[10px] tech-text tracking-[0.15em] ${filter === k ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-dim"}`}>
            {k.toUpperCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="logs" title="NO ACTIVITY RECORDED" hint="Chat, tools, files and tasks will appear here as JARVIS operates." />
      ) : (
        <div className="space-y-1">
          {filtered.map((l) => {
            const meta = KIND_META[l.kind] ?? { icon: "activity" as IconName, tone: "gray" as const };
            return (
              <div key={l.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded border border-cyan-400/15 bg-cyan-400/5 text-cyan-300">
                  <Icon name={meta.icon} size={13} />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-mut">{l.message}</span>
                <Tag tone={meta.tone}>{l.kind}</Tag>
                <span className="tech-text shrink-0 text-[9px] text-dim">{new Date(l.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              </div>
            );
          })}
        </div>
      )}
    </Frame>
  );
}
