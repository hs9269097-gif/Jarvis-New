// ─────────────────────────────────────────────────────────────────────────────
// REAL-TIME EVENT HUB (Server-Sent Events)
// Lightweight pub/sub: routes push typed events, connected UI clients receive
// them without polling. One stream multiplexes system metrics, task progress,
// security events and notifications.
// ─────────────────────────────────────────────────────────────────────────────
import type { Response } from "express";

type Client = { id: string; res: Response };

const clients = new Set<Client>();

export function subscribe(res: Response): () => void {
  const client: Client = { id: Math.random().toString(36).slice(2), res };
  clients.add(client);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`retry: 2000\n\n`);
  const ping = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { /* closed */ }
  }, 25000);
  const cleanup = () => {
    clearInterval(ping);
    clients.delete(client);
  };
  res.on("close", cleanup);
  return cleanup;
}

export function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try { client.res.write(payload); } catch { clients.delete(client); }
  }
}

export function clientCount(): number {
  return clients.size;
}
