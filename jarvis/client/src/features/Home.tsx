import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { GlassPanel, Sparkline, StatusIndicator, Tag } from "../components/ui";
import { Icon, type IconName } from "../components/icons";
import { useChat, useCore, useNav, useSettings, useVoice, metricsHistory } from "../store";
import { api } from "../services/api";
import { sfx } from "../services/sound";
import type { Metrics, TaskItem } from "../types";

const EXAMPLES: { icon: IconName; text: string }[] = [
  { icon: "globe", text: "Search the web for the latest AI news" },
  { icon: "sigma", text: "Calculate 4,821 × 39" },
  { icon: "code", text: "Find the error in this code" },
  { icon: "database", text: "Remember that I prefer dark mode" },
  { icon: "shield", text: "Run a security check" },
  { icon: "tasks", text: "Create a task to review the deployment" },
];

function StatCard({ icon, label, value, sub, state }: { icon: IconName; label: string; value: string; sub: string; state: string }) {
  return (
    <GlassPanel className="flex items-center gap-3 p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-cyan-400/15 bg-cyan-400/5 text-cyan-300">
        <Icon name={icon} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="tech-text text-[9px] tracking-[0.2em] text-dim">{label}</p>
        <p className="truncate text-sm font-medium text-ink">{value}</p>
        <p className="truncate text-[10px] text-dim">{sub}</p>
      </div>
      <StatusIndicator state={state} />
    </GlassPanel>
  );
}

export function Home() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const send = useChat((s) => s.send);
  const setSection = useNav((s) => s.setSection);
  const provider = useSettings((s) => s.provider);
  const booted = useCore((s) => s.booted);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [m, t] = await Promise.all([api.metrics(), api.tasks()]);
        if (alive) { setMetrics(m); setTasks(t.tasks); }
      } catch { /* offline tolerant */ }
    };
    load();
    const iv = setInterval(load, 4000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  const activeTasks = tasks.filter((t) => !["COMPLETED", "FAILED"].includes(t.state)).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex h-full flex-col items-center justify-between px-3 pb-40 pt-16 sm:px-6">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: booted ? 1 : 0, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col items-center text-center"
      >
        <p className="tech-text text-[10px] tracking-[0.4em] text-cyan-300/80">{greeting}, SIR</p>
        <h1 className="mt-2 text-2xl font-light tracking-[0.12em] text-white glow-soft sm:text-3xl">
          ALL SYSTEMS <span className="text-cyan-300 glow-cyan">OPERATIONAL</span>
        </h1>
        <p className="mt-2 max-w-md text-xs text-mut">
          I am standing by. Speak a command, or select a module to begin.
        </p>
      </motion.div>

      {/* Example commands */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: booted ? 1 : 0 }}
        transition={{ delay: 0.6 }}
        className="mt-6 hidden max-w-2xl flex-wrap items-center justify-center gap-2 md:flex"
      >
        {EXAMPLES.map((e) => (
          <button
            key={e.text}
            onClick={() => { setSection("chat"); send(e.text); sfx.click(); }}
            className="focus-ring flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-mut transition-all hover:border-cyan-400/40 hover:text-cyan-200 hover:shadow-[0_0_16px_-6px_rgba(34,211,238,0.6)]"
          >
            <Icon name={e.icon} size={12} /> {e.text}
          </button>
        ))}
      </motion.div>

      {/* Status cards */}
      <div className="mt-8 grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-3">
        <StatCard icon="system" label="SYSTEM LOAD" value={metrics ? `${metrics.cpu.toFixed(0)}% CPU` : "—"} sub={`${metrics?.cores ?? "—"} cores · ${(metrics?.load[0] ?? 0).toFixed(2)} load`} state={metrics && metrics.cpu > 80 ? "warning" : "online"} />
        <StatCard icon="activity" label="AI ENGINE" value={provider?.activeLabel ?? "JARVIS Demo"} sub={provider?.demo ? "Simulated responses" : "Live provider"} state={provider?.demo ? "warning" : "online"} />
        <StatCard icon="tasks" label="ACTIVE TASKS" value={`${activeTasks}`} sub={`${tasks.length} total tracked`} state={activeTasks ? "active" : "idle"} />
      </div>

      {/* CPU sparkline + demo note */}
      <div className="mt-4 flex w-full max-w-3xl items-end justify-between gap-4">
        <div className="w-40">
          <p className="tech-text mb-1 text-[8px] tracking-[0.25em] text-dim">CPU HISTORY</p>
          <Sparkline data={metricsHistory.length > 1 ? metricsHistory : [10, 22, 15, 34, 28, 42, 30, 18]} />
        </div>
        <div className="text-right">
          {provider?.demo && (
            <Tag tone="amber">DEMO MODE — connect an AI provider in Settings</Tag>
          )}
          <p className="tech-text mt-1.5 text-[8px] tracking-[0.25em] text-dim">JARVIS v1.0 · LOCAL NODE · {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
}
