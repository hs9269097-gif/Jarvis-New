// Server-Sent-Events streaming client for chat & agent events.
export interface StreamEvent {
  type: string;
  state?: string;
  steps?: string[];
  tool?: { id: string; name: string; icon: string };
  status?: string;
  output?: string;
  demo?: boolean;
  text?: string;
  answer?: string;
  message?: string;
  retryable?: boolean;
  id?: string;
}

export interface StreamHandlers {
  onEvent: (e: StreamEvent) => void;
}

export function streamChat(
  message: string,
  conversationId: string | null,
  temperature: number,
  handlers: StreamHandlers,
): { cancel: () => void } {
  const controller = new AbortController();
  (async () => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId, temperature }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Chat failed (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith("data:")) continue;
          try {
            const event = JSON.parse(s.slice(5).trim()) as StreamEvent;
            handlers.onEvent(event);
          } catch { /* partial chunk */ }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        handlers.onEvent({ type: "error", message: (e as Error).message, retryable: true });
      }
    }
  })();
  return { cancel: () => controller.abort() };
}

export function connectSSE(path: string, handlers: StreamHandlers): { close: () => void } {
  const es = new EventSource(path);
  es.onmessage = (ev) => {
    try { handlers.onEvent(JSON.parse(ev.data)); } catch { /* ignore */ }
  };
  es.addEventListener("metrics", (ev) => {
    try { handlers.onEvent({ type: "metrics", ...JSON.parse((ev as MessageEvent).data) }); } catch { /* ignore */ }
  });
  es.addEventListener("task", (ev) => {
    try { handlers.onEvent({ type: "task_event", ...JSON.parse((ev as MessageEvent).data) }); } catch { /* ignore */ }
  });
  es.addEventListener("security_event", (ev) => {
    try { handlers.onEvent({ type: "security_event", ...JSON.parse((ev as MessageEvent).data) }); } catch { /* ignore */ }
  });
  return { close: () => es.close() };
}
