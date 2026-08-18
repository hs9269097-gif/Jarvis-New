import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AIMessage } from "../components/AIMessage";
import { EmptyState, Tag } from "../components/ui";
import { Icon } from "../components/icons";
import { useChat, useCore, useNav } from "../store";
import { api } from "../services/api";
import { sfx } from "../services/sound";

interface Conv { id: string; title: string; preview: string; lastMessageAt: number; }

export function Chat() {
  const { messages, streaming, agentState, send, clear, loadConversation, conversationId } = useChat();
  const setSection = useNav((s) => s.setSection);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");

  const refresh = async () => {
    try { setConvs((await api.conversations()).conversations); } catch { /* offline */ }
  };
  useEffect(() => { refresh(); }, [messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const onRetry = () => { if (lastUserMsg) send(lastUserMsg.content); };

  return (
    <div className="relative mx-auto flex h-full max-w-4xl flex-col px-3 pt-16 pb-36 sm:px-6">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag tone={streaming ? "violet" : "cyan"}>{streaming ? agentState ?? "WORKING" : "READY"}</Tag>
          <span className="tech-text text-[10px] tracking-[0.25em] text-dim">{messages.length} MESSAGES</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setHistoryOpen(!historyOpen)} className="btn-ghost !px-2.5 !py-1.5 text-xs" aria-label="Conversation history">
            <Icon name="logs" size={13} /> HISTORY
          </button>
          <button onClick={() => { clear(); setSection("home"); }} className="btn-ghost !px-2.5 !py-1.5 text-xs" aria-label="New conversation">
            <Icon name="plus" size={13} /> NEW
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <EmptyState
            icon="chat"
            title="NO ACTIVE CONVERSATION"
            hint="Command JARVIS below — search the web, run code, manage tasks, or simply talk."
          />
        ) : (
          messages.map((m) => <AIMessage key={m.id} message={m} onRetry={onRetry} />)
        )}
      </div>

      {/* History drawer */}
      <AnimatePresence>
        {historyOpen && (
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className="glass absolute right-3 top-16 z-20 flex max-h-[60vh] w-72 flex-col rounded-xl p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="tech-text text-[10px] tracking-[0.25em] text-mut">CONVERSATIONS</span>
              <button onClick={() => setHistoryOpen(false)} aria-label="Close history" className="text-dim hover:text-white"><Icon name="x" size={13} /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {convs.length === 0 && <p className="text-xs text-dim">No saved conversations.</p>}
              {convs.map((c) => (
                <div key={c.id} className={`group flex items-center gap-2 rounded-lg border p-2 ${c.id === conversationId ? "border-cyan-400/30 bg-cyan-400/10" : "border-white/5 hover:border-white/15"}`}>
                  <button onClick={() => { loadConversation(c.id); setHistoryOpen(false); }} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-xs text-ink">{c.title}</p>
                    <p className="truncate text-[10px] text-dim">{c.preview}</p>
                  </button>
                  <button onClick={() => { api.deleteConversation(c.id); refresh(); if (c.id === conversationId) clear(); }} aria-label="Delete conversation" className="text-dim opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100">
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Streaming hint */}
      {streaming && (
        <div className="pointer-events-none absolute bottom-28 left-1/2 -translate-x-1/2">
          <span className="tech-text text-[9px] tracking-[0.3em] text-violet-300/70 animate-pulse-soft">JARVIS {agentState ?? "PROCESSING"}…</span>
        </div>
      )}
    </div>
  );
}
