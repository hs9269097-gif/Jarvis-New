// Shared types for the JARVIS client

export type CoreState =
  | "BOOT"
  | "IDLE"
  | "LISTENING"
  | "THINKING"
  | "SPEAKING"
  | "EXECUTING"
  | "SUCCESS"
  | "WARNING"
  | "ERROR"
  | "OFFLINE";

export type AgentState = "ANALYZING" | "PLANNING" | "EXECUTING" | "VERIFYING" | "COMPLETED";

export type Quality = "high" | "medium" | "low";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  streaming?: boolean;
  toolEvents?: ToolEvent[];
  steps?: string[];
  error?: boolean;
}

export interface ToolEvent {
  id: string;
  name: string;
  icon: string;
  status: "start" | "done" | "error";
  output?: string;
  demo?: boolean;
}

export type SectionId =
  | "home" | "chat" | "voice" | "tasks" | "automation" | "memory" | "tools"
  | "web" | "files" | "code" | "system" | "security" | "logs" | "settings";

export interface MemoryItem {
  id: string;
  content: string;
  category: string;
  importance: string;
  source: string;
  createdAt: number;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  state: string;
  progress: number;
  createdAt: number;
  logs: string[];
  demo?: boolean;
}

export interface AutomationItem {
  id: string;
  name: string;
  trigger: string;
  conditions: string[];
  actions: string[];
  enabled: boolean;
  createdAt: number;
  runs: number;
}

export interface ToolInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  permission: "none" | "user" | "external";
  status: string;
}

export interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  kind: string;
  analysis: FileAnalysis;
  createdAt: number;
}

export interface FileAnalysis {
  kind: string;
  wordCount?: number;
  charCount?: number;
  sentenceCount?: number;
  readingMinutes?: number;
  keywords?: { word: string; count: number }[];
  summary?: string;
  preview?: string;
  note?: string;
  size?: number;
}

export interface Metrics {
  cpu: number;
  cpuHistory: number[];
  ram: { total: number; free: number; used: number; usedPct: number };
  storage: { total: number; free: number; used: number; usedPct: number };
  network: { rx: number; tx: number; rxRate: number; txRate: number };
  load: number[];
  uptime: number;
  process: { heapUsed: number; rss: number; pid: number };
  cores: number;
  timestamp: number;
}

export interface SecurityStatus {
  demo: boolean;
  score: number;
  threatLevel: string;
  auth: { required: boolean; hashedPasswords: boolean; method: string };
  sessions: { active: number; current: number };
  permissions: { tool: string; permission: string }[];
  encryption: { transport: string; secrets: string; cookies: string };
  loginHistory: { message: string; at: number }[];
  events: { kind: string; message: string; at: number; demo?: boolean }[];
}

export interface ProviderInfo {
  active: string;
  activeLabel: string;
  demo: boolean;
  providers: { id: string; label: string; configured: boolean }[];
  envConfigured: boolean;
}

export interface Settings {
  ai: { model: string; temperature: number; style: string; systemInstructions: string };
  voice: { voice: string; speed: number; volume: number; wakeWord: string; autoListen: boolean };
  appearance: { accent: string; quality: Quality; animations: boolean; reducedMotion: boolean };
  memory: { enabled: boolean; autoSave: boolean };
  notifications: { desktop: boolean; tasks: boolean };
  provider?: string;
}
