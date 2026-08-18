import { useEffect, useRef, useState } from "react";
import { EmptyState, Tag } from "../components/ui";
import { Icon } from "../components/icons";
import { Frame } from "./Frame";
import { api } from "../services/api";
import { pushToast } from "../store";
import type { FileItem } from "../types";

function fmtBytes(n: number) {
  if (n > 1_048_576) return (n / 1_048_576).toFixed(1) + " MB";
  if (n > 1024) return (n / 1024).toFixed(1) + " KB";
  return n + " B";
}

export function Files() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [sel, setSel] = useState<FileItem | null>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => { try { setFiles((await api.files()).files); } catch { /* offline */ } };
  useEffect(() => { refresh(); }, []);

  const upload = async (f: File) => {
    if (f.size > 12 * 1024 * 1024) { pushToast("error", "File too large", "12 MB maximum."); return; }
    setProgress(0);
    const buf = await f.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      setProgress(Math.min(95, (i / bytes.length) * 95));
      await new Promise((r) => setTimeout(r, 0));
    }
    const b64 = btoa(binary);
    try {
      setProgress(98);
      const r = await api.uploadFile(f.name, f.type, f.size, b64);
      setProgress(100);
      refresh();
      setSel(r.file);
      pushToast("success", "FILE ANALYZED", `${f.name} processed by the intelligence layer.`);
    } catch (e) {
      pushToast("error", "Upload failed", (e as Error).message);
    }
    setTimeout(() => setProgress(null), 800);
  };

  return (
    <Frame icon="files" title="FILE INTELLIGENCE" subtitle="Upload, analyze & interrogate documents">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
        onClick={() => inputRef.current?.click()}
        className={`mb-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all ${drag ? "border-cyan-300/70 bg-cyan-400/10" : "border-white/10 hover:border-cyan-400/40 hover:bg-cyan-400/5"}`}
      >
        <input ref={inputRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        <Icon name="upload" size={26} className="text-cyan-300" />
        <p className="mt-2 text-sm text-ink">Drop a file here, or <span className="text-cyan-300">browse</span></p>
        <p className="mt-1 text-[11px] text-dim">PDF · TXT · MD · CSV · JSON · CODE · IMAGES — up to 12 MB</p>
        {progress !== null && (
          <div className="mt-3 h-1 w-56 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* File list */}
        <div className="space-y-2">
          {files.length === 0 ? (
            <EmptyState icon="files" title="NO FILES ANALYZED" hint="Upload a document and JARVIS will summarize it, extract key information and suggest actions." />
          ) : (
            files.map((f) => (
              <button key={f.id} onClick={() => setSel(f)} className={`focus-ring flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${sel?.id === f.id ? "border-cyan-400/40 bg-cyan-400/10" : "border-white/10 hover:border-white/15"}`}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-cyan-400/15 bg-cyan-400/5 text-cyan-300">
                  <Icon name={f.kind === "image" ? "image" : f.kind === "pdf" ? "files" : "code"} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{f.name}</span>
                  <span className="tech-text block text-[9px] tracking-[0.15em] text-dim">{f.kind.toUpperCase()} · {fmtBytes(f.size)}</span>
                </span>
                <button onClick={(e) => { e.stopPropagation(); api.deleteFile(f.id); refresh(); setSel(null); }} className="text-dim hover:text-red-300" aria-label="Delete file"><Icon name="trash" size={14} /></button>
              </button>
            ))
          )}
        </div>

        {/* Analysis */}
        <div className="glass-soft rounded-lg border border-white/10 p-4">
          <p className="tech-text mb-2 text-[10px] tracking-[0.25em] text-mut">ANALYSIS</p>
          {!sel ? (
            <EmptyState icon="activity" title="SELECT A FILE" hint="Extracted summary, key information and suggested actions appear here." />
          ) : sel.analysis.kind === "image" ? (
            <div>
              <Tag tone="amber">IMAGE</Tag>
              <p className="mt-2 text-sm text-mut">{sel.analysis.note}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-mut">
                <p>Type: <span className="text-ink">{sel.type}</span></p>
                <p>Size: <span className="text-ink">{fmtBytes(sel.size)}</span></p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Tag tone="cyan">{sel.analysis.wordCount ?? 0} WORDS</Tag>
                <Tag tone="violet">{sel.analysis.readingMinutes ?? 0} MIN READ</Tag>
                <Tag tone="green">{sel.analysis.sentenceCount ?? 0} SENTENCES</Tag>
              </div>
              <div>
                <p className="tech-text mb-1 text-[9px] tracking-[0.25em] text-dim">SUMMARY</p>
                <p className="text-xs leading-5 text-mut">{sel.analysis.summary}</p>
              </div>
              {sel.analysis.keywords && sel.analysis.keywords.length > 0 && (
                <div>
                  <p className="tech-text mb-1 text-[9px] tracking-[0.25em] text-dim">KEY TERMS</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sel.analysis.keywords.slice(0, 8).map((k) => (
                      <span key={k.word} className="rounded border border-cyan-400/20 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] text-cyan-200">{k.word} <span className="text-dim">×{k.count}</span></span>
                    ))}
                  </div>
                </div>
              )}
              {sel.analysis.preview && (
                <div>
                  <p className="tech-text mb-1 text-[9px] tracking-[0.25em] text-dim">PREVIEW</p>
                  <pre className="max-h-32 overflow-y-auto rounded bg-black/30 p-2 font-mono text-[10px] leading-4 text-cyan-100/60">{sel.analysis.preview}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Frame>
  );
}
