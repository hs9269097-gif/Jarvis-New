import type { IconName } from "./components/icons";
import type { SectionId } from "./types";

export interface SectionMeta {
  id: SectionId;
  label: string;
  icon: IconName;
  group: "core" | "intelligence" | "operations" | "system";
}

export const SECTIONS: SectionMeta[] = [
  { id: "home", label: "Home", icon: "home", group: "core" },
  { id: "chat", label: "Chat", icon: "chat", group: "core" },
  { id: "voice", label: "Voice", icon: "mic", group: "core" },
  { id: "tasks", label: "Tasks", icon: "tasks", group: "intelligence" },
  { id: "automation", label: "Automation", icon: "automation", group: "intelligence" },
  { id: "memory", label: "Memory", icon: "memory", group: "intelligence" },
  { id: "tools", label: "Tools", icon: "tools", group: "intelligence" },
  { id: "web", label: "Web", icon: "web", group: "intelligence" },
  { id: "files", label: "Files", icon: "files", group: "operations" },
  { id: "code", label: "Code", icon: "code", group: "operations" },
  { id: "system", label: "System", icon: "system", group: "system" },
  { id: "security", label: "Security", icon: "security", group: "system" },
  { id: "logs", label: "Logs", icon: "logs", group: "system" },
  { id: "settings", label: "Settings", icon: "settings", group: "system" },
];

export const GROUPS: { id: SectionMeta["group"]; label: string }[] = [
  { id: "core", label: "Core" },
  { id: "intelligence", label: "Intelligence" },
  { id: "operations", label: "Operations" },
  { id: "system", label: "System" },
];
