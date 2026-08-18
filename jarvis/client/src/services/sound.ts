// Subtle futuristic UI sounds synthesized with the Web Audio API.
// No audio files, no autoplay — the AudioContext is created lazily on first
// user gesture, and everything is muted when sound is disabled.
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
}
export function isSoundEnabled() {
  return enabled;
}

function getCtx(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface Tone {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  when?: number;
  glide?: number;
}

function play(tones: Tone[]) {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  for (const t of tones) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = t.type ?? "sine";
    const start = now + (t.when ?? 0);
    osc.frequency.setValueAtTime(t.freq, start);
    if (t.glide) osc.frequency.exponentialRampToValueAtTime(t.glide, start + t.dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(t.gain ?? 0.04, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
    osc.connect(g).connect(c.destination);
    osc.start(start);
    osc.stop(start + t.dur + 0.02);
  }
}

export const sfx = {
  hover: () => play([{ freq: 2200, dur: 0.04, gain: 0.012, type: "sine" }]),
  click: () => play([{ freq: 880, dur: 0.05, gain: 0.03, type: "triangle" }, { freq: 1320, dur: 0.06, gain: 0.02, type: "sine", when: 0.02 }]),
  send: () => play([{ freq: 520, dur: 0.12, gain: 0.04, type: "sine", glide: 940 }]),
  response: () => play([{ freq: 640, dur: 0.1, gain: 0.03, type: "sine", glide: 480 }]),
  success: () => play([{ freq: 660, dur: 0.09, gain: 0.035, type: "sine" }, { freq: 990, dur: 0.14, gain: 0.03, type: "sine", when: 0.09 }]),
  warning: () => play([{ freq: 320, dur: 0.14, gain: 0.035, type: "square" }, { freq: 240, dur: 0.16, gain: 0.03, type: "square", when: 0.1 }]),
  error: () => play([{ freq: 220, dur: 0.16, gain: 0.04, type: "sawtooth", glide: 140 }]),
  boot: () => play([
    { freq: 180, dur: 0.3, gain: 0.03, type: "sine", glide: 360 },
    { freq: 420, dur: 0.25, gain: 0.025, type: "sine", when: 0.28, glide: 720 },
    { freq: 620, dur: 0.4, gain: 0.02, type: "sine", when: 0.55, glide: 980 },
  ]),
};
