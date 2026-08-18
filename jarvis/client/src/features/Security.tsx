import { useEffect, useState } from "react";
import { Icon, type IconName } from "../components/icons";
import { Tag } from "../components/ui";
import { Frame } from "./Frame";
import { api } from "../services/api";
import { connectSSE } from "../services/stream";
import { useLive } from "../store";
import type { SecurityStatus } from "../types";

const CHECKS: { label: string; ok: boolean; detail: string }[] = [
  { label: "AUTHENTICATION", ok: true, detail: "scrypt password hashing" },
  { label: "API SECURITY", ok: true, detail: "rate limiting + validation" },
  { label: "SESSION SECURITY", ok: true, detail: "HttpOnly signed cookies" },
  { label: "PERMISSION SYSTEM", ok: true, detail: "tool-level permissions" },
  { label: "ENCRYPTION", ok: true, detail: "HTTPS at proxy" },
  { label: "SECRETS", ok: true, detail: "environment variables only" },
];

export function Security() {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const events = useLive((s) => s.securityEvents);

  useEffect(() => {
    api.security().then(setStatus).catch(() => {});
    const sse = connectSSE("/api/system/stream", {
      onEvent: (e) => {
        if (e.type === "security_event") useLive.getState().pushSecurityEvent(e as never);
      },
    });
    return () => sse.close();
  }, []);

  const score = status?.score ?? 0;
  const tone = score > 85 ? "text-emerald-300" : score > 70 ? "text-cyan-300" : "text-amber-300";

  return (
    <Frame
      icon="security"
      title="SECURITY CENTER"
      subtitle="Posture, permissions, sessions & activity"
      right={<Tag tone="amber">SIMULATED DATA</Tag>}
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Score */}
        <div className="glass-soft flex flex-col items-center justify-center rounded-lg border border-white/10 p-5 text-center">
          <p className="tech-text text-[9px] tracking-[0.3em] text-dim">SECURITY SCORE</p>
          <div className="relative my-4 grid h-28 w-28 place-items-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="#22d3ee" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${score * 2.64} 264`} />
            </svg>
            <span className={`tech-text text-3xl font-light ${tone}`}>{score}</span>
          </div>
          <Tag tone={score > 85 ? "green" : score > 70 ? "cyan" : "amber"}>THREAT LEVEL: {status?.threatLevel ?? "—"}</Tag>
        </div>

        {/* Checks */}
        <div className="glass-soft rounded-lg border border-white/10 p-4">
          <p className="tech-text mb-3 text-[9px] tracking-[0.25em] text-dim">COMPONENT STATUS</p>
          <div className="space-y-2">
            {CHECKS.map((c) => (
              <div key={c.label} className="flex items-center gap-2.5">
                <span className="grid h-6 w-6 place-items-center rounded border border-emerald-400/25 bg-emerald-400/10 text-emerald-300"><Icon name="check" size={12} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink">{c.label}</p>
                  <p className="text-[10px] text-dim">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sessions + timeline */}
        <div className="space-y-3">
          <div className="glass-soft rounded-lg border border-white/10 p-4">
            <p className="tech-text mb-2 text-[9px] tracking-[0.25em] text-dim">ACTIVE SESSIONS</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-mut">Sessions</span>
              <span className="tech-text text-ink">{status?.sessions.active ?? "—"}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-mut">Live clients</span>
              <span className="tech-text text-ink">{status?.sessions.current ?? "—"}</span>
            </div>
            <p className="mt-2 text-[10px] text-dim">Cookie policy: {status?.encryption.cookies}</p>
          </div>
          <div className="glass-soft max-h-44 overflow-y-auto rounded-lg border border-white/10 p-4">
            <p className="tech-text mb-2 text-[9px] tracking-[0.25em] text-dim">ACTIVITY TIMELINE</p>
            <div className="space-y-1.5">
              {events.length === 0 && <p className="text-[11px] text-dim">Awaiting security events…</p>}
              {events.slice(0, 8).map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <Icon name="shield" size={11} className="text-cyan-300/70" />
                  <span className="flex-1 text-mut">{e.message}</span>
                  <span className="tech-text text-[9px] text-dim">{new Date(e.at).toLocaleTimeString("en-GB", { hour12: false })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Permission matrix */}
      <div className="glass-soft mt-3 rounded-lg border border-white/10 p-4">
        <p className="tech-text mb-3 text-[9px] tracking-[0.25em] text-dim">TOOL PERMISSION MATRIX</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {(status?.permissions ?? []).map((p) => (
            <div key={p.tool} className="flex items-center justify-between rounded border border-white/10 px-2.5 py-1.5">
              <span className="text-xs text-mut">{p.tool}</span>
              <Tag tone={p.permission === "none" ? "green" : p.permission === "user" ? "amber" : "red"}>{p.permission.toUpperCase()}</Tag>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-dim">
          ⚠️ Demo posture assessment. Connect real security telemetry for production use — this dashboard does not represent live protection.
        </p>
      </div>
    </Frame>
  );
}
