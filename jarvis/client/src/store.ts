import { create } from "zustand";
import type {
  AgentState, ChatMessage, CoreState, Metrics, ProviderInfo, Quality, SectionId, Settings, ToolEvent,
} from "./types";
import { api } from "./services/api";
import { streamChat } from "./services/stream";
import { setSoundEnabled, sfx } from "./services/sound";
import { speak as speakTts, stopSpeaking as stopTts } from "./services/voice";

const uid = () => Math.random().toString(36).slice(2, 10);

// ── Core state machine (drives the 3D core + HUD) ────────────────────────────
interface CoreStore {
  state: CoreState;
  booted: boolean;
  audioLevel: number;
  quality: Quality;
  reducedMotion: boolean;
  sound: boolean;
  accent: string;
  coreFocus: number;
  setState: (s: CoreState) => void;
  flash: (s: CoreState, ms?: number) => void;
  setAudioLevel: (l: number) => void;
  setQuality: (q: Quality) => void;
  setReducedMotion: (v: boolean) => void;
  setSound: (v: boolean) => void;
  setAccent: (a: string) => void;
  setCoreFocus: (f: number) => void;
  setBooted: (v: boolean) => void;
}

export const useCore = create<CoreStore>((set, get) => ({
  state: "BOOT",
  booted: false,
  audioLevel: 0,
  quality: "high",
  reducedMotion: false,
  sound: true,
  accent: "cyan",
  coreFocus: 1,
  setState: (state) => set({ state }),
  flash: (state, ms = 1400) => {
    set({ state });
    window.setTimeout(() => {
      if (get().state === state) set({ state: "IDLE" });
    }, ms);
  },
  setAudioLevel: (audioLevel) => set({ audioLevel }),
  setQuality: (quality) => set({ quality }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setSound: (sound) => { setSoundEnabled(sound); set({ sound }); },
  setAccent: (accent) => set({ accent }),
  setCoreFocus: (coreFocus) => set({ coreFocus }),
  setBooted: (booted) => set({ booted }),
}));

// ── Navigation ────────────────────────────────────────────────────────────────
interface NavStore {
  section: SectionId;
  mobileOpen: boolean;
  setSection: (s: SectionId) => void;
  setMobileOpen: (v: boolean) => void;
}

export const useNav = create<NavStore>((set) => ({
  section: "home",
  mobileOpen: false,
  setSection: (section) => set({ section, mobileOpen: false }),
  setMobileOpen: (mobileOpen) => set({ mobileOpen }),
}));

// ── Chat ──────────────────────────────────────────────────────────────────────
interface ChatStore {
  messages: ChatMessage[];
  conversationId: string | null;
  streaming: boolean;
  agentState: AgentState | null;
  currentSteps: string[];
  currentTools: ToolEvent[];
  cancel: (() => void) | null;
  lastAnswer: string;
  doneTick: number;
  send: (message: string) => void;
  stop: () => void;
  clear: () => void;
  loadConversation: (id: string) => Promise<void>;
  addMessage: (m: ChatMessage) => void;
}

export const useChat = create<ChatStore>((set, get) => ({
  messages: [],
  conversationId: null,
  streaming: false,
  agentState: null,
  currentSteps: [],
  currentTools: [],
  cancel: null,
  lastAnswer: "",
  doneTick: 0,
  send: (message) => {
    if (get().streaming) return;
    const userMsg: ChatMessage = { id: uid(), role: "user", content: message, createdAt: Date.now() };
    const assistantMsg: ChatMessage = { id: uid(), role: "assistant", content: "", createdAt: Date.now(), streaming: true, toolEvents: [], steps: [] };
    set((s) => ({ messages: [...s.messages, userMsg, assistantMsg], streaming: true, currentSteps: [], currentTools: [], agentState: "ANALYZING" }));
    useCore.getState().setState("THINKING");
    if (useCore.getState().sound) sfx.send();

    // Use the temperature the user configured in Settings → AI instead of a
    // hardcoded 0.7 that silently ignored the slider.
    const temperature = useSettings.getState().settings.ai.temperature ?? 0.7;

    const handle = streamChat(message, get().conversationId, temperature, {
      onEvent: (e) => {
        const s = get();
        switch (e.type) {
          case "conversation":
            if (e.id) set({ conversationId: e.id });
            break;
          case "state": {
            const st = e.state as AgentState;
            set({ agentState: st });
            if (st === "ANALYZING" || st === "PLANNING" || st === "VERIFYING") useCore.getState().setState("THINKING");
            if (st === "EXECUTING") useCore.getState().setState("EXECUTING");
            if (st === "COMPLETED") {
              useCore.getState().flash("SUCCESS", 1600);
              if (useCore.getState().sound) sfx.success();
            }
            break;
          }
          case "plan":
            if (e.steps) {
              set((st) => ({ currentSteps: e.steps!, messages: st.messages.map((m) => (m.id === assistantMsg.id ? { ...m, steps: e.steps } : m)) }));
            }
            break;
          case "tool": {
            const ev: ToolEvent = { id: e.tool!.id, name: e.tool!.name, icon: e.tool!.icon, status: e.status as ToolEvent["status"], output: e.output, demo: e.demo };
            set((st) => {
              const tools = [...st.currentTools.filter((t) => t.id !== ev.id || t.status !== "done" && t.status !== "error"), ev];
              return { currentTools: tools, messages: st.messages.map((m) => (m.id === assistantMsg.id ? { ...m, toolEvents: tools } : m)) };
            });
            break;
          }
          case "delta":
            set((st) => ({ messages: st.messages.map((m) => (m.id === assistantMsg.id ? { ...m, content: m.content + (e.text ?? "") } : m)) }));
            break;
          case "done":
            set((st) => ({
              messages: st.messages.map((m) => (m.id === assistantMsg.id ? { ...m, content: e.answer || m.content, streaming: false } : m)),
              lastAnswer: e.answer || st.lastAnswer,
              doneTick: st.doneTick + 1,
              streaming: false,
            }));
            window.clearTimeout(safetyTimer);
            break;
          case "error":
            set((st) => ({
              // Stop the spinner on error too — previously `streaming` stayed
              // true, which locked the composer until the 90s timeout.
              streaming: false,
              messages: st.messages.map((m) => (m.id === assistantMsg.id ? { ...m, streaming: false, error: true } : m)),
            }));
            useCore.getState().flash("ERROR", 2200);
            pushToast("error", e.message || "JARVIS could not complete this operation.");
            if (useCore.getState().sound) sfx.error();
            window.clearTimeout(safetyTimer);
            break;
        }
      },
    });
    set({ cancel: handle.cancel });

    // Safety net: if the stream dies without a done/error event, release the UI.
    // Cleared on completion so a later reply is never cut off mid-stream.
    const safetyTimer = window.setTimeout(() => {
      if (!get().streaming) return;
      handle.cancel();
      set((x) => ({ streaming: false, messages: x.messages.map((m) => (m.id === assistantMsg.id ? { ...m, streaming: false } : m)) }));
      useCore.getState().setState("IDLE");
      pushToast("warning", "REQUEST TIMED OUT", "JARVIS did not respond in time. Please retry.");
    }, 180000);
  },
  stop: () => {
    get().cancel?.();
    set((s) => ({ streaming: false, messages: s.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m)) }));
    useCore.getState().setState("IDLE");
  },
  clear: () => set({ messages: [], conversationId: null, currentSteps: [], currentTools: [], agentState: null }),
  loadConversation: async (id) => {
    const { messages } = await api.conversation(id);
    set({
      conversationId: id,
      messages: messages.map((m) => ({ id: m.id, role: m.role as ChatMessage["role"], content: m.content, createdAt: m.createdAt })),
      currentSteps: [], currentTools: [], agentState: null,
    });
  },
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
}));

