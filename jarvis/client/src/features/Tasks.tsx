import { useEffect, useState } from "react";
import { Bar, EmptyState, Tag } from "../components/ui";
import { Icon } from "../components/icons";
import { Frame } from "./Frame";
import { api } from "../services/api";
import { pushToast, useToasts } from "../store";
import type { TaskItem } from "../types";

const STATE_TONE: Record<string, "cyan" | "violet" | "green" | "amber" | "red" | "gray"> = {
  QUEUED: "gray", ANALYZING: "violet", RUNNING: "cyan", WAITING: "amber", VERIFYING: "violet", COMPLETED: "green", FAILED: "red",
};

export function Tasks() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const { toasts } = useToasts();

  const refresh = async () => {
    try { setTasks((await api.tasks()).tasks); } catch { /* offline */ }
  };
  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 3000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => { refresh(); }, [toasts.length]);

  const create = async () => {
    if (!title.trim()) return;
    try { await api.createTask(title.trim()); setTitle(""); refresh(); pushToast("success", "TASK CREATED", "Task queued for execution."); } catch (e) { pushToast("error", "Failed", (e as Error).message); }
  };

  const runDemo = async () => {
    setLoading(true);
    try { await api.demoTask("Simulated intelligence run"); refresh(); } finally { setLoading(false); }
  };

  return (
    <Frame
      icon="tasks"
      title="TASK MANAGER"
      subtitle="AI task execution center"
      right={
        <div className="flex gap-2">
          <button onClick={runDemo} disabled={loading} className="btn-ghost !px-2.5 !py-1.5 text-xs">
            <Icon name="zap" size={13} /> DEMO RUN
          </button>
        </div>
      }
    >
      <div className="mb-4 flex gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") create(); }} placeholder="New task title…" className="input" aria-label="New task title" />
        <button onClick={create} className="btn-primary !px-4" aria-label="Create task"><Icon name="plus" size={15} /></button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState icon="tasks" title="NO ACTIVE TASKS" hint="Create a task above, or run a simulated task to watch JARVIS execute it live." />
      ) : (
        <div className="space-y-2.5">
          {tasks.map((t) => (
            <div key={t.id} className="glass-soft rounded-lg border border-white/10 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm text-ink">{t.title}</p>
                    {t.demo && <Tag tone="amber">DEMO</Tag>}
                    <Tag tone={STATE_TONE[t.state] ?? "gray"}>{t.state}</Tag>
                  </div>
                  {t.description && <p className="mt-0.5 text-xs text-dim">{t.description}</p>}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1"><Bar value={t.progress} color={t.state === "FAILED" ? "bg-red-400" : t.state === "COMPLETED" ? "bg-emerald-400" : "bg-cyan-400"} /></div>
                    <span className="tech-text text-[10px] text-mut">{t.progress}%</span>
                  </div>
                  {t.logs && t.logs.length > 0 && (
                    <div className="mt-2 max-h-16 overflow-y-auto rounded bg-black/30 p-2 font-mono text-[9px] leading-4 text-cyan-200/60">
                      {t.logs.slice(-6).map((l, i) => <p key={i}>▸ {l}</p>)}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {t.state === "FAILED" && (
                    <button onClick={() => { api.retryTask(t.id); refresh(); }} className="btn-ghost !h-8 !w-8 !p-0" aria-label="Retry"><Icon name="retry" size={13} /></button>
                  )}
                  <button onClick={() => { api.deleteTask(t.id); refresh(); }} className="btn-ghost !h-8 !w-8 !p-0 text-dim hover:text-red-300" aria-label="Delete"><Icon name="trash" size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Frame>
  );
}
