import { NextRequest, NextResponse } from "next/server";
import { dbOne, dbRun } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

// Login lokal (fallback / admin). Utama tetap SSO Z One.
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const em = String(email || "").trim().toLowerCase();
    if (!em || !password) return NextResponse.json({ error: "Email & password wajib diisi" }, { status: 400 });

    const user = await dbOne<any>(
      `SELECT id, tenant_id, password_hash, is_active FROM users WHERE lower(email) = $1 LIMIT 1`,
      [em]
    );
    if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
    }

    await dbRun(`UPDATE users SET last_login = now() WHERE id = $1`, [user.id]);
    const sessionId = await createSession(user.id, user.tenant_id);
    const res = NextResponse.json({ success: true, redirect: "/dashboard" });
    res.cookies.set("session_id", sessionId, {
      httpOnly: true, path: "/", maxAge: 30 * 24 * 3600, sameSite: "lax", secure: true,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Gagal login" }, { status: 500 });
  }
}
