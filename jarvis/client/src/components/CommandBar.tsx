import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Icon, type IconName } from "./icons";
import { useChat, useCore, useNav, useVoice, pushToast } from "../store";
import { api } from "../services/api";
import { sfx } from "../services/sound";
import { startListening, stopListening } from "../services/voice";

const QUICK_TOOLS: { id: string; label: string; icon: IconName; prefix: string }[] = [
  { id: "web_search", label: "Search", icon: "globe", prefix: "JARVIS, search the web for " },
  { id: "calculator", label: "Calculate", icon: "sigma", prefix: "JARVIS, calculate " },
  { id: "code_runner", label: "Run code", icon: "code", prefix: "JARVIS, run this code:\n```js\n\n```" },
  { id: "memory", label: "Remember", icon: "database", prefix: "JARVIS, remember " },
  { id: "task", label: "Task", icon: "tasks", prefix: "JARVIS, create a task: " },
  { id: "security_scan", label: "Security", icon: "shield", prefix: "JARVIS, run a security check" },
];

export function CommandBar() {
  const [value, setValue] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const send = useChat((s) => s.send);
  const streaming = useChat((s) => s.streaming);
  const listening = useVoice((s) => s.listening);
  const setListening = useVoice((s) => s.setListening);
  const setTranscript = useVoice((s) => s.setTranscript);
  const setSection = useNav((s) => s.setSection);
  const setState = useCore((s) => s.setState);

  const submit = (text?: string) => {
    const msg = (text ?? value).trim();
    if (!msg || streaming) return;
    setValue("");
    setSection("chat");
    send(msg);
  };

  const toggleMic = () => {
    if (listening) {
      stopListening();
      setListening(false);
      setState("IDLE");
      return;
    }
    setListening(true);
    setState("LISTENING");
    sfx.click();
    startListening({
      onAudio: (l) => useCore.getState().setAudioLevel(l),
      onResult: (text) => {
        setTranscript(text);
        setListening(false);
        setState("IDLE");
        submit(text);
      },
      onEnd: () => {
        setListening(false);
        if (useCore.getState().state === "LISTENING") useCore.getState().setState("IDLE");
      },
    });
  };

  const onFile = async (f: File) => {
    if (f.size > 12 * 1024 * 1024) { pushToast("error", "File too large", "Maximum upload size is 12 MB."); return; }
    pushToast("info", "ANALYZING DATA", `Uploading ${f.name}…`);
    const buf = await f.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    const b64 = btoa(binary);
    try {
      await api.uploadFile(f.name, f.type, f.size, b64);
      pushToast("success", "FILE ANALYZED", `${f.name} is ready for inspection.`);
      submit(`JARVIS, analyze the file "${f.name}" that I just uploaded.`);
    } catch (e) {
      pushToast("error", "Upload failed", (e as Error).message);
    }
  };

  return (
    <div className="pointer-events-auto relative">
      <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="glass relative flex items-center gap-1.5 rounded-xl px-2 py-2 sm:px-3"
      >
        <div className="pointer-events-none absolute -inset-px rounded-xl bg-gradient-to-r from-cyan-400/0 via-cyan-400/10 to-cyan-400/0 opacity-60" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder='Command JARVIS…'
          aria-label="Command JARVIS"
          className="min-w-0 flex-1 bg-transparent px-2 text-sm text-ink placeholder:text-dim outline-none"
        />
        <button onClick={() => setToolsOpen(!toolsOpen)} aria-label="Select tool" className="focus-ring hidden h-8 w-8 place-items-center rounded-md text-mut hover:text-cyan-300 sm:grid">
          <Icon name="zap" size={16} />
        </button>
        <button onClick={() => fileRef.current?.click()} aria-label="Upload file" className="focus-ring grid h-8 w-8 place-items-center rounded-md text-mut hover:text-cyan-300">
          <Icon name="upload" size={16} />
        </button>
        <button onClick={toggleMic} aria-label={listening ? "Stop listening" : "Voice command"} className={`focus-ring grid h-8 w-8 place-items-center rounded-md ${listening ? "bg-cyan-400/20 text-cyan-200 shadow-[0_0_14px_-2px_#22d3ee]" : "text-mut hover:text-cyan-300"}`}>
          <Icon name="mic" size={16} />
        </button>
        <button
          onClick={() => submit()}
          disabled={!value.trim() || streaming}
          aria-label="Send command"
          className="btn-primary h-9 w-9 !p-0 disabled:opacity-30"
        >
          <Icon name="send" size={15} />
        </button>
      </motion.div>

      {toolsOpen && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass absolute bottom-full left-0 mb-2 grid w-64 grid-cols-2 gap-1 rounded-xl p-2"
        >
          {QUICK_TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setValue(t.prefix); setToolsOpen(false); inputRef.current?.focus(); }}
              className="focus-ring flex items-center gap-2 rounded-lg px-2 py-2 text-left text-mut hover:bg-cyan-400/10 hover:text-cyan-200"
            >
              <Icon name={t.icon} size={15} />
              <span className="tech-text text-[10px] tracking-[0.12em]">{t.label}</span>
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
