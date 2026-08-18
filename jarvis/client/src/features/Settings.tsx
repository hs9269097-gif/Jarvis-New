import { useEffect, useState } from "react";
import { Icon, type IconName } from "../components/icons";
import { Frame } from "./Frame";
import { Toggle, Tag } from "../components/ui";
import { useCore, useSettings, pushToast } from "../store";
import { api } from "../services/api";
import type { Quality, Settings as SettingsType } from "../types";

type Tab = "ai" | "voice" | "appearance" | "memory" | "security" | "providers" | "notifications";

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "ai", label: "AI", icon: "activity" },
  { id: "voice", label: "VOICE", icon: "mic" },
  { id: "appearance", label: "APPEARANCE", icon: "eye" },
  { id: "memory", label: "MEMORY", icon: "memory" },
  { id: "security", label: "SECURITY", icon: "security" },
  { id: "providers", label: "PROVIDERS", icon: "layers" },
  { id: "notifications", label: "NOTIFICATIONS", icon: "send" },
];

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 py-3">
      <div className="min-w-0">
        <p className="text-sm text-ink">{label}</p>
        {hint && <p className="text-[11px] text-dim">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Settings() {
  const [tab, setTab] = useState<Tab>("ai");
  const { settings, save, provider, selectProvider, load } = useSettings();
  const setQuality = useCore((s) => s.setQuality);
  const setSound = useCore((s) => s.setSound);
  const sound = useCore((s) => s.sound);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [session, setSession] = useState<{ user?: { displayName: string } }>({});

  useEffect(() => { load(); }, [load]);
  useEffect(() => { (async () => { try { const r = await api.auth(); setSession({ user: r.user ? { displayName: r.user.displayName } : undefined }); } catch { /* */ } })(); }, []);

  const patch = (p: Partial<SettingsType>) => save(p);
  const patchNested = <K extends keyof SettingsType>(key: K, p: Partial<SettingsType[K]>) => {
    const next: SettingsType = { ...settings, [key]: { ...(settings[key] as object), ...p } as SettingsType[K] };
    save(next);
  };

  const doLogin = async () => {
    try {
      await api.login(loginUser, loginPass);
      pushToast("success", "AUTHENTICATED", "Session established.");
      setSession({ user: { displayName: loginUser.toUpperCase() } });
    } catch (e) { pushToast("error", "Authentication failed", (e as Error).message); }
  };

  return (
    <Frame icon="settings" title="SETTINGS" subtitle="Complete JARVIS configuration">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
        {/* Sub nav */}
        <div className="flex gap-1 md:flex-col">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`focus-ring flex flex-1 items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-all md:flex-none ${tab === t.id ? "border border-cyan-400/40 bg-cyan-400/10 text-cyan-200" : "text-mut hover:text-ink"}`}>
              <Icon name={t.icon} size={14} />
              <span className="tech-text tracking-[0.15em]">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="glass-soft min-h-[420px] rounded-lg border border-white/10 p-4">
          {tab === "ai" && (
            <div>
              <Row label="Model" hint="Requested model (per provider)"><input value={settings.ai.model} onChange={(e) => patchNested("ai", { model: e.target.value })} className="input !w-40" /></Row>
              <Row label="Temperature" hint={`${settings.ai.temperature.toFixed(2)} — lower is more deterministic`}>
                <input type="range" min={0} max={1.5} step={0.05} value={settings.ai.temperature} onChange={(e) => patchNested("ai", { temperature: Number(e.target.value) })} className="w-40 accent-cyan-400" aria-label="Temperature" />
              </Row>
              <Row label="Response style"><input value={settings.ai.style} onChange={(e) => patchNested("ai", { style: e.target.value })} className="input !w-44" /></Row>
              <Row label="System instructions" hint="Global directive prepended to every session">
                <textarea value={settings.ai.systemInstructions} onChange={(e) => patchNested("ai", { systemInstructions: e.target.value })} rows={3} className="input !w-64 text-xs" placeholder="e.g. Be concise and professional." />
              </Row>
            </div>
          )}

          {tab === "voice" && (
            <div>
              <Row label="Wake word"><input value={settings.voice.wakeWord} onChange={(e) => patchNested("voice", { wakeWord: e.target.value })} className="input !w-32" /></Row>
              <Row label="Speech rate" hint={`${settings.voice.speed.toFixed(1)}×`}>
                <input type="range" min={0.5} max={1.8} step={0.1} value={settings.voice.speed} onChange={(e) => patchNested("voice", { speed: Number(e.target.value) })} className="w-40 accent-cyan-400" aria-label="Speech rate" />
              </Row>
              <Row label="Volume">
                <input type="range" min={0} max={1} step={0.05} value={settings.voice.volume} onChange={(e) => patchNested("voice", { volume: Number(e.target.value) })} className="w-40 accent-cyan-400" aria-label="Volume" />
              </Row>
              <Row label="Auto-speak responses" hint="Read JARVIS replies aloud in voice mode"><Toggle checked={Boolean((settings.voice as { autoSpeak?: boolean }).autoSpeak)} onChange={(v) => patchNested("voice", { autoSpeak: v } as never)} /></Row>
              <p className="mt-3 text-[11px] text-dim">Speech-to-text uses your browser's Web Speech API. Text-to-speech uses the system synthesizer. JARVIS never uploads audio.</p>
            </div>
          )}

          {tab === "appearance" && (
            <div>
              <Row label="Accent color">
                <div className="flex gap-1.5">
                  {["cyan", "violet", "emerald", "amber"].map((a) => (
                    <button key={a} onClick={() => patchNested("appearance", { accent: a })} aria-label={`Accent ${a}`} className={`h-6 w-6 rounded-full border-2 ${settings.appearance.accent === a ? "border-white" : "border-transparent"} ${a === "cyan" ? "bg-cyan-400" : a === "violet" ? "bg-violet-400" : a === "emerald" ? "bg-emerald-400" : "bg-amber-400"}`} />
                  ))}
                </div>
              </Row>
              <Row label="Graphics quality" hint="Adaptive rendering for the 3D core">
                <div className="flex gap-1.5">
                  {(["high", "medium", "low"] as Quality[]).map((q) => (
                    <button key={q} onClick={() => { setQuality(q); patchNested("appearance", { quality: q }); }} className={`focus-ring rounded border px-2.5 py-1 text-[10px] tech-text tracking-[0.15em] ${settings.appearance.quality === q ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-dim"}`}>{q.toUpperCase()}</button>
                  ))}
                </div>
              </Row>
              <Row label="Animations"><Toggle checked={settings.appearance.animations} onChange={(v) => patchNested("appearance", { animations: v })} /></Row>
              <Row label="Reduced motion" hint="Calms the core & HUD for accessibility"><Toggle checked={settings.appearance.reducedMotion} onChange={(v) => patchNested("appearance", { reducedMotion: v })} /></Row>
              <Row label="Interface sounds"><Toggle checked={sound} onChange={setSound} /></Row>
            </div>
          )}

          {tab === "memory" && (
            <div>
              <Row label="Enable memory" hint="Persist memories across sessions"><Toggle checked={settings.memory.enabled} onChange={(v) => patchNested("memory", { enabled: v })} /></Row>
              <Row label="Auto-save conversations"><Toggle checked={settings.memory.autoSave} onChange={(v) => patchNested("memory", { autoSave: v })} /></Row>
              <Row label="Memory management" hint="Permanently erase all stored memories">
                <button onClick={async () => { await api.clearMemory(); pushToast("info", "MEMORY CLEARED"); }} className="btn-ghost !px-3 !py-1.5 text-xs text-red-300"><Icon name="trash" size={13} /> PURGE</button>
              </Row>
            </div>
          )}

          {tab === "security" && (
            <div>
              <p className="mb-3 text-xs text-mut">Session: {session.user ? <span className="text-cyan-300">signed in as {session.user.displayName}</span> : <span className="text-dim">guest session (AUTH_REQUIRED=false)</span>}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input value={loginUser} onChange={(e) => setLoginUser(e.target.value)} placeholder="Username" className="input" aria-label="Username" />
                <input value={loginPass} onChange={(e) => setLoginPass(e.target.value)} type="password" placeholder="Password" className="input" aria-label="Password" />
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={doLogin} className="btn-primary !px-4 text-xs">SIGN IN</button>
                <button onClick={async () => { try { await api.register(loginUser || "operator", loginPass || "jarvis123"); pushToast("success", "ACCOUNT CREATED"); } catch (e) { pushToast("error", "Registration failed", (e as Error).message); } }} className="btn-ghost text-xs">REGISTER</button>
                <button onClick={async () => { await api.logout(); setSession({}); pushToast("info", "SIGNED OUT"); }} className="btn-ghost text-xs">SIGN OUT</button>
              </div>
              <p className="mt-3 text-[11px] text-dim">Passwords are scrypt-hashed server-side and never stored in plaintext. Enable AUTH_REQUIRED=true in the server environment to protect all routes.</p>
            </div>
          )}

          {tab === "providers" && (
            <div>
              <p className="mb-3 text-xs text-mut">AI providers are abstracted behind one interface. Secrets live only in server environment variables — never in this UI.</p>
              <div className="space-y-2">
                {(provider?.providers ?? []).map((p) => (
                  <div key={p.id} className={`flex items-center gap-3 rounded-lg border p-3 ${provider?.active === p.id ? "border-cyan-400/40 bg-cyan-400/10" : "border-white/10"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">{p.label}</p>
                      <p className="tech-text text-[9px] tracking-[0.15em] text-dim">{p.id.toUpperCase()}{p.configured ? " · KEY CONFIGURED" : " · NO KEY"}</p>
                    </div>
                    <Tag tone={p.configured ? "green" : "gray"}>{p.configured ? "READY" : "UNSET"}</Tag>
                    <button
                      onClick={async () => { const err = await selectProvider(p.id); if (err) pushToast("warning", "PROVIDER NOT CONFIGURED", err); else pushToast("success", "PROVIDER ACTIVE", p.label); }}
                      disabled={provider?.active === p.id}
                      className={`btn text-xs ${provider?.active === p.id ? "text-cyan-300" : "btn-ghost !px-3 !py-1"}`}
                    >
                      {provider?.active === p.id ? "ACTIVE" : "SELECT"}
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-md border border-cyan-400/15 bg-cyan-400/5 p-3 font-mono text-[10px] leading-5 text-cyan-100/70">
                # server/.env<br />AI_PROVIDER=anthropic<br />AI_MODEL=claude-opus-5<br />ANTHROPIC_API_KEY=sk-ant-...
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div>
              <Row label="Desktop notifications"><Toggle checked={settings.notifications.desktop} onChange={(v) => patchNested("notifications", { desktop: v })} /></Row>
              <Row label="Task notifications"><Toggle checked={settings.notifications.tasks} onChange={(v) => patchNested("notifications", { tasks: v })} /></Row>
            </div>
          )}
        </div>
      </div>
    </Frame>
  );
}
