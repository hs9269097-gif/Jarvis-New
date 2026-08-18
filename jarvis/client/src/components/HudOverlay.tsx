// Subtle holographic HUD: rotating arcs, radar, coordinate ticks, corner
// brackets and telemetry — layered between the 3D scene and the UI panels.
import { useCore, useLive } from "../store";

function CornerBrackets() {
  const c = "absolute h-6 w-6 border-cyan-300/30";
  return (
    <div className="pointer-events-none absolute inset-0 z-10 hidden sm:block" aria-hidden>
      <span className={`${c} left-3 top-16 border-l border-t`} />
      <span className={`${c} right-3 top-16 border-r border-t`} />
      <span className={`${c} left-3 bottom-16 border-b border-l`} />
      <span className={`${c} right-3 bottom-16 border-b border-r`} />
      <span className="tech-text absolute left-5 top-[4.6rem] text-[8px] tracking-[0.3em] text-dim/60">SYS://JARVIS-CORE</span>
      <span className="tech-text absolute right-5 top-[4.6rem] text-[8px] tracking-[0.3em] text-dim/60">SEC-CLEARANCE://OMEGA</span>
      <span className="tech-text absolute bottom-[4.7rem] left-5 text-[8px] tracking-[0.3em] text-dim/60">LINK://STABLE</span>
      <span className="tech-text absolute bottom-[4.7rem] right-5 text-[8px] tracking-[0.3em] text-dim/60">TIME-SYNC://ATOMIC</span>
    </div>
  );
}

function CenterArcs() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 hidden items-center justify-center md:flex" aria-hidden>
      <div className="relative aspect-square h-[78vh] max-h-[760px]">
        <svg viewBox="0 0 400 400" className="h-full w-full opacity-30">
          <circle cx="200" cy="200" r="196" fill="none" stroke="rgba(90,170,230,0.25)" strokeWidth="0.6" strokeDasharray="2 5" />
          <circle cx="200" cy="200" r="184" fill="none" stroke="rgba(90,170,230,0.18)" strokeWidth="0.5" />
          <path d="M 200 4 A 196 196 0 0 1 396 200" fill="none" stroke="rgba(127,243,255,0.6)" strokeWidth="1.4" strokeLinecap="round" className="animate-spin-slow" style={{ transformOrigin: "200px 200px" }} />
          <path d="M 200 396 A 196 196 0 0 1 4 200" fill="none" stroke="rgba(139,92,246,0.5)" strokeWidth="1.2" strokeLinecap="round" className="animate-spin-slower" style={{ transformOrigin: "200px 200px", animationDirection: "reverse" }} />
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * Math.PI * 2;
            const x1 = 200 + Math.cos(a) * 192, y1 = 200 + Math.sin(a) * 192;
            const x2 = 200 + Math.cos(a) * 198, y2 = 200 + Math.sin(a) * 198;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(120,180,255,0.35)" strokeWidth="0.6" />;
          })}
        </svg>
      </div>
    </div>
  );
}

function Radar() {
  return (
    <div className="pointer-events-none absolute bottom-40 left-3 z-10 hidden lg:block" aria-hidden>
      <div className="relative h-24 w-24 rounded-full border border-cyan-400/15 bg-cyan-400/5">
        <div className="absolute inset-3 rounded-full border border-cyan-400/10" />
        <div className="absolute inset-6 rounded-full border border-cyan-400/10" />
        <div className="absolute left-1/2 top-1/2 h-px w-1/2 origin-left animate-spin-slow bg-gradient-to-r from-cyan-300/70 to-transparent" />
        <span className="absolute -left-0.5 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-cyan-300/80" />
        <span className="tech-text absolute -bottom-5 left-0 text-[8px] tracking-[0.25em] text-dim/70">PROXIMITY</span>
      </div>
    </div>
  );
}

export function HudOverlay() {
  const state = useCore((s) => s.state);
  const metrics = useLive((s) => s.metrics);
  const stateLabel = { BOOT: "INITIALIZING", IDLE: "STANDBY", LISTENING: "LISTENING", THINKING: "THINKING", SPEAKING: "SPEAKING", EXECUTING: "EXECUTING", SUCCESS: "CONFIRMED", WARNING: "CAUTION", ERROR: "FAULT", OFFLINE: "OFFLINE" }[state];
  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden>
      <CenterArcs />
      <CornerBrackets />
      <Radar />
      <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 translate-y-[38vh] flex-col items-center gap-1 lg:flex">
        <span className="tech-text text-[9px] tracking-[0.4em] text-cyan-200/70 glow-cyan">{stateLabel}</span>
        <span className="tech-text text-[8px] tracking-[0.25em] text-dim/70">
          CPU {metrics ? metrics.cpu.toFixed(0) : "--"}% · MEM {metrics ? metrics.ram.usedPct.toFixed(0) : "--"}% · NET {metrics ? (metrics.network.rxRate / 1024).toFixed(0) : "--"} KB/s
        </span>
      </div>
    </div>
  );
}
