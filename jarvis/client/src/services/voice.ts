// Voice service — SpeechRecognition (STT) + speechSynthesis (TTS).
// Falls back gracefully when the browser blocks microphone access or when
// running inside a restricted preview: a simulated listening cycle keeps the
// voice experience fully demonstrable.

declare global {
  interface Window { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown; }
}

export const voiceSupported = {
  get stt(): boolean {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  },
  get tts(): boolean {
    return "speechSynthesis" in window;
  },
};

let recognition: { stop: () => void; abort: () => void } | null = null;
let onResultCb: ((text: string) => void) | null = null;
let onEndCb: (() => void) | null = null;
let onAudioCb: ((level: number) => void) | null = null;

export function startListening(opts: { onResult: (t: string) => void; onEnd: () => void; onAudio?: (l: number) => void }): boolean {
  onResultCb = opts.onResult;
  onEndCb = opts.onEnd;
  onAudioCb = opts.onAudio ?? null;

  // Try real microphone via SpeechRecognition
  const Ctor = (window.SpeechRecognition || window.webkitSpeechRecognition) as (new () => { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number; start: () => void; stop: () => void; abort: () => void; onresult: ((e: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null; }) | undefined;
  if (Ctor) {
    try {
      const rec = new Ctor();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        let final = "";
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) final += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (interim && onAudioCb) onAudioCb(0.3 + Math.random() * 0.5);
        if (final) onResultCb?.(final.trim());
      };
      rec.onend = () => onEndCb?.();
      rec.onerror = () => onEndCb?.();
      rec.start();
      recognition = rec;
      return true;
    } catch {
      recognition = null;
    }
  }
  // Simulated listening for restricted environments
  let acc = "";
  const words = ["command", "JARVIS", "status", "report", "system", "analyze", "search", "task"];
  const iv = setInterval(() => {
    if (onAudioCb) onAudioCb(0.15 + Math.random() * 0.7);
  }, 120);
  setTimeout(() => {
    clearInterval(iv);
    acc = words[Math.floor(Math.random() * words.length)] + " " + words[Math.floor(Math.random() * words.length)];
    onResultCb?.("Demo voice input: \"" + acc + "\" — open your browser with microphone permission for real speech-to-text.");
    onEndCb?.();
  }, 2600);
  return false;
}

export function stopListening() {
  try { recognition?.stop(); } catch { /* ignore */ }
  recognition = null;
}

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speak(text: string, opts: { rate?: number; volume?: number; onEnd?: () => void } = {}) {
  if (!voiceSupported.tts) {
    opts.onEnd?.();
    return false;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[#*_`>\[\]()]/g, ""));
  u.rate = opts.rate ?? 1;
  u.volume = opts.volume ?? 0.9;
  u.pitch = 1.02;
  const voices = synth.getVoices();
  const preferred = voices.find((v) => /google uk english male|daniel|alex|en-gb/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith("en"));
  if (preferred) u.voice = preferred;
  u.onend = () => opts.onEnd?.();
  u.onerror = () => opts.onEnd?.();
  currentUtterance = u;
  synth.speak(u);
  return true;
}

export function stopSpeaking() {
  if (voiceSupported.tts) window.speechSynthesis.cancel();
  currentUtterance = null;
}
