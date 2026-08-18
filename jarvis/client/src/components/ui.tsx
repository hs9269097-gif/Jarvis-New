// Reusable JARVIS UI primitives — one design system everywhere.
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export function GlassPanel({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`glass relative rounded-xl ${className}`} style={style}>
      {children}
    </div>
  );
}

export function StatusIndicator({ state }: { state: string }) {
  const map: Record<string, string> = {
    online: "bg-emerald-400 shadow-[0_0_8px_#34d399]",
    offline: "bg-slate-500",
    active: "bg-cyan-400 shadow-[0_0_8px_#22d3ee]",
    idle: "bg-sky-500/60",
    error: "bg-red-400 shadow-[0_0_8px_#f87171]",
    warning: "bg-amber-400 shadow-[0_0_8px_#fbbf24]",
    listening: "bg-cyan-300 shadow-[0_0_10px_#22d3ee] animate-pulse",
    thinking: "bg-violet-400 shadow-[0_0_10px_#8b5cf6] animate-pulse",
    speaking: "bg-teal-300 shadow-[0_0_10px_#5eead4] animate-pulse",
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${map[state] ?? map.online}`} aria-hidden />;
}

export function SectionHeader({ icon, title, subtitle, right }: { icon: IconName; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/5 text-cyan-300">
          <Icon name={icon} size={18} />
        </div>
        <div>
          <h2 className="tech-text text-sm tracking-[0.25em] text-white glow-soft">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-mut">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon: IconName; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full border border-cyan-400/15 bg-cyan-400/5 text-dim animate-float-y">
        <Icon name={icon} size={24} />
      </div>
      <p className="tech-text text-xs tracking-[0.2em] text-mut">{title}</p>
      {hint && <p className="max-w-xs text-xs text-dim">{hint}</p>}
      {action}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-cyan-300/80">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-400" />
      </span>
      <span className="tech-text text-xs tracking-[0.25em] animate-pulse-soft">{label}</span>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? "toggle"}
      onClick={() => onChange(!checked)}
      className={`focus-ring relative h-5 w-10 rounded-full border transition-all ${checked ? "border-cyan-300/60 bg-cyan-400/25" : "border-white/10 bg-white/5"}`}
    >
      <span
        className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${checked ? "left-[22px] bg-cyan-300 shadow-[0_0_8px_#22d3ee]" : "left-0.5 bg-slate-400"}`}
      />
    </button>
  );
}

export function Bar({ value, color = "bg-cyan-400" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Sparkline({ data, color = "#22d3ee", height = 36 }: { data: number[]; color?: string; height?: number }) {
  if (data.length < 2) return <div style={{ height }} />;
  const w = 120;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - (v / max) * (height - 4) - 2}`).join(" ");
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={`0,${height} ${pts} ${w},${height}`} fill={`${color}14`} stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Tag({ children, tone = "cyan" }: { children: ReactNode; tone?: "cyan" | "violet" | "green" | "amber" | "red" | "gray" }) {
  const tones: Record<string, string> = {
    cyan: "text-cyan-300 border-cyan-400/25 bg-cyan-400/10",
    violet: "text-violet-300 border-violet-400/25 bg-violet-400/10",
    green: "text-emerald-300 border-emerald-400/25 bg-emerald-400/10",
    amber: "text-amber-300 border-amber-400/25 bg-amber-400/10",
    red: "text-red-300 border-red-400/25 bg-red-400/10",
    gray: "text-slate-300 border-white/10 bg-white/5",
  };
  return (
    <span className={`tech-text inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] tracking-[0.15em] uppercase ${tones[tone]}`}>
      {children}
    </span>
  );
}
