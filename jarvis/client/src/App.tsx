import { Suspense, lazy, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { BootSequence } from "./components/BootSequence";
import { TopBar } from "./components/TopBar";
import { DesktopNav, MobileNav } from "./components/Nav";
import { CommandBar } from "./components/CommandBar";
import { HudOverlay } from "./components/HudOverlay";
import { Toasts } from "./components/Toasts";
import { Scene } from "./three/Scene";
import { useCore, useNav, useSettings, useVoice, useLive, recordMetrics } from "./store";
import { connectSSE } from "./services/stream";
import { Home } from "./features/Home";
import { Chat } from "./features/Chat";
import { Voice } from "./features/Voice";
import { Tasks } from "./features/Tasks";
import { Automation } from "./features/Automation";
import { Memory } from "./features/Memory";
import { Tools } from "./features/Tools";
import { Web } from "./features/Web";
import { Files } from "./features/Files";
import { Code } from "./features/Code";
import { System } from "./features/System";
import { Security } from "./features/Security";
import { Logs } from "./features/Logs";
import { Settings } from "./features/Settings";

// Lazy-load the heavier modules for a faster first paint
const LazyTasks = lazy(() => import("./features/Tasks").then((m) => ({ default: m.Tasks })));
const LazyAutomation = lazy(() => import("./features/Automation").then((m) => ({ default: m.Automation })));
const LazyMemory = lazy(() => import("./features/Memory").then((m) => ({ default: m.Memory })));
const LazyTools = lazy(() => import("./features/Tools").then((m) => ({ default: m.Tools })));
const LazyWeb = lazy(() => import("./features/Web").then((m) => ({ default: m.Web })));
const LazyFiles = lazy(() => import("./features/Files").then((m) => ({ default: m.Files })));
const LazyCode = lazy(() => import("./features/Code").then((m) => ({ default: m.Code })));
const LazySystem = lazy(() => import("./features/System").then((m) => ({ default: m.System })));
const LazySecurity = lazy(() => import("./features/Security").then((m) => ({ default: m.Security })));
const LazyLogs = lazy(() => import("./features/Logs").then((m) => ({ default: m.Logs })));
const LazySettings = lazy(() => import("./features/Settings").then((m) => ({ default: m.Settings })));

const SECTION_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType> | React.ComponentType> = {
  home: Home,
  chat: Chat,
  voice: Voice,
  tasks: LazyTasks,
  automation: LazyAutomation,
  memory: LazyMemory,
  tools: LazyTools,
  web: LazyWeb,
  files: LazyFiles,
  code: LazyCode,
  system: LazySystem,
  security: LazySecurity,
  logs: LazyLogs,
  settings: LazySettings,
};

const CORE_FOCUS: Record<string, number> = {
  home: 1, voice: 1, chat: 0.9, system: 0.8, security: 0.8, settings: 0.75,
};

function FeatureLoader() {
  return (
    <div className="flex h-full items-center justify-center pb-24">
      <span className="tech-text text-[10px] tracking-[0.35em] text-cyan-300/70 animate-pulse-soft">LOADING MODULE…</span>
    </div>
  );
}

export default function App() {
  const booted = useCore((s) => s.booted);
  const section = useNav((s) => s.section);
  const setCoreFocus = useCore((s) => s.setCoreFocus);
  const setSection = useNav((s) => s.setSection);
  const setActive = useVoice((s) => s.setActive);

  // Load settings + provider status on boot
  useEffect(() => { useSettings.getState().load(); }, []);

  // Live telemetry stream (metrics + security events)
  useEffect(() => {
    const sse = connectSSE("/api/system/stream", {
      onEvent: (e) => {
        if (e.type === "metrics") recordMetrics(e as never);
        if (e.type === "security_event") useLive.getState().pushSecurityEvent(e as never);
      },
    });
    return () => sse.close();
  }, []);

  // Core prominence + voice-mode flag per section
  useEffect(() => {
    setCoreFocus(CORE_FOCUS[section] ?? 0.7);
    setActive(section === "voice");
  }, [section, setCoreFocus, setActive]);

  const ActiveComponent = SECTION_COMPONENTS[section] ?? Home;
  const showCommandBar = section === "home" || section === "chat";

  return (
    <ErrorBoundary>
      <div className="relative h-full w-full overflow-hidden bg-void text-ink">
        {/* Atmospheric background */}
        <div className="absolute inset-0" aria-hidden>
          <div className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 40%, #0a1626 0%, #060b14 45%, #03060c 100%)" }} />
          <div className="absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60" style={{ background: "radial-gradient(circle, rgba(34,211,238,0.16) 0%, rgba(47,155,255,0.06) 38%, transparent 70%)" }} />
          <div className="absolute left-1/2 top-1/2 h-[34vmin] w-[34vmin] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50" style={{ background: "radial-gradient(circle, rgba(127,243,255,0.12) 0%, transparent 60%)" }} />
        </div>

        {/* 3D scene */}
        <Scene />

        {/* HUD + overlays */}
        <HudOverlay />
        <div className="scanlines absolute inset-0 z-10" aria-hidden />
        <div className="noise absolute inset-0 z-10" aria-hidden />

        {/* Chrome */}
        <TopBar />
        <DesktopNav />
        <MobileNav />

        {/* Active module */}
        <main className="absolute inset-0 z-20" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="h-full"
            >
              <Suspense fallback={<FeatureLoader />}>
                <ActiveComponent />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Command bar (home + chat) */}
        <AnimatePresence>
          {booted && showCommandBar && (
            <motion.div
              key="cmdb"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute inset-x-0 bottom-16 z-30 flex justify-center px-3 sm:bottom-6"
            >
              <div className="w-full max-w-2xl">
                <CommandBar />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick section switcher (desktop) */}
        {booted && section !== "home" && section !== "voice" && (
          <button
            onClick={() => setSection("home")}
            className="focus-ring absolute right-3 bottom-3 z-30 hidden items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] tech-text tracking-[0.2em] text-mut hover:text-cyan-300 md:flex"
            aria-label="Return to command center"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> CORE
          </button>
        )}

        <BootSequence />
        <Toasts />
      </div>
    </ErrorBoundary>
  );
}
