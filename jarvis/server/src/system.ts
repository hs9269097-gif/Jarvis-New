// ─────────────────────────────────────────────────────────────────────────────
// REAL SYSTEM TELEMETRY
// Reads actual CPU, memory, storage, network and process metrics. No simulated
// values — this is genuine server telemetry.
// ─────────────────────────────────────────────────────────────────────────────
import os from "node:os";
import fs from "node:fs";
import { config } from "./config.js";

let lastCpu = os.cpus().map((c) => ({ idle: c.times.idle, total: Object.values(c.times).reduce((a, b) => a + b, 0) }));

export function cpuUsage(): number {
  const now = os.cpus().map((c) => ({ idle: c.times.idle, total: Object.values(c.times).reduce((a, b) => a + b, 0) }));
  let idleD = 0, totalD = 0;
  for (let i = 0; i < now.length; i++) {
    idleD += now[i]!.idle - (lastCpu[i]?.idle ?? now[i]!.idle);
    totalD += now[i]!.total - (lastCpu[i]?.total ?? now[i]!.total);
  }
  lastCpu = now;
  if (totalD === 0) return 0;
  return Math.max(0, Math.min(100, ((totalD - idleD) / totalD) * 100));
}

function networkBytes(): { rx: number; tx: number } {
  try {
    const txt = fs.readFileSync("/proc/net/dev", "utf8");
    let rx = 0, tx = 0;
    for (const line of txt.split("\n").slice(2)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 10 || parts[0]?.includes("lo")) continue;
      rx += Number(parts[1] ?? 0);
      tx += Number(parts[9] ?? 0);
    }
    return { rx, tx };
  } catch {
    return { rx: 0, tx: 0 };
  }
}

let lastNet = networkBytes();
let lastNetTime = Date.now();

function diskStats() {
  try {
    const s = fs.statfsSync(config.dataDir);
    const total = (s.blocks * s.bsize) as number;
    const free = (s.bavail * s.bsize) as number;
    return { total, free, used: total - free, usedPct: total ? ((total - free) / total) * 100 : 0 };
  } catch {
    return { total: 0, free: 0, used: 0, usedPct: 0 };
  }
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

const cpuHistory: number[] = new Array(30).fill(0);

export function collectMetrics(): Metrics {
  const cpu = cpuUsage();
  cpuHistory.push(cpu);
  if (cpuHistory.length > 30) cpuHistory.shift();
  const total = os.totalmem();
  const free = os.freemem();
  const net = networkBytes();
  const dt = (Date.now() - lastNetTime) / 1000 || 1;
  const metrics: Metrics = {
    cpu,
    cpuHistory: [...cpuHistory],
    ram: { total, free, used: total - free, usedPct: ((total - free) / total) * 100 },
    storage: diskStats(),
    network: {
      rx: net.rx,
      tx: net.tx,
      rxRate: Math.max(0, (net.rx - lastNet.rx) / dt),
      txRate: Math.max(0, (net.tx - lastNet.tx) / dt),
    },
    load: os.loadavg(),
    uptime: os.uptime(),
    process: { heapUsed: process.memoryUsage().heapUsed, rss: process.memoryUsage().rss, pid: process.pid },
    cores: os.cpus().length,
    timestamp: Date.now(),
  };
  lastNet = net;
  lastNetTime = Date.now();
  return metrics;
}
