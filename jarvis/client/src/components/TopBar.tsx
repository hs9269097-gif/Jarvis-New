import { useEffect, useState } from "react";
import { Icon } from "./icons";
import { StatusIndicator } from "./ui";
import { useNav } from "../store";
import { useSettings } from "../store";

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

function Indicator({ label, state, title }: { label: string; state: string; title?: string }) {
  return (
    <div className="hidden items-center gap-1.5 sm:flex" title={title}>
      <StatusIndicator state={state} />
      <span className="tech-text text-[9px] tracking-[0.18em] text-mut">{label}</span>
    </div>
  );
}

export function TopBar() {
  const now = useClock();
  const { setMobileOpen } = useNav();
  const provider = useSettings((s) => s.provider);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const demo = provider?.demo ?? true;
  const time = now.toLocaleTimeString("en-GB", { hour12: false });

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-14 items-center justify-between px-3 sm:px-5">
      {/* Mobile menu */}
      <button
        className="pointer-events-auto focus-ring grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/5 text-mut md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Icon name="layers" size={16} />
      </button>

      {/* Brand */}
      <div className="pointer-events-auto flex items-center gap-2.5">
        <div className="relative grid h-7 w-7 place-items-center">
          <span className="absolute inset-0 animate-spin-slower rounded-full border border-cyan-400/40" style={{ borderTopColor: "transparent" }} />
          <span className="absolute inset-1 rounded-full border border-cyan-300/20" />
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#22d3ee]" />
        </div>
        <span className="tech-text text-sm font-semibold tracking-[0.4em] text-white glow-cyan">JARVIS</span>
        <span className="hidden items-center gap-1.5 rounded border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 sm:flex">
          <StatusIndicator state="online" />
          <span className="tech-text text-[9px] tracking-[0.2em] text-emerald-300">ONLINE</span>
        </span>
        {demo && (
          <span className="hidden rounded border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 lg:block">
            <span className="tech-text text-[9px] tracking-[0.2em] text-amber-300">DEMO MODE</span>
          </span>
        )}
      </div>

      {/* Status cluster */}
      <div className="pointer-events-auto flex items-center gap-3 sm:gap-5">
        <Indicator label="AI ENGINE" state={demo ? "warning" : "online"} title={demo ? "Demo engine active — connect a provider in Settings" : "Live AI provider connected"} />
        <Indicator label="NETWORK" state={online ? "online" : "offline"} title={online ? "Network link stable" : "Network offline"} />
        <Indicator label="SECURITY" state="online" title="Security systems nominal" />
        <Indicator label="MEMORY" state="online" title="Memory core online" />
        <Indicator label="TOOLS" state="online" title="Tool registry online" />
        <Indicator label="VOICE" state="online" title="Voice subsystem online" />
        <div className="hidden flex-col items-end sm:flex">
          <span className="tech-text text-sm text-ink glow-soft">{time}</span>
          <span className="tech-text text-[9px] tracking-[0.2em] text-dim">{now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}</span>
        </div>
      </div>
    </header>
  );
}