// ── Voice ─────────────────────────────────────────────────────────────────────
interface VoiceStore {
  active: boolean;
  listening: boolean;
  speaking: boolean;
  transcript: string;
  autoSpeak: boolean;
  supported: { stt: boolean; tts: boolean };
  setActive: (v: boolean) => void;
  setListening: (v: boolean) => void;
  setSpeaking: (v: boolean) => void;
  setTranscript: (t: string) => void;
  setAutoSpeak: (v: boolean) => void;
  speak: (text: string) => void;
  stopAll: () => void;
}

export const useVoice = create<VoiceStore>((set, get) => ({
  active: false,
  listening: false,
  speaking: false,
  transcript: "",
  autoSpeak: false,
  supported: { stt: false, tts: "speechSynthesis" in window },
  setActive: (active) => set({ active }),
  setListening: (listening) => set({ listening }),
  setSpeaking: (speaking) => set({ speaking }),
  setTranscript: (transcript) => set({ transcript }),
  setAutoSpeak: (autoSpeak) => set({ autoSpeak }),
  speak: (text) => {
    set({ speaking: true });
    useCore.getState().setState("SPEAKING");
    const started = speakTts(text, {
      rate: 1, volume: 0.95,
      onEnd: () => { set({ speaking: false }); if (useCore.getState().state === "SPEAKING") useCore.getState().setState("IDLE"); },
    });
    if (!started) {
      set({ speaking: false });
      useCore.getState().setState("IDLE");
    }
  },
  stopAll: () => {
    stopTts();
    set({ speaking: false, listening: false });
  },
}));

