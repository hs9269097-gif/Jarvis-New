import { useEffect, useRef, useState } from "react";
import { Bar, Sparkline, Tag } from "../components/ui";
import { Icon, type IconName } from "../components/icons";
import { Frame } from "./Frame";
import { connectSSE } from "../services/stream";
import { api } from "../services/api";
import { recordMetrics } from "../store";
import type { Metrics } from "../types";

function fmtBytes(n: number) {
  if (n > 1_073_741_824) return (n / 1_073_741_824).toFixed(2) + " GB";
  if (n > 1_048_576) return (n / 1_048_576).toFixed(0) + " MB";
  return (n / 1024).toFixed(0) + " KB";
}

function Gauge({ label, value, icon, tone }: { label: string; value: number; icon: IconName; tone: string }) {
  const color = tone === "green" ? "#34d399" : tone === "amber" ? "#fbbf24" : tone === "red" ? "#f87171" : "#22d3ee";
  return (
    <div className="glass-soft rounded-lg border border-white/10 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="tech-text text-[9px] tracking-[0.25em] text-dim">{label}</span>
        <Icon name={icon} size={14} className="text-cyan-300" />
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="tech-text text-2xl font-light text-white glow-soft">{value.toFixed(0)}<span className="text-sm text-dim">%</span></span>
      </div>
      <div className="mt-2"><Bar value={value} color={color === "#22d3ee" ? "bg-cyan-400" : color === "#34d399" ? "bg-emerald-400" : color === "#fbbf24" ? "bg-amber-400" : "bg-red-400"} /></div>
    </div>
  );
}

export function System() {
  const [m, setM] = useState<Metrics | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [latency, setLatency] = useState(0);
  const [connected, setConnected] = useState(true);
  const histRef = useRef<number[]>([]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const t0 = performance.now();
      try {
        const metrics = await api.metrics();
        if (!alive) return;
        setLatency(Math.round(performance.now() - t0));
        setM(metrics);
        recordMetrics(metrics);
        histRef.current = [...histRef.current, metrics.cpu].slice(-40);
        setHistory(histRef.current);
      } catch {
        if (alive) setConnected(false);
      }
    };
    tick();
    const iv = setInterval(tick, 2000);
    const sse = connectSSE("/api/system/stream", {
      onEvent: (e) => {
        if (e.type === "metrics" && alive) {
          setConnected(true);
          const metrics = e as unknown as Metrics;
          setM(metrics);
          recordMetrics(metrics);
          histRef.current = [...histRef.current, metrics.cpu].slice(-40);
          setHistory(histRef.current);
        }
      },
    });
    return () => { alive = false; clearInterval(iv); sse.close(); };
  }, []);

  const cpuTone = m && m.cpu > 80 ? "red" : m && m.cpu > 55 ? "amber" : "green";
  const ramTone = m && m.ram.usedPct > 85 ? "red" : m && m.ram.usedPct > 60 ? "amber" : "green";

  return (
    <Frame
      icon="system"
      title="SYSTEM MONITOR"
      subtitle="Live server telemetry"
      right={<Tag tone={connected ? "green" : "red"}>{connected ? "STREAM LIVE" : "RECONNECTING"}</Tag>}
    >
      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Gauge label="CPU" value={m?.cpu ?? 0} icon="activity" tone={cpuTone} />
        <Gauge label="MEMORY" value={m?.ram.usedPct ?? 0} icon="memory" tone={ramTone} />
        <Gauge label="STORAGE" value={m?.storage.usedPct ?? 0} icon="database" tone={(m?.storage.usedPct ?? 0) > 85 ? "amber" : "green"} />
        <div className="glass-soft rounded-lg border border-white/10 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="tech-text text-[9px] tracking-[0.25em] text-dim">API LATENCY</span>
            <Icon name="zap" size={14} className="text-cyan-300" />
          </div>
          <span className="tech-text text-2xl font-light text-white glow-soft">{latency}<span className="text-sm text-dim">ms</span></span>
          <p className="tech-text mt-2 text-[9px] tracking-[0.2em] text-dim">{m ? `${m.cores} CORES · UPTIME ${Math.round(m.uptime / 3600)}H` : "—"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="glass-soft rounded-lg border border-white/10 p-4">
          <p className="tech-text mb-2 text-[9px] tracking-[0.25em] text-dim">CPU LOAD HISTORY</p>
          <Sparkline data={history.length > 1 ? history : [8, 14, 11, 22, 17, 30, 24, 19, 26, 21]} color="#22d3ee" height={70} />
          <div className="mt-2 flex justify-between text-[10px] text-dim">
            <span>60s window</span>
            <span>peak {Math.max(...(history.length ? history : [0])).toFixed(0)}%</span>
          </div>
        </div>
        <div className="glass-soft rounded-lg border border-white/10 p-4">
          <p className="tech-text mb-3 text-[9px] tracking-[0.25em] text-dim">RESOURCE BREAKDOWN</p>
          <div className="space-y-3 text-xs">
            <div>
              <div className="mb-1 flex justify-between"><span className="text-mut">RAM</span><span className="tech-text text-ink">{fmtBytes(m?.ram.used ?? 0)} / {fmtBytes(m?.ram.total ?? 0)}</span></div>
              <Bar value={m?.ram.usedPct ?? 0} />
            </div>
            <div>
              <div className="mb-1 flex justify-between"><span className="text-mut">STORAGE</span><span className="tech-text text-ink">{fmtBytes(m?.storage.used ?? 0)} / {fmtBytes(m?.storage.total ?? 0)}</span></div>
              <Bar value={m?.storage.usedPct ?? 0} color="bg-violet-400" />
            </div>
            <div>
              <div className="mb-1 flex justify-between"><span className="text-mut">NETWORK ↓</span><span className="tech-text text-ink">{((m?.network.rxRate ?? 0) / 1024).toFixed(1)} KB/s</span></div>
              <Bar value={Math.min(100, (m?.network.rxRate ?? 0) / 10000)} color="bg-emerald-400" />
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2 text-mut">
              <span>PROCESS</span>
              <span className="tech-text text-ink">PID {m?.process.pid ?? "—"} · RSS {fmtBytes(m?.process.rss ?? 0)}</span>
            </div>
            <div className="flex justify-between text-mut">
              <span>LOAD AVG</span>
              <span className="tech-text text-ink">{(m?.load ?? []).map((x) => x.toFixed(2)).join(" / ")}</span>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}
