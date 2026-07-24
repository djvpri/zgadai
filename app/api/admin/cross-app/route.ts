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
    `SELECT id, email, nama,
            CASE WHEN role = 'admin' THEN 'ADMIN' ELSE 'USER' END AS role,
            tenant_id, is_active AS active, is_active
       FROM users ORDER BY created_at`
  );
  const tenants = await dbAll(
    `SELECT id, nama_usaha AS name, nama_usaha, slug, owner_email, is_active AS active, is_active
       FROM tenants ORDER BY created_at`
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

        // Z One mengirim "admin" / "user" → petugas = kasir, selain "admin".
        const role = String(data.role || "").toLowerCase() === "admin" ? "admin" : "kasir";
        const pass = data.password ? hashPassword(String(data.password)) : null;
        const nama = String(data.nama || email);

        const tenants = await dbAll<any>(`SELECT id FROM tenants ORDER BY created_at LIMIT 2`);

        // Belum ada toko → bootstrap: buat toko + user pertama sebagai admin/pemilik.
        if (tenants.length === 0) {
          const namaUsaha = String(data.nama_usaha || data.nama || email.split("@")[0]);
          let slug = slugify(namaUsaha);
          const clash = await dbOne(`SELECT 1 FROM tenants WHERE slug = $1`, [slug]);
          if (clash) slug = `${slug}-${Math.floor(Math.random() * 900 + 100)}`;
          const tenant = await dbOne<any>(
            `INSERT INTO tenants (nama_usaha, slug, owner_name, owner_email) VALUES ($1,$2,$3,$4) RETURNING id`,
            [namaUsaha, slug, nama, email]
          );
          const owner = await dbOne<any>(
            `INSERT INTO users (tenant_id, email, password_hash, nama, role) VALUES ($1,$2,$3,$4,'admin') RETURNING id`,
            [tenant!.id, email, pass, nama]
          );
          return NextResponse.json({ ok: true, id: owner!.id, tenant_id: tenant!.id, role: "admin" });
        }

        // Sudah ada toko → tambahkan user ke toko itu dengan peran yang dipilih.
        const tenantId = data.tenant_id ? Number(data.tenant_id) : (tenants.length === 1 ? tenants[0].id : null);
        if (!tenantId) return NextResponse.json({ error: "Beberapa toko ada — sertakan tenant_id" }, { status: 400 });

        const staff = await dbOne<any>(
          `INSERT INTO users (tenant_id, email, password_hash, nama, role) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [tenantId, email, pass, nama, role]
        );
        return NextResponse.json({ ok: true, id: staff!.id, tenant_id: tenantId, role });
      }
      case "updateRole": {
        const role = String(data.role || "").toLowerCase() === "admin" ? "admin" : "kasir";
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
      case "reactivate": {
        await dbRun(`UPDATE users SET is_active = true WHERE lower(email) = $1`, [email]);
        return NextResponse.json({ ok: true });
      }
      case "moveTenant": {
        const tid = Number(data.tenantId ?? data.tenant_id);
        if (!tid) return NextResponse.json({ error: "tenantId wajib" }, { status: 400 });
        if (data.userId) await dbRun(`UPDATE users SET tenant_id = $1 WHERE id = $2`, [tid, Number(data.userId)]);
        else if (email) await dbRun(`UPDATE users SET tenant_id = $1 WHERE lower(email) = $2`, [tid, email]);
        return NextResponse.json({ ok: true });
      }
      case "deleteTenant": {
        await dbRun(`UPDATE tenants SET is_active = false WHERE id = $1`, [Number(data.tenantId ?? data.tenant_id)]);
        return NextResponse.json({ ok: true });
      }
      case "reactivateTenant": {
        await dbRun(`UPDATE tenants SET is_active = true WHERE id = $1`, [Number(data.tenantId ?? data.tenant_id)]);
        return NextResponse.json({ ok: true });
      }
      case "createTenant": {
        const nm = String(data.name || "").trim() || "Toko";
        let slug = slugify(nm);
        const clash = await dbOne(`SELECT 1 FROM tenants WHERE slug = $1`, [slug]);
        if (clash) slug = `${slug}-${Math.floor(Math.random() * 900 + 100)}`;
        const t = await dbOne<any>(
          `INSERT INTO tenants (nama_usaha, slug, owner_email) VALUES ($1,$2,$3) RETURNING id`,
          [nm, slug, `noreply+${Date.now()}@zgadai.local`]
        );
        return NextResponse.json({ ok: true, id: t!.id });
      }
      case "updatePlan": {
        // ZGadai tidak memakai paket berlangganan — abaikan (no-op).
        return NextResponse.json({ ok: true, note: "tanpa sistem paket" });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "gagal" }, { status: 500 });
  }
}
