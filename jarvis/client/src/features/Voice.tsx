import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "../components/icons";
import { Tag, Toggle } from "../components/ui";
import { useChat, useCore, useVoice } from "../store";
import { startListening, stopListening, voiceSupported } from "../services/voice";
import { sfx } from "../services/sound";

export function Voice() {
  const { listening, speaking, transcript, autoSpeak, setListening, setTranscript, setAutoSpeak, speak, stopAll } = useVoice();
  const { send, streaming, lastAnswer, doneTick, messages } = useChat();
  const state = useCore((s) => s.state);
  const [supported] = useState(() => ({ stt: voiceSupported.stt, tts: voiceSupported.tts }));
  const speakEnv = useRef<number | null>(null);

  const statusText = listening ? "LISTENING..." : streaming ? "THINKING..." : speaking ? "SPEAKING..." : state === "EXECUTING" ? "EXECUTING..." : "STANDBY";

  const toggleMic = () => {
    if (listening) {
      stopListening();
      setListening(false);
      useCore.getState().setState("IDLE");
      return;
    }
    setListening(true);
    useCore.getState().setState("LISTENING");
    sfx.click();
    startListening({
      onAudio: (l) => useCore.getState().setAudioLevel(l),
      onResult: (text) => {
        setTranscript(text);
        setListening(false);
        send(text);
      },
      onEnd: () => { setListening(false); if (useCore.getState().state === "LISTENING") useCore.getState().setState("IDLE"); },
    });
  };

  // Speak the latest completed answer when voice mode is active
  useEffect(() => {
    if (doneTick > 0 && autoSpeak && lastAnswer && useVoice.getState().active) {
      speak(lastAnswer);
    }
  }, [doneTick, autoSpeak]); // eslint-disable-line react-hooks/exhaustive-deps

  // Simulated speech envelope → waveform reaction
  useEffect(() => {
    if (speaking) {
      speakEnv.current = window.setInterval(() => {
        const l = 0.35 + Math.abs(Math.sin(performance.now() / 180)) * 0.5 + Math.random() * 0.1;
        useCore.getState().setAudioLevel(l);
      }, 80);
    } else {
      if (speakEnv.current) clearInterval(speakEnv.current);
      useCore.getState().setAudioLevel(0);
    }
    return () => { if (speakEnv.current) clearInterval(speakEnv.current); };
  }, [speaking]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";

  return (
    <div className="relative flex h-full flex-col items-center justify-center px-4 pb-28 pt-14 text-center">
      {/* Status */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
        <Tag tone={listening ? "cyan" : streaming ? "violet" : speaking ? "green" : "gray"}>{statusText}</Tag>
      </motion.div>

      <motion.h2
        key={statusText}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="tech-text text-2xl font-light tracking-[0.5em] text-white glow-cyan sm:text-3xl"
        aria-live="polite"
      >
        {statusText}
      </motion.h2>

      {/* Mic button */}
      <motion.button
        onClick={toggleMic}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={listening ? "Stop listening" : "Start listening"}
        className={`focus-ring relative mt-10 grid h-24 w-24 place-items-center rounded-full border-2 transition-all sm:h-28 sm:w-28 ${
          listening ? "border-cyan-300 bg-cyan-400/15 shadow-[0_0_60px_-10px_rgba(34,211,238,0.9)]" : "border-cyan-400/30 bg-cyan-400/5 hover:border-cyan-300/70"
        }`}
      >
        {listening && (
          <>
            <span className="absolute inset-0 animate-ping rounded-full border border-cyan-300/40" />
            <span className="absolute -inset-3 animate-spin-slow rounded-full border border-dashed border-cyan-300/30" />
          </>
        )}
        <Icon name="mic" size={34} className={listening ? "text-cyan-100" : "text-cyan-300"} />
      </motion.button>
      <p className="tech-text mt-4 text-[9px] tracking-[0.3em] text-dim">TAP TO {listening ? "STOP" : "SPEAK"}</p>

      {/* Transcript */}
      <AnimatePresence>
        {(transcript || lastAssistant) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass mt-8 w-full max-w-lg rounded-xl p-4 text-left"
          >
            {transcript && (
              <div className="mb-3">
                <p className="tech-text text-[9px] tracking-[0.25em] text-cyan-300">YOU SAID</p>
                <p className="mt-1 text-sm text-ink">{transcript}</p>
              </div>
            )}
            {lastAssistant && (
              <div>
                <p className="tech-text text-[9px] tracking-[0.25em] text-cyan-300">JARVIS</p>
                <p className="mt-1 line-clamp-4 text-sm text-mut">{lastAssistant}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="glass mt-8 flex flex-wrap items-center justify-center gap-4 rounded-xl px-5 py-3">
        <label className="flex items-center gap-2 text-xs text-mut">
          <Toggle checked={autoSpeak} onChange={setAutoSpeak} label="Auto-speak responses" /> AUTO-SPEAK
        </label>
        <button
          onClick={() => { stopAll(); }}
          className="btn-ghost !px-3 !py-1.5 text-xs"
          aria-label="Interrupt speech"
        >
          <Icon name="stop" size={12} /> INTERRUPT
        </button>
        {!supported.stt && (
          <span className="text-[10px] text-amber-300/80">MIC BLOCKED — simulated listening active</span>
        )}
        {!supported.tts && (
          <span className="text-[10px] text-amber-300/80">TTS UNAVAILABLE</span>
        )}
      </div>
    </div>
  );
}
