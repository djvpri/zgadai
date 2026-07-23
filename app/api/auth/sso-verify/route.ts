import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool, { dbOne } from "@/lib/db";
import { createSession } from "@/lib/auth";

const SECRET = process.env.CROSS_APP_SECRET || "";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "usaha";
}

// Buat usaha (tenant) + admin baru untuk email ini (self-service onboarding).
async function provision(email: string, nama: string): Promise<{ id: number; tenant_id: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let slug = slugify(nama || email.split("@")[0]);
    const clash = await client.query(`SELECT 1 FROM tenants WHERE slug = $1`, [slug]);
    if (clash.rowCount) slug = `${slug}-${Math.floor(Math.random() * 900 + 100)}`;
    const t = await client.query(
      `INSERT INTO tenants (nama_usaha, slug, owner_name, owner_email) VALUES ($1,$2,$3,$4) RETURNING id`,
      [nama || "Usaha Gadai", slug, nama || email, email]
    );
    const u = await client.query(
      `INSERT INTO users (tenant_id, email, nama, role) VALUES ($1,$2,$3,'admin') RETURNING id`,
      [t.rows[0].id, email, nama || email]
    );
    await client.query("COMMIT");
    return { id: u.rows[0].id, tenant_id: t.rows[0].id };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

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

    let user = await dbOne<any>(
      `SELECT u.id, u.is_active, u.tenant_id, t.is_active as tenant_active
         FROM users u JOIN tenants t ON t.id = u.tenant_id
        WHERE lower(u.email) = $1 LIMIT 1`,
      [email]
    );

    // Auto-provisioning saat pertama kali akses lewat SSO.
    if (!user) {
      const created = await provision(email, String(payload.name || "").trim());
      user = { id: created.id, is_active: true, tenant_id: created.tenant_id, tenant_active: true };
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
