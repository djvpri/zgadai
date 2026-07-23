import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { dbOne } from "@/lib/db";
import { createSession } from "@/lib/auth";

const SECRET = process.env.CROSS_APP_SECRET || "";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: "Token wajib diisi" }, { status: 400 });

    let payload: any;
    try {
      payload = jwt.verify(token, SECRET);
    } catch {
      return NextResponse.json({ error: "Token SSO tidak valid atau kedaluwarsa" }, { status: 401 });
    }

    if (payload.app !== "zgadai") {
      return NextResponse.json({ error: "Token ini bukan untuk ZGadai" }, { status: 400 });
    }

    const email = String(payload.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Email tidak ada di token" }, { status: 400 });

    const user = await dbOne<any>(
      `SELECT u.id, u.role, u.is_active, u.tenant_id, t.is_active as tenant_active
         FROM users u JOIN tenants t ON t.id = u.tenant_id
        WHERE lower(u.email) = $1 LIMIT 1`,
      [email]
    );

    if (!user) {
      return NextResponse.json(
        { error: `Akun ${email} belum terdaftar di ZGadai. Hubungi admin.`, code: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }
    if (!user.is_active) return NextResponse.json({ error: "Akun Anda dinonaktifkan." }, { status: 403 });
    if (!user.tenant_active) return NextResponse.json({ error: "Usaha Anda dinonaktifkan." }, { status: 403 });

    const sessionId = await createSession(user.id, user.tenant_id);
    const res = NextResponse.json({ success: true, redirect: "/dashboard" });
    res.cookies.set("session_id", sessionId, {
      httpOnly: true, path: "/", maxAge: 30 * 24 * 3600, sameSite: "lax", secure: true,
    });
    return res;
  } catch (err) {
    console.error("SSO verify error:", err);
    return NextResponse.json({ error: "Gagal memproses SSO" }, { status: 500 });
  }
}
