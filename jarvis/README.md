# JARVIS — Hyper-Max 3D Personal AI Command Center

A cinematic, holographic AI operating system. A React + TypeScript + Three.js
frontend wraps a real Node.js intelligence layer (AI provider abstraction,
agent system, tool registry, memory, tasks, automation, auth, live telemetry)
— **not** a static mockup.

![stack](https://img.shields.io/badge/React%2018-TypeScript-blue) ![three](https://img.shields.io/badge/Three.js-R3F-cyan) ![server](https://img.shields.io/badge/Node-Express-8b5cf6)

---

## What it looks like

- **3D JARVIS AI Core** — a shader-driven holographic energy sphere with gimbal
  rings, a neural particle field, orbiting nodes, scan arcs, an expanding pulse
  ring, a live audio-waveform ring and volumetric glow. It reacts to nine states:
  `BOOT · IDLE · LISTENING · THINKING · SPEAKING · EXECUTING · SUCCESS · WARNING · ERROR · OFFLINE`.
- **Cinematic boot sequence** with a SKIP INTRO option.
- **Command center** — top status bar (AI Engine / Network / Security / Memory /
  Tools / Voice), floating left navigation (14 modules), holographic HUD,
  scanlines, digital noise, glass panels.
- **Modules** — Home, Chat (streaming markdown + tool/agent visualization),
  Voice (full-screen mode, Web Speech API STT/TTS), Tasks, Automation, Memory,
  Tools, Web Research, File Intelligence, Code Lab (sandboxed), System Monitor
  (real telemetry), Security Center, Logs, Settings.
- **Responsive** — dedicated mobile bottom-nav + drawer composition; adaptive
  graphics quality (HIGH / MEDIUM / LOW); reduced-motion support.
- **Demo Mode** — everything works with zero API keys; simulated data is always
  labeled `DEMO`.

---

## Quick start

```bash
npm install          # installs both workspaces
cp .env.example .env # optional — configure providers (see below)
npm run build        # type-check + build server & client
npm start            # serves the full app on http://localhost:8787
```

For development with hot reload:

```bash
npm run dev          # Vite (5173) + API server (8787)
```

---

## Architecture

```
jarvis/
├── client/                    # React + TS + Vite + Tailwind + R3F + Framer Motion
│   └── src/
│       ├── three/             # JarvisCore, Scene (Canvas, grid, dust), glow util
│       ├── components/        # TopBar, Nav, CommandBar, HudOverlay, AIMessage,
│       │                      #   BootSequence, ErrorBoundary, Toasts, ui, icons
│       ├── features/          # one folder-per-module (Home, Chat, Voice, …)
│       ├── services/          # api client, SSE stream, voice (STT/TTS), sound (WebAudio)
│       ├── store.ts           # zustand: core state machine, chat, voice, settings, toasts
│       └── types.ts
└── server/                    # Node + Express + TypeScript (ESM)
    └── src/
        ├── index.ts           # app, static serving, error handler
        ├── routes.ts          # /api/* endpoints (REST + SSE)
        ├── config.ts          # env loading (server-side secrets only)
        ├── auth.ts            # scrypt hashing, sessions, rate limiting
        ├── ai/index.ts        # AIProvider abstraction (OpenAI/Anthropic/Gemini/Local/Demo)
        ├── agent/index.ts     # ANALYZING → PLANNING → EXECUTING → VERIFYING → COMPLETED
        ├── tools/index.ts     # modular tool registry (search, calculator, sandbox…)
        ├── db/index.ts        # Database abstraction + migrations (embedded JSON store)
        ├── events.ts          # SSE pub/sub hub
        └── system.ts          # real CPU/RAM/disk/network telemetry
```

### AI provider layer (`server/src/ai/index.ts`)

JARVIS never hardcodes a vendor. Every provider implements `AIProvider`:

| Provider | Class | Enabled when |
|---|---|---|
| `openai` | `OpenAICompatProvider` | `AI_API_KEY` set (works with OpenAI, Azure, Groq, OpenRouter, Together…) |
| `anthropic` | `AnthropicProvider` | `ANTHROPIC_API_KEY` set |
| `gemini` | `GeminiProvider` | `GEMINI_API_KEY` set |
| `local` | `OpenAICompatProvider` | `LOCAL_AI_BASE_URL` set (Ollama, LM Studio, llama.cpp…) |
| `demo` | `DemoProvider` | always available (fallback) |

Selection order: user override (Settings → Providers) → `AI_PROVIDER` env →
first configured real provider → demo. **API keys live only in environment
variables on the server and are never sent to the browser.**

### Agent system (`server/src/agent/index.ts`)

```
REQUEST → ANALYZING → PLANNING → EXECUTING (tools) → VERIFYING → COMPLETED
```

The agent detects intent, plans steps, selects tools from the registry,
executes them (streaming progress events to the UI), verifies results and
composes the final answer — synthesized by the demo engine or your live model.

### Tool registry (`server/src/tools/index.ts`)

Every tool exposes `{ name, description, icon, permission, status, run() }`.
- `web_search` — real search (Brave/Tavily/SerpAPI) when `SEARCH_API_KEY` set, else labeled demo.
- `calculator` — safe expression evaluator (recursive-descent parser, **no `eval`**).
- `code_runner` — JavaScript in a `node:vm` sandbox (no `require`/`process`, 1.5 s timeout).
- `clock`, `memory`, `task`, `security_scan`, `system_info`.

Tools touching external systems (`permission: "external"`) require explicit
user approval and can never run silently.

---

## Deploying to Render

The repo ships with a **Render Blueprint** (`render.yaml`) so you can deploy
with one click.

### Step 1 — push to GitHub

Render deploys from Git, so push the `jarvis/` project to a GitHub repository:

```bash
git init
git add .
git commit -m "JARVIS command center"
git branch -M main
git remote add origin https://github.com/<you>/jarvis.git
git push -u origin main
```

### Step 2 — deploy

**Option A — Blueprint (recommended).** In Render: **New → Blueprint**, connect
your GitHub repo. Render reads `render.yaml` and creates the web service with
the right build/start commands automatically.

**Option B — Manual web service.** In Render: **New → Web Service**, pick the
repo, then set:

| Setting | Value |
|---|---|
| Runtime | Node |
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Instance type | Free |
| Health check path | `/api/health` |

### Step 3 — environment variables

The blueprint pre-creates the important ones (`NODE_VERSION=20`,
`SESSION_SECRET` auto-generated). In the Render dashboard (**Environment** tab)
add your secrets — these stay on the server and are **never** sent to the
browser:

```
AI_PROVIDER=anthropic     # openai | anthropic | gemini | local | demo
AI_MODEL=claude-opus-5
ANTHROPIC_API_KEY=sk-ant-...
SEARCH_PROVIDER=brave     # optional — brave | tavily | serpapi
SEARCH_API_KEY=...
AUTH_REQUIRED=false       # set "true" to require login
```

You don't need to set `PORT` — Render injects it and the server binds to it.

### Step 4 — persistence (important)

Render's free plan has an **ephemeral filesystem**: the embedded JSON store
(memory, tasks, logs, settings) resets on every redeploy. That's fine for
demoing, but for a real personal assistant pick one of:

1. **Render Disk** (paid instances) — add a 1 GB disk mounted at `/data` and
   set the env var `DATA_DIR=/data`. The app already supports this.
2. **Render Postgres** — swap the `Database` interface in `server/src/db/index.ts`
   for a Postgres adapter; no route or feature code needs to change.

The app auto-redeploys on every `git push`. Done — your JARVIS is live at
`https://jarvis.onrender.com`.

---

## Connecting real intelligence (API keys)

Create `server/.env` (or repo-root `.env`) — this file is git-ignored:

```env
# Server
PORT=8787
SESSION_SECRET=change-me-to-a-long-random-string

# AI (Anthropic Claude Opus 5)
AI_PROVIDER=anthropic         # openai | anthropic | gemini | local | demo
AI_MODEL=claude-opus-5
ANTHROPIC_API_KEY=sk-ant-...

# Optional OpenAI-compatible provider
AI_API_KEY=
AI_BASE_URL=https://api.openai.com/v1

# Optional Gemini provider
GEMINI_API_KEY=

# Local (Ollama etc.)
LOCAL_AI_BASE_URL=http://localhost:11434/v1
LOCAL_AI_MODEL=llama3

# Web search (optional)
SEARCH_PROVIDER=brave         # brave | tavily | serpapi
SEARCH_API_KEY=...

# Require login
AUTH_REQUIRED=false
```

Restart the server after editing. Secrets must **never** go in client code.

---

## Database

The default store is a zero-dependency embedded JSON database at
`server/data/jarvis.db.json` with a versioned migration system and a `Database`
interface (`db.all / find / query / insert / update / remove / clear`). Swap in
Postgres by implementing the same interface — no route or feature code changes.

Collections: `users · sessions · conversations · messages · memory · tasks ·
automations · tool_runs · activity_logs · files · settings`.

## Security

- Passwords: scrypt-hashed, never plaintext.
- Sessions: 256-bit random tokens, HttpOnly + SameSite cookies, 30-day expiry.
- Rate limiting: token-bucket per IP on auth, chat, tools and search.
- All inputs validated; central error handler never silently fails.
- Security Center shows **simulated** posture — clearly labeled, not real protection.

## API

```
GET  /api/health · /api/bootstrap · /api/providers
POST /api/auth/login|register|logout     GET /api/auth/me
POST /api/chat (SSE stream)              GET/DELETE /api/conversations[/:id]
GET  /api/tools · POST /api/tools/:id/run
GET/POST/DELETE /api/memory[/:id]
GET/POST/PATCH/DELETE /api/tasks[/:id] · /api/tasks/:id/retry
GET/POST/PATCH/DELETE /api/automation[/:id]
GET/POST/DELETE /api/files[/:id]
POST /api/search
GET  /api/system/metrics · /api/system/stream (SSE)
GET  /api/security/status · /api/logs
GET/PUT /api/settings · POST /api/providers/select
```

---

## Performance & accessibility

- GPU-accelerated Three.js; particles, waveform bars and dpr adapt to quality
  (HIGH/MEDIUM/LOW) and viewport; heavy modules lazy-loaded & code-split.
- `prefers-reduced-motion` respected globally plus an in-app toggle.
- Keyboard navigation, visible focus states, ARIA labels/live regions,
  high-contrast text, empty/loading/error states on every module.

## Notes on the referenced skills

The visual language is informed by premium UI/UX patterns (glassmorphism,
HUD composition, micro-interactions) and 3D portfolio techniques (hero 3D core,
dark space environment, particle systems) from the linked references — re-built
from scratch for JARVIS rather than cloned.
