import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./icons";
import { GROUPS, SECTIONS } from "../sections";
import { useNav } from "../store";
import { sfx } from "../services/sound";

function NavItem({ id, label, icon, collapsed }: { id: string; label: string; icon: Parameters<typeof Icon>[0]["name"]; collapsed: boolean }) {
  const active = useNav((s) => s.section === id);
  const setSection = useNav((s) => s.setSection);
  return (
    <button
      onClick={() => { setSection(id as never); sfx.click(); }}
      onMouseEnter={() => sfx.hover()}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`focus-ring group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-all duration-200 ${
        active ? "text-cyan-200" : "text-mut hover:text-ink"
      }`}
    >
      {active && (
        <motion.span
          layoutId="nav-glow"
          className="absolute inset-0 rounded-lg border border-cyan-400/30 bg-gradient-to-r from-cyan-400/15 to-transparent shadow-[0_0_20px_-6px_rgba(34,211,238,0.5)]"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <span className={`relative grid h-6 w-6 shrink-0 place-items-center ${active ? "text-cyan-300" : "text-dim group-hover:text-mut"}`}>
        <Icon name={icon} size={16} />
      </span>
      <span className={`relative tech-text text-[11px] tracking-[0.16em] whitespace-nowrap transition-all ${collapsed ? "w-0 overflow-hidden opacity-0" : "opacity-100"}`}>
        {label}
      </span>
    </button>
  );
}

export function DesktopNav() {
  const [collapsed, setCollapsed] = useState(false);
  const section = useNav((s) => s.section);
  const activeLabel = SECTIONS.find((s) => s.id === section)?.label ?? "HOME";
  return (
    <nav
      className={`absolute left-3 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-1 rounded-xl p-2 transition-all duration-300 md:flex glass ${collapsed ? "w-14" : "w-52"}`}
      aria-label="Primary navigation"
    >
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="tech-text text-[9px] tracking-[0.3em] text-dim">{collapsed ? "JRS" : `SECTOR // ${activeLabel.toUpperCase()}`}</span>
        <button onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} className="focus-ring text-dim hover:text-cyan-300">
          <Icon name={collapsed ? "activity" : "x"} size={13} />
        </button>
      </div>
      {GROUPS.map((g) => (
        <div key={g.id} className="flex flex-col gap-0.5">
          {!collapsed && <span className="px-2.5 pb-1 pt-2 tech-text text-[8px] tracking-[0.3em] text-dim/70">{g.label}</span>}
          {SECTIONS.filter((s) => s.group === g.id).map((s) => (
            <NavItem key={s.id} id={s.id} label={s.label} icon={s.icon} collapsed={collapsed} />
          ))}
        </div>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const section = useNav((s) => s.section);
  const setSection = useNav((s) => s.setSection);
  const [open, setOpen] = useState(false);
  const quick = ["home", "chat", "voice", "tasks", "settings"];
  return (
    <>
      <nav className="absolute inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-white/10 bg-[#060b14]/90 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Mobile navigation">
        {quick.map((id) => {
          const meta = SECTIONS.find((s) => s.id === id)!;
          const active = section === id;
          return (
            <button
              key={id}
              onClick={() => setSection(id as never)}
              aria-label={meta.label}
              className={`focus-ring flex flex-col items-center gap-0.5 px-2 py-2 ${active ? "text-cyan-300" : "text-dim"}`}
            >
              <span className={`grid h-7 w-7 place-items-center rounded-md ${active ? "bg-cyan-400/10" : ""}`}>
                <Icon name={meta.icon} size={17} />
              </span>
              <span className="tech-text text-[8px] tracking-[0.14em]">{meta.label}</span>
            </button>
          );
        })}
        <button onClick={() => setOpen(true)} aria-label="More sections" className="focus-ring flex flex-col items-center gap-0.5 px-2 py-2 text-dim">
          <span className="grid h-7 w-7 place-items-center rounded-md"><Icon name="layers" size={17} /></span>
          <span className="tech-text text-[8px] tracking-[0.14em]">MORE</span>
        </button>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="absolute bottom-0 inset-x-0 rounded-t-2xl glass p-4 pb-[env(safe-area-inset-bottom)]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />
              <div className="grid grid-cols-3 gap-2">
                {SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSection(s.id); setOpen(false); }}
                    className={`focus-ring flex flex-col items-center gap-1.5 rounded-lg border p-3 ${section === s.id ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-mut"}`}
                  >
                    <Icon name={s.icon} size={18} />
                    <span className="tech-text text-[9px] tracking-[0.12em]">{s.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
