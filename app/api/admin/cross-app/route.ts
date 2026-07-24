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

        const role = data.role === "kasir" ? "kasir" : "admin";
        const pass = data.password ? hashPassword(String(data.password)) : null;
        const nama = String(data.nama || email);

        // PETUGAS (kasir): gabungkan ke toko yang sudah ada (single-shop).
        if (role === "kasir") {
          let tenantId = data.tenant_id ? Number(data.tenant_id) : null;
          if (!tenantId) {
            const tenants = await dbAll<any>(`SELECT id FROM tenants ORDER BY created_at LIMIT 2`);
            if (tenants.length === 0) return NextResponse.json({ error: "Belum ada toko. Buat admin dulu." }, { status: 400 });
            if (tenants.length > 1) return NextResponse.json({ error: "Beberapa toko ada — sertakan tenant_id" }, { status: 400 });
            tenantId = tenants[0].id;
          }
          const staff = await dbOne<any>(
            `INSERT INTO users (tenant_id, email, password_hash, nama, role)
             VALUES ($1,$2,$3,$4,'kasir') RETURNING id`,
            [tenantId, email, pass, nama]
          );
          return NextResponse.json({ ok: true, id: staff!.id, tenant_id: tenantId, role: "kasir" });
        }

        // ADMIN/PEMILIK: buat toko baru + user admin (onboarding).
        const namaUsaha = String(data.nama_usaha || data.nama || email.split("@")[0]);
        let slug = slugify(namaUsaha);
        const clash = await dbOne(`SELECT 1 FROM tenants WHERE slug = $1`, [slug]);
        if (clash) slug = `${slug}-${Math.floor(Math.random() * 900 + 100)}`;

        const tenant = await dbOne<any>(
          `INSERT INTO tenants (nama_usaha, slug, owner_name, owner_email)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [namaUsaha, slug, nama, email]
        );
        const user = await dbOne<any>(
          `INSERT INTO users (tenant_id, email, password_hash, nama, role)
           VALUES ($1,$2,$3,$4,'admin') RETURNING id`,
          [tenant!.id, email, pass, nama]
        );
        return NextResponse.json({ ok: true, id: user!.id, tenant_id: tenant!.id, role: "admin" });
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
