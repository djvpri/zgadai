import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbOne, dbRun } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

// Kontrak cross-app untuk hub Z One (djvpri/ZOne /manage).
// GET  -> { users, tenants }   POST -> { action, email, data }
// Diproteksi Bearer CROSS_APP_SECRET.
const SECRET = process.env.CROSS_APP_SECRET || "";

function authed(req: NextRequest): boolean {
  const h = req.headers.get("authorization") || "";
  return h.startsWith("Bearer ") && h.slice(7) === SECRET && SECRET.length > 0;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "usaha";
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const users = await dbAll(
    `SELECT id, email, nama, role, tenant_id, is_active FROM users ORDER BY created_at`
  );
  const tenants = await dbAll(
    `SELECT id, nama_usaha, slug, owner_email, is_active FROM tenants ORDER BY created_at`
  );
  return NextResponse.json({ users, tenants });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  const email = String(body.email || "").trim().toLowerCase();
  const data = body.data || {};

  try {
    switch (action) {
      case "create": {
        if (!email) return NextResponse.json({ error: "email wajib" }, { status: 400 });
        const existing = await dbOne<any>(`SELECT id, tenant_id FROM users WHERE lower(email) = $1`, [email]);
        if (existing) return NextResponse.json({ ok: true, id: existing.id, note: "sudah ada" });

        const namaUsaha = String(data.nama_usaha || data.nama || email.split("@")[0]);
        let slug = slugify(namaUsaha);
        // pastikan slug unik
        const clash = await dbOne(`SELECT 1 FROM tenants WHERE slug = $1`, [slug]);
        if (clash) slug = `${slug}-${Math.floor(Math.random() * 900 + 100)}`;

        const tenant = await dbOne<any>(
          `INSERT INTO tenants (nama_usaha, slug, owner_name, owner_email)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [namaUsaha, slug, String(data.nama || namaUsaha), email]
        );
        const pass = data.password ? hashPassword(String(data.password)) : null;
        const user = await dbOne<any>(
          `INSERT INTO users (tenant_id, email, password_hash, nama, role)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [tenant!.id, email, pass, String(data.nama || email), data.role === "kasir" ? "kasir" : "admin"]
        );
        return NextResponse.json({ ok: true, id: user!.id, tenant_id: tenant!.id });
      }
      case "updateRole": {
        const role = data.role === "admin" ? "admin" : "kasir";
        await dbRun(`UPDATE users SET role = $1 WHERE lower(email) = $2`, [role, email]);
        return NextResponse.json({ ok: true });
      }
      case "resetPassword": {
        if (!data.password) return NextResponse.json({ error: "password wajib" }, { status: 400 });
        await dbRun(`UPDATE users SET password_hash = $1 WHERE lower(email) = $2`,
          [hashPassword(String(data.password)), email]);
        return NextResponse.json({ ok: true });
      }
      case "delete": {
        await dbRun(`UPDATE users SET is_active = false WHERE lower(email) = $1`, [email]);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "gagal" }, { status: 500 });
  }
}
