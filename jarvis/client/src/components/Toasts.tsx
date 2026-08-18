import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./icons";
import { useToasts } from "../store";

const KIND_STYLE = {
  info: "border-cyan-400/30 text-cyan-200",
  success: "border-emerald-400/30 text-emerald-200",
  warning: "border-amber-400/30 text-amber-200",
  error: "border-red-400/30 text-red-200",
} as const;
const KIND_ICON = { info: "activity", success: "check", warning: "alert", error: "alert" } as const;

export function Toasts() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none absolute right-3 top-16 z-50 flex w-72 flex-col gap-2" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            className={`glass pointer-events-auto flex items-start gap-2.5 rounded-lg border p-3 ${KIND_STYLE[t.kind]}`}
          >
            <Icon name={KIND_ICON[t.kind]} size={15} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="tech-text text-[10px] tracking-[0.2em]">{t.title}</p>
              {t.detail && <p className="mt-0.5 text-xs text-mut">{t.detail}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="focus-ring text-dim hover:text-white"><Icon name="x" size={13} /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
