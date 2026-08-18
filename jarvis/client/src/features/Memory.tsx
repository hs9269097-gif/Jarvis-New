import { useEffect, useMemo, useState } from "react";
import { EmptyState, Tag, LoadingState } from "../components/ui";
import { Icon } from "../components/icons";
import { Frame } from "./Frame";
import { api } from "../services/api";
import { pushToast } from "../store";
import type { MemoryItem } from "../types";

const CATS = ["all", "short_term", "long_term", "project", "task"] as const;
const CAT_LABEL: Record<string, string> = { all: "ALL", short_term: "SHORT-TERM", long_term: "LONG-TERM", project: "PROJECT", task: "TASK" };
const CAT_TONE: Record<string, "cyan" | "violet" | "green" | "amber" | "gray"> = { short_term: "cyan", long_term: "violet", project: "green", task: "amber" };

export function Memory() {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [cat, setCat] = useState<(typeof CATS)[number]>("all");
  const [query, setQuery] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const refresh = async () => {
    setBusy(true);
    try { setItems((await api.memories()).memories); } catch { /* offline */ }
    setBusy(false);
  };
  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    return items.filter((m) => (cat === "all" || m.category === cat) && (!query || m.content.toLowerCase().includes(query.toLowerCase())));
  }, [items, cat, query]);

  const add = async () => {
    if (!content.trim()) return;
    await api.addMemory(content.trim(), "long_term", "normal");
    setContent("");
    refresh();
    pushToast("success", "MEMORY STORED", "Saved to long-term memory core.");
  };

  return (
    <Frame
      icon="memory"
      title="MEMORY CORE"
      subtitle="Short-term, long-term, project & task memory"
      right={
        <button onClick={() => { api.clearMemory(); refresh(); pushToast("info", "MEMORY CLEARED"); }} className="btn-ghost !px-2.5 !py-1.5 text-xs">
          <Icon name="trash" size={13} /> CLEAR
        </button>
      }
    >
      <div className="mb-4 space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`focus-ring rounded-md border px-2.5 py-1 text-[10px] tech-text tracking-[0.15em] transition-all ${cat === c ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-dim hover:text-mut"}`}>
              {CAT_LABEL[c]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search memory…" className="input" aria-label="Search memory" />
          <div className="relative flex-1">
            <input value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder='Remember something… e.g. "I prefer concise answers"' className="input" aria-label="New memory" />
          </div>
          <button onClick={add} className="btn-primary !px-4" aria-label="Store memory"><Icon name="plus" size={15} /></button>
        </div>
      </div>

      {busy ? (
        <LoadingState label="ACCESSING MEMORY CORE" />
      ) : filtered.length === 0 ? (
        <EmptyState icon="memory" title={items.length ? "NO MATCHING MEMORIES" : "JARVIS MEMORY IS CURRENTLY EMPTY"} hint="Store preferences, facts, project notes and task context — JARVIS will recall them later." />
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {filtered.map((m) => (
            <div key={m.id} className="glass-soft group relative rounded-lg border border-white/10 p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <Tag tone={CAT_TONE[m.category] ?? "gray"}>{CAT_LABEL[m.category] ?? m.category}</Tag>
                <span className="tech-text text-[9px] text-dim">{new Date(m.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              {editing === m.id ? (
                <div className="flex gap-1.5">
                  <input value={editText} onChange={(e) => setEditText(e.target.value)} className="input !py-1.5 text-xs" autoFocus />
                  <button onClick={async () => { await api.addMemory(editText, m.category, m.importance); api.deleteMemory(m.id); setEditing(null); refresh(); }} className="btn-primary !px-2 !py-1"><Icon name="check" size={12} /></button>
                </div>
              ) : (
                <p className="text-sm text-ink">{m.content}</p>
              )}
              <div className="mt-2 flex items-center justify-between">
                <div className="flex gap-1.5">
                  <Tag tone="gray">IMP:{String(m.importance).toUpperCase()}</Tag>
                  <Tag tone="gray">SRC:{String(m.source).toUpperCase()}</Tag>
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => { setEditing(m.id); setEditText(m.content); }} className="text-dim hover:text-cyan-300" aria-label="Edit"><Icon name="edit" size={13} /></button>
                  <button onClick={() => { api.deleteMemory(m.id); refresh(); }} className="text-dim hover:text-red-300" aria-label="Delete"><Icon name="trash" size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Frame>
  );
}
