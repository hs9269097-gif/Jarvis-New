import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCore } from "../store";
import { sfx } from "../services/sound";

const LINES = [
  "INITIALIZING JARVIS...",
  "LOADING AI CORE...",
  "SECURITY SYSTEM ONLINE",
  "MEMORY SYSTEM ONLINE",
  "TOOL SYSTEM ONLINE",
  "VOICE SYSTEM ONLINE",
  "ALL SYSTEMS OPERATIONAL",
  "JARVIS ONLINE",
];

export function BootSequence() {
  const setBooted = useCore((s) => s.setBooted);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [skip, setSkip] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (idx >= LINES.length) {
      timer.current = window.setTimeout(() => setDone(true), 500);
      return;
    }
    timer.current = window.setTimeout(() => setIdx((i) => i + 1), idx === 0 ? 350 : 320);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [idx]);

  useEffect(() => {
    if (done || skip) {
      sfx.boot();
      setBooted(true);
      useCore.getState().setState("IDLE");
    }
  }, [done, skip, setBooted]);

  const progress = Math.min(100, (idx / LINES.length) * 100);

  return (
    <AnimatePresence>
      {!(done || skip) && (
        <motion.div
          className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#04070d]"
          exit={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          role="status"
          aria-label="JARVIS starting up"
        >
          <div className="scanlines absolute inset-0" />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative mb-8 grid h-28 w-28 place-items-center"
          >
            <span className="absolute inset-0 animate-spin-slow rounded-full border border-cyan-400/40" style={{ borderTopColor: "transparent", borderBottomColor: "transparent" }} />
            <span className="absolute inset-3 animate-spin-slower rounded-full border border-violet-400/30" style={{ borderLeftColor: "transparent", borderRightColor: "transparent", animationDirection: "reverse" }} />
            <span className="absolute inset-6 animate-spin-slow rounded-full border border-cyan-300/25" style={{ borderTopColor: "transparent" }} />
            <span className="h-4 w-4 rounded-full bg-cyan-300 shadow-[0_0_30px_8px_rgba(34,211,238,0.5)]" />
          </motion.div>

          <span className="tech-text text-lg font-semibold tracking-[0.5em] text-white glow-cyan">JARVIS</span>
          <span className="tech-text mt-1 text-[9px] tracking-[0.4em] text-dim">PERSONAL AI COMMAND CENTER</span>

          <div className="mt-8 h-40 w-72 font-mono text-[10px] leading-6 tracking-[0.14em]">
            {LINES.slice(0, idx).map((l, i) => (
              <motion.p key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className={l.includes("ONLINE") || l === "JARVIS ONLINE" ? "text-cyan-300" : "text-mut"}>
                <span className="text-dim">▸ </span>{l}
              </motion.p>
            ))}
            <span className="inline-block h-4 w-2 animate-pulse bg-cyan-300 align-middle" />
          </div>

          <div className="mt-4 h-0.5 w-72 overflow-hidden rounded-full bg-white/5">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>

          <button onClick={() => setSkip(true)} className="focus-ring mt-6 text-[10px] tracking-[0.3em] text-dim hover:text-cyan-300 transition-colors">
            SKIP INTRO ▸
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
