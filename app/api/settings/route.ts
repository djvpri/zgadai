import { NextRequest, NextResponse } from "next/server";
import { dbOne, dbRun } from "@/lib/db";
import { currentSession } from "@/lib/auth";

// GET /api/settings -> { settings } milik tenant.
export async function GET() {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const row = await dbOne<any>(`SELECT settings FROM tenants WHERE id = $1`, [s.tenant_id]);
  return NextResponse.json({ settings: row?.settings || {} });
}

// POST /api/settings -> merge setting (admin saja). Body: { harga_emas_per_gram }
export async function POST(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.role !== "admin") return NextResponse.json({ error: "Hanya admin yang boleh mengubah pengaturan" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (b.harga_emas_per_gram !== undefined) {
    patch.harga_emas_per_gram = Math.max(0, Math.round(Number(b.harga_emas_per_gram) || 0));
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Tidak ada yang diubah" }, { status: 400 });

  await dbRun(`UPDATE tenants SET settings = COALESCE(settings,'{}'::jsonb) || $1::jsonb, updated_at = now() WHERE id = $2`,
    [JSON.stringify(patch), s.tenant_id]);
  const row = await dbOne<any>(`SELECT settings FROM tenants WHERE id = $1`, [s.tenant_id]);
  return NextResponse.json({ settings: row?.settings || {} });
}
