import { useEffect, useState } from "react";
import { EmptyState, Tag, Toggle } from "../components/ui";
import { Icon } from "../components/icons";
import { Frame } from "./Frame";
import { api } from "../services/api";
import { pushToast } from "../store";
import type { AutomationItem } from "../types";

const TRIGGERS = ["file_uploaded", "error_detected", "daily_briefing", "project_monitor", "manual"];
const ACTIONS = ["summarize", "analyze_error", "generate_report", "notify", "create_task"];

const STAGES = [
  { key: "TRIGGER", icon: "zap" as const, label: "TRIGGER" },
  { key: "CONDITIONS", icon: "filter" as const, label: "CONDITIONS" },
  { key: "AI ACTION", icon: "activity" as const, label: "AI ACTION" },
  { key: "TOOL ACTION", icon: "tools" as const, label: "TOOL" },
  { key: "VERIFY", icon: "check" as const, label: "VERIFY" },
  { key: "NOTIFY", icon: "send" as const, label: "NOTIFY" },
];

export function Automation() {
  const [items, setItems] = useState<AutomationItem[]>([]);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("file_uploaded");
  const [conditions, setConditions] = useState("");
  const [action, setAction] = useState("summarize");

  const refresh = async () => { try { setItems((await api.automations()).automations); } catch { /* offline */ } };
  useEffect(() => { refresh(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    await api.createAutomation({ name: name.trim(), trigger, conditions: conditions.split(",").map((s) => s.trim()).filter(Boolean), actions: [action] });
    setName(""); setConditions("");
    refresh();
    pushToast("success", "AUTOMATION DEPLOYED", `${name} is now active.`);
  };

  const preset = (n: string, t: string, a: string) => { setName(n); setTrigger(t); setAction(a); };

  return (
    <Frame icon="automation" title="AUTOMATION ENGINE" subtitle="Trigger → Conditions → AI action → Tool → Verify → Notify">
      <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="glass-soft rounded-lg border border-white/10 p-3 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <span className="tech-text text-[10px] tracking-[0.25em] text-mut">NEW WORKFLOW</span>
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Workflow name…" className="input mb-2" aria-label="Workflow name" />
          <div className="mb-2 grid grid-cols-2 gap-2">
            <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className="input" aria-label="Trigger">
              {TRIGGERS.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ").toUpperCase()}</option>)}
            </select>
            <select value={action} onChange={(e) => setAction(e.target.value)} className="input" aria-label="Action">
              {ACTIONS.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ").toUpperCase()}</option>)}
            </select>
          </div>
          <input value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="Conditions (comma separated), e.g. type=pdf, size>1MB" className="input mb-2" aria-label="Conditions" />
          <button onClick={create} className="btn-primary w-full"><Icon name="plus" size={14} /> DEPLOY AUTOMATION</button>
        </div>

        {/* Visual pipeline */}
        <div className="glass-soft flex flex-col justify-center rounded-lg border border-white/10 p-3">
          <p className="tech-text mb-3 text-[10px] tracking-[0.25em] text-dim">PIPELINE PREVIEW</p>
          <div className="flex flex-col gap-1.5">
            {STAGES.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-md border border-cyan-400/20 bg-cyan-400/5 text-cyan-300"><Icon name={s.icon} size={13} /></span>
                <span className="tech-text text-[9px] tracking-[0.15em] text-mut">{s.label}</span>
                {i < STAGES.length - 1 && <span className="mx-auto h-3 w-px bg-gradient-to-b from-cyan-400/40 to-transparent" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        <span className="tech-text text-[9px] tracking-[0.25em] text-dim self-center">PRESETS:</span>
        <button onClick={() => preset("File summary bot", "file_uploaded", "summarize")} className="btn-ghost !px-2.5 !py-1 text-[10px]">WHEN FILE UPLOADED → SUMMARIZE</button>
        <button onClick={() => preset("Daily briefing", "daily_briefing", "generate_report")} className="btn-ghost !px-2.5 !py-1 text-[10px]">EVERY MORNING → BRIEFING</button>
        <button onClick={() => preset("Error sentinel", "error_detected", "analyze_error")} className="btn-ghost !px-2.5 !py-1 text-[10px]">ON ERROR → ANALYZE</button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon="automation" title="NO AUTOMATION WORKFLOWS CREATED" hint="Define triggers, conditions and actions above, or start from a preset." />
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <div key={a.id} className="glass-soft flex items-center gap-3 rounded-lg border border-white/10 p-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-400/15 bg-cyan-400/5 text-cyan-300"><Icon name="automation" size={16} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{a.name}</p>
                <p className="tech-text mt-0.5 truncate text-[9px] tracking-[0.15em] text-dim">
                  {String(a.trigger).replace(/_/g, " ").toUpperCase()} → {String(a.actions.join(", ")).replace(/_/g, " ").toUpperCase()}
                </p>
              </div>
              <Tag tone="gray">RUNS {a.runs}</Tag>
              <Toggle checked={a.enabled} onChange={(v) => { api.updateAutomation(a.id, { enabled: v }); refresh(); }} label="Enable" />
              <button onClick={() => { api.deleteAutomation(a.id); refresh(); }} className="text-dim hover:text-red-300" aria-label="Delete"><Icon name="trash" size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </Frame>
  );
}
