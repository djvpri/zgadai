// lib/auth.ts — auth berbasis session (cookie session_id).
import { dbOne, dbRun } from "./db";
import crypto from "crypto";

export interface SessionUser {
  session_id: string;
  user_id: number;
  tenant_id: number;
  email: string;
  nama: string;
  role: "admin" | "kasir";
  nama_usaha: string;
  slug: string;
}

// ---------- Password ----------
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return hash === verify;
}

// ---------- Session ----------
export async function createSession(userId: number, tenantId: number, days = 30): Promise<string> {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await dbRun(
    `INSERT INTO sessions (id, user_id, tenant_id, expires_at) VALUES ($1,$2,$3,$4)`,
    [sessionId, userId, tenantId, expiresAt.toISOString()]
  );
  return sessionId;
}

export async function getSession(sessionId: string): Promise<SessionUser | null> {
  if (!sessionId) return null;
  const row = await dbOne<SessionUser>(
    `SELECT s.id as session_id, s.user_id, u.tenant_id, u.email, u.nama, u.role,
            t.nama_usaha, t.slug
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       JOIN tenants t ON s.tenant_id = t.id
      WHERE s.id = $1 AND s.expires_at > now()
        AND u.is_active = true AND t.is_active = true`,
    [sessionId]
  );
  return row;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await dbRun(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
}

// ---------- Session dari cookie (untuk API route) ----------
import { cookies } from "next/headers";

export async function currentSession(): Promise<SessionUser | null> {
  const sid = cookies().get("session_id")?.value;
  if (!sid) return null;
  return getSession(sid);
}
