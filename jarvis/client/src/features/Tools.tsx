import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EmptyState, Tag } from "../components/ui";
import { Icon, type IconName } from "../components/icons";
import { Frame } from "./Frame";
import { api } from "../services/api";
import { pushToast } from "../store";
import type { ToolInfo } from "../types";

const PERM_TONE: Record<string, "cyan" | "violet" | "green" | "amber" | "red" | "gray"> = { none: "green", user: "amber", external: "red" };

export function Tools() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [sel, setSel] = useState<ToolInfo | null>(null);
  const [arg, setArg] = useState("");
  const [result, setResult] = useState<{ ok: boolean; output: string; demo?: boolean } | null>(null);
  const [running, setRunning] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => { api.tools().then((r) => setTools(r.tools)).catch(() => {}); }, []);

  const run = async (t: ToolInfo, approvedExplicit = false) => {
    setRunning(true);
    setResult(null);
    try {
      let args: Record<string, unknown> = {};
      if (t.id === "calculator") args = { expression: arg };
      else if (t.id === "web_search") args = { query: arg };
      else if (t.id === "code_runner") args = { code: arg };
      else if (t.id === "memory") args = { action: "recall" };
      else if (t.id === "task") args = { title: arg || "Task from tool console" };
      const r = await api.runTool(t.id, args, approvedExplicit);
      setResult({ ok: r.ok, output: r.output, demo: r.demo });
      if (r.ok) pushToast("success", `${t.name.toUpperCase()} COMPLETE`);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 403) {
        pushToast("warning", "PERMISSION REQUIRED", `${t.name} touches an external system.`);
        setApproved(false);
      } else {
        setResult({ ok: false, output: err.message });
      }
    }
    setRunning(false);
  };

  return (
    <Frame icon="tools" title="TOOL REGISTRY" subtitle="Modular, permission-gated AI tools">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Catalog */}
        <div className="space-y-2">
          {tools.length === 0 ? (
            <EmptyState icon="tools" title="LOADING TOOL REGISTRY" />
          ) : (
            tools.map((t) => (
              <button
                key={t.id}
                onClick={() => { setSel(t); setArg(""); setResult(null); setApproved(false); }}
                className={`focus-ring flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${sel?.id === t.id ? "border-cyan-400/40 bg-cyan-400/10" : "border-white/10 hover:border-white/15"}`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-cyan-400/15 bg-cyan-400/5 text-cyan-300">
                  <Icon name={(t.icon as IconName) || "zap"} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm text-ink">{t.name}</span>
                    <Tag tone={PERM_TONE[t.permission] ?? "gray"}>{t.permission === "none" ? "SAFE" : t.permission === "user" ? "SANDBOXED" : "EXTERNAL"}</Tag>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-dim">{t.description}</span>
                </span>
                <span className="tech-text text-[9px] tracking-[0.2em] text-dim">{t.status.toUpperCase()}</span>
              </button>
            ))
          )}
        </div>

        {/* Runner */}
        <div className="glass-soft min-h-[280px] rounded-lg border border-white/10 p-4">
          <AnimatePresence mode="wait">
            {!sel ? (
              <EmptyState icon="zap" title="SELECT A TOOL" hint="Choose a tool from the registry to configure and execute it." />
            ) : (
              <motion.div key={sel.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name={(sel.icon as IconName) || "zap"} size={18} className="text-cyan-300" />
                    <span className="tech-text text-sm tracking-[0.2em] text-white">{sel.name.toUpperCase()}</span>
                  </div>
                  {sel.permission === "external" && <Tag tone="red">EXTERNAL</Tag>}
                </div>

                {sel.id === "calculator" && (
                  <input value={arg} onChange={(e) => setArg(e.target.value)} placeholder="e.g. (4821 * 39) / 12" className="input mb-2" aria-label="Expression" />
                )}
                {sel.id === "web_search" && (
                  <input value={arg} onChange={(e) => setArg(e.target.value)} placeholder="Search query…" className="input mb-2" aria-label="Search query" />
                )}
                {sel.id === "code_runner" && (
                  <textarea value={arg} onChange={(e) => setArg(e.target.value)} rows={5} placeholder={"console.log(Array.from({length:5}, (_,i) => i*i))"} className="input mb-2 font-mono text-xs" aria-label="Code" />
                )}
                {sel.id === "task" && (
                  <input value={arg} onChange={(e) => setArg(e.target.value)} placeholder="Task title…" className="input mb-2" aria-label="Task title" />
                )}

                {sel.permission === "external" && !approved && (
                  <p className="mb-2 rounded-md border border-amber-400/25 bg-amber-400/10 p-2 text-[11px] text-amber-200">
                    This tool contacts an external system and requires explicit permission.
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => sel.permission === "external" && !approved ? setApproved(true) : run(sel, sel.permission === "external")}
                    disabled={running}
                    className="btn-primary flex-1 disabled:opacity-40"
                  >
                    <Icon name="play" size={13} /> {running ? "EXECUTING…" : sel.permission === "external" && !approved ? "GRANT PERMISSION" : "EXECUTE"}
                  </button>
                  {sel.permission === "external" && approved && (
                    <button onClick={() => run(sel, true)} disabled={running} className="btn-ghost">
                      <Icon name="check" size={13} /> APPROVED
                    </button>
                  )}
                </div>

                {running && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-cyan-300/80">
                    <span className="h-3 w-3 animate-spin rounded-full border border-cyan-300/40 border-t-cyan-300" />
                    <span className="tech-text tracking-[0.2em]">EXECUTING TOOL…</span>
                  </p>
                )}
                {result && (
                  <div className={`mt-3 rounded-md border p-3 ${result.ok ? "border-emerald-400/25 bg-emerald-400/5" : "border-red-400/25 bg-red-400/5"}`}>
                    <p className="tech-text mb-1 text-[9px] tracking-[0.25em] text-dim">OUTPUT {result.demo ? "· DEMO" : ""}</p>
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-ink/90">{result.output}</pre>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Frame>
  );
}
