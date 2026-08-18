import { useState } from "react";
import { Icon } from "../components/icons";
import { Tag } from "../components/ui";
import { Frame } from "./Frame";
import { api } from "../services/api";
import { useChat, useNav } from "../store";
import { sfx } from "../services/sound";

const SAMPLE = `// JARVIS code lab — sandboxed execution
const systems = ["reactor", "nav", "comms", "sensors"];
const load = systems.map((s, i) => ({ name: s, power: Math.round(60 + Math.random() * 40) }));

for (const sys of load) {
  console.log(sys.name.padEnd(10), "#".repeat(sys.power / 8), sys.power + "%");
}

function coreTemp() {
  return (21 + Math.sin(Date.now() / 5000) * 1.2).toFixed(1);
}
console.log("CORE TEMP:", coreTemp() + " °C");
`;

export function Code() {
  const [code, setCode] = useState(SAMPLE);
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(false);
  const send = useChat((s) => s.send);
  const setSection = useNav((s) => s.setSection);

  const run = async () => {
    setRunning(true);
    setError(false);
    setOutput("");
    sfx.send();
    try {
      const r = await api.runTool("code_runner", { code }, true);
      setOutput(r.output);
      setError(!r.ok);
      sfx[r.ok ? "success" : "error"]();
    } catch (e) {
      setOutput((e as Error).message);
      setError(true);
    }
    setRunning(false);
  };

  const aiReview = () => {
    send(`JARVIS, find the error in this code and suggest a fix:\n\`\`\`js\n${code}\n\`\`\``);
    setSection("chat");
  };

  return (
    <Frame
      icon="code"
      title="CODE LAB"
      subtitle="Sandboxed execution + AI code analysis"
      right={
        <div className="flex gap-2">
          <button onClick={aiReview} className="btn-ghost !px-2.5 !py-1.5 text-xs"><Icon name="zap" size={13} /> AI REVIEW</button>
          <button onClick={run} disabled={running} className="btn-primary !px-3 !py-1.5 text-xs disabled:opacity-40">
            <Icon name="play" size={13} /> {running ? "RUNNING…" : "RUN"}
          </button>
        </div>
      }
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag tone="cyan">JAVASCRIPT</Tag>
          <Tag tone="green">SANDBOXED · 1.5s TIMEOUT</Tag>
        </div>
        <button onClick={() => setCode(SAMPLE)} className="text-[10px] text-dim hover:text-cyan-300 tech-text tracking-[0.2em]">RESET SAMPLE</button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Editor */}
        <div className="overflow-hidden rounded-lg border border-white/10 bg-[#050a12]">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="tech-text text-[9px] tracking-[0.25em] text-dim">main.js</span>
            <span className="h-2 w-2 rounded-full bg-cyan-400/70" />
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            rows={16}
            aria-label="Code editor"
            className="w-full resize-y bg-transparent p-3 font-mono text-xs leading-5 text-cyan-50 outline-none"
          />
        </div>

        {/* Output / terminal */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-white/10 bg-black/40">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="tech-text text-[9px] tracking-[0.25em] text-dim">TERMINAL · OUTPUT</span>
            {output && <Tag tone={error ? "red" : "green"}>{error ? "FAULT" : "OK"}</Tag>}
          </div>
          <pre className={`min-h-[16rem] flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-5 ${error ? "text-red-200/90" : "text-emerald-100/80"}`}>
            {output || "// Output appears here after execution.\n// JARVIS never executes code outside the sandbox."}
          </pre>
          {error && (
            <div className="border-t border-red-400/20 bg-red-400/5 p-3">
              <p className="text-[11px] text-red-200/90">Execution fault detected. Select <span className="text-cyan-300">AI REVIEW</span> to have JARVIS diagnose and suggest a fix.</p>
            </div>
          )}
        </div>
      </div>
    </Frame>
  );
}