// ── Settings ──────────────────────────────────────────────────────────────────
interface SettingsStore {
  settings: Settings;
  provider: ProviderInfo | null;
  loaded: boolean;
  load: () => Promise<void>;
  save: (patch: Partial<Settings>) => Promise<void>;
  selectProvider: (id: string) => Promise<string | null>;
  setProviderInfo: (p: ProviderInfo) => void;
}

const defaultSettings: Settings = {
  ai: { model: "auto", temperature: 0.7, style: "Professional & concise", systemInstructions: "" },
  voice: { voice: "default", speed: 1, volume: 0.9, wakeWord: "Jarvis", autoListen: false },
  appearance: { accent: "cyan", quality: "high", animations: true, reducedMotion: false },
  memory: { enabled: true, autoSave: true },
  notifications: { desktop: false, tasks: true },
};

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,
  provider: null,
  loaded: false,
  load: async () => {
    try {
      const [s, p] = await Promise.all([api.settings(), api.providers()]);
      set({ settings: { ...defaultSettings, ...s.settings }, provider: p, loaded: true });
      applySettings(get().settings);
    } catch {
      set({ loaded: true });
    }
  },
  save: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    applySettings(next);
    try { await api.saveSettings(next); } catch { /* offline-tolerant */ }
  },
  selectProvider: async (id) => {
    try {
      const r = await api.selectProvider(id);
      set({ provider: r.status });
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  },
  setProviderInfo: (provider) => set({ provider }),
}));

function applySettings(s: Settings) {
  useCore.getState().setQuality(s.appearance.quality);
  useCore.getState().setReducedMotion(s.appearance.reducedMotion);
  useCore.getState().setAccent(s.appearance.accent);
  useVoice.getState().setAutoSpeak(Boolean((s.voice as { autoSpeak?: boolean }).autoSpeak));
}

// ── Real-time metrics / events ────────────────────────────────────────────────
interface LiveStore {
  metrics: Metrics | null;
  securityEvents: { kind: string; message: string; at: number; demo?: boolean }[];
  setMetrics: (m: Metrics) => void;
  pushSecurityEvent: (e: { kind: string; message: string; at: number; demo?: boolean }) => void;
}

export const useLive = create<LiveStore>((set) => ({
  metrics: null,
  securityEvents: [],
  setMetrics: (metrics) => set({ metrics }),
  pushSecurityEvent: (e) => set((s) => ({ securityEvents: [e, ...s.securityEvents].slice(0, 30) })),
}));

// ── Toasts ────────────────────────────────────────────────────────────────────
interface Toast {
  id: string;
  kind: "info" | "success" | "warning" | "error";
  title: string;
  detail?: string;
}
interface ToastStore {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}
export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    window.setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 5200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export function pushToast(kind: Toast["kind"], title: string, detail?: string) {
  useToasts.getState().push({ kind, title, detail });
}

// ── Metrics history ring for sparklines ───────────────────────────────────────
export const metricsHistory: number[] = new Array(60).fill(0);
export function recordMetrics(m: Metrics) {
  metricsHistory.push(m.cpu);
  if (metricsHistory.length > 60) metricsHistory.shift();
  useLive.getState().setMetrics(m);
}
