// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATION
// scrypt password hashing (never plaintext), opaque session tokens, cookie
// sessions, and a lightweight per-IP rate limiter.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { db, now, uid } from "./db/index.js";
import { config } from "./config.js";

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }).toString("hex");
  return `scrypt$${SCRYPT.N}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, N, salt, hash] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const candidate = crypto.scryptSync(password, salt!, SCRYPT.keylen, { N: Number(N), r: SCRYPT.r, p: SCRYPT.p }).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash!, "hex"));
  } catch {
    return false;
  }
}

function createSession(userId: string): { token: string; expiresAt: number } {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = now() + 1000 * 60 * 60 * 24 * 30; // 30 days
  db.insert("sessions", { id: token, userId, createdAt: now(), expiresAt });
  return { token, expiresAt };
}

export function destroySession(token: string) {
  db.remove("sessions", token);
}

function readToken(req: Request): string | undefined {
  const cookie = (req.headers.cookie ?? "").split(";").map((c) => c.trim()).find((c) => c.startsWith("jarvis_session="));
  if (cookie) return cookie.slice("jarvis_session=".length);
  const bearer = req.headers.authorization;
  if (bearer?.startsWith("Bearer ")) return bearer.slice(7);
  return undefined;
}

export function sessionUser(req: Request): { id: string; username: string; displayName: string; role: string } | null {
  const token = readToken(req);
  if (!token) return null;
  const session = db.find("sessions", token);
  if (!session || (session.expiresAt as number) < now()) return null;
  const user = db.find("users", session.userId as string);
  if (!user) return null;
  return { id: user.id as string, username: user.username as string, displayName: user.displayName as string, role: (user.role as string) ?? "user" };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!config.authRequired) return next();
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error: "Authentication required" });
  (req as unknown as { user: unknown }).user = user;
  next();
}

// ── Rate limiter (token bucket per IP) ────────────────────────────────────────
const buckets = new Map<string, { tokens: number; last: number }>();
export function rateLimit(max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const key = `${ip}:${req.path}`;
    const bucket = buckets.get(key) ?? { tokens: max, last: now() };
    const elapsed = now() - bucket.last;
    bucket.tokens = Math.min(max, bucket.tokens + (elapsed / windowMs) * max);
    bucket.last = now();
    if (bucket.tokens < 1) return res.status(429).json({ error: "Too many requests. Slow down." });
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    next();
  };
}

// ── Seed a demo identity so the command center is instantly usable ────────────
export function ensureDemoUser() {
  if (!db.find("users", "user_demo")) {
    db.insert("users", {
      id: "user_demo",
      username: "operator",
      displayName: "OPERATOR",
      role: "admin",
      passwordHash: hashPassword("jarvis123"),
      createdAt: now(),
    });
  }
}

export function login(username: string, password: string): { ok: boolean; token?: string; user?: object } {
  const user = db.query("users", (u) => (u.username as string).toLowerCase() === username.toLowerCase())[0];
  if (!user || !verifyPassword(password, user.passwordHash as string)) return { ok: false };
  const { token } = createSession(user.id as string);
  return { ok: true, token, user: { id: user.id, username: user.username, displayName: user.displayName } };
}

export function register(username: string, password: string): { ok: boolean; token?: string; error?: string } {
  if (db.query("users", (u) => (u.username as string).toLowerCase() === username.toLowerCase()).length) {
    return { ok: false, error: "Username already exists" };
  }
  const user = db.insert("users", {
    id: uid("user"),
    username,
    displayName: username.toUpperCase(),
    role: "user",
    passwordHash: hashPassword(password),
    createdAt: now(),
  });
  const { token } = createSession(user.id as string);
  return { ok: true, token };
}
