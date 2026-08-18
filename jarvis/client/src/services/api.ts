// Typed API client — every backend call goes through here.
import type {
  MemoryItem, TaskItem, AutomationItem, ToolInfo, FileItem, Metrics,
  SecurityStatus, ProviderInfo, Settings, SectionId,
} from "../types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const text = await res.text();
  let json: unknown = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* non-json */ }
  if (!res.ok) {
    const err = new Error((json as { error?: string }).error || `Request failed (${res.status})`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return json as T;
}

export const api = {
  health: () => request<{ ok: boolean; name: string; time: number }>("/health"),
  bootstrap: () => request<{ name: string; version: string; demoMode: boolean; provider: ProviderInfo; auth: { required: boolean } }>("/bootstrap"),

  // Auth
  auth: () => request<{ user: { id: string; username: string; displayName: string } | null; demoMode: boolean }>("/auth/me"),
  login: (username: string, password: string) => request<{ ok: boolean; user?: object }>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  register: (username: string, password: string) => request<{ ok: boolean }>("/auth/register", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  // Chat
  conversations: () => request<{ conversations: { id: string; title: string; preview: string; createdAt: number; lastMessageAt: number }[] }>("/conversations"),
  conversation: (id: string) => request<{ messages: { id: string; role: string; content: string; createdAt: number }[] }>(`/conversations/${id}`),
  deleteConversation: (id: string) => request<{ ok: boolean }>(`/conversations/${id}`, { method: "DELETE" }),

  // Memory
  memories: () => request<{ memories: MemoryItem[] }>("/memory"),
  addMemory: (content: string, category = "long_term", importance = "normal") =>
    request<{ ok: boolean; memory: MemoryItem }>("/memory", { method: "POST", body: JSON.stringify({ content, category, importance, source: "manual" }) }),
  deleteMemory: (id: string) => request<{ ok: boolean }>(`/memory/${id}`, { method: "DELETE" }),
  clearMemory: () => request<{ ok: boolean }>("/memory", { method: "DELETE" }),

  // Tasks
  tasks: () => request<{ tasks: TaskItem[] }>("/tasks"),
  createTask: (title: string, description?: string) => request<{ ok: boolean; task: TaskItem }>("/tasks", { method: "POST", body: JSON.stringify({ title, description }) }),
  updateTask: (id: string, patch: object) => request<{ ok: boolean; task: TaskItem }>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  retryTask: (id: string) => request<{ ok: boolean; task: TaskItem }>(`/tasks/${id}/retry`, { method: "POST" }),
  deleteTask: (id: string) => request<{ ok: boolean }>(`/tasks/${id}`, { method: "DELETE" }),
  demoTask: (title: string) => request<{ ok: boolean; task: TaskItem }>("/demo/task", { method: "POST", body: JSON.stringify({ title }) }),

  // Automation
  automations: () => request<{ automations: AutomationItem[] }>("/automation"),
  createAutomation: (body: object) => request<{ ok: boolean; automation: AutomationItem }>("/automation", { method: "POST", body: JSON.stringify(body) }),
  updateAutomation: (id: string, patch: object) => request<{ ok: boolean; automation: AutomationItem }>(`/automation/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteAutomation: (id: string) => request<{ ok: boolean }>(`/automation/${id}`, { method: "DELETE" }),

  // Tools
  tools: () => request<{ tools: ToolInfo[] }>("/tools"),
  runTool: (id: string, args: object, approved?: boolean) =>
    request<{ ok: boolean; output: string; data?: unknown; demo?: boolean }>(`/tools/${id}/run`, { method: "POST", body: JSON.stringify({ args, approved }) }),

  // Files
  files: () => request<{ files: FileItem[] }>("/files"),
  uploadFile: (name: string, type: string, size: number, data: string) =>
    request<{ ok: boolean; file: FileItem }>("/files", { method: "POST", body: JSON.stringify({ name, type, size, data }) }),
  deleteFile: (id: string) => request<{ ok: boolean }>(`/files/${id}`, { method: "DELETE" }),

  // Search
  search: (query: string) => request<{ ok: boolean; output: string; data?: { title: string; url: string; snippet: string }[]; demo?: boolean }>("/search", { method: "POST", body: JSON.stringify({ query }) }),

  // System
  metrics: () => request<Metrics>("/system/metrics"),

  // Security
  security: () => request<SecurityStatus>("/security/status"),

  // Logs
  logs: () => request<{ logs: { id: string; kind: string; message: string; createdAt: number }[] }>("/logs"),

  // Settings & providers
  settings: () => request<{ settings: Settings }>("/settings"),
  saveSettings: (settings: Partial<Settings>) => request<{ ok: boolean; settings: Settings }>("/settings", { method: "PUT", body: JSON.stringify({ settings }) }),
  providers: () => request<ProviderInfo>("/providers"),
  selectProvider: (id: string) => request<{ ok: boolean; status: ProviderInfo }>("/providers/select", { method: "POST", body: JSON.stringify({ id }) }),
};

export type { SectionId };
