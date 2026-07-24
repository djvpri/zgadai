import { NextRequest, NextResponse } from "next/server";
import { dbOne, dbRun } from "@/lib/db";
import { currentSession } from "@/lib/auth";

// PATCH /api/promo/[id] — toggle aktif (admin).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await currentSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const row = await dbOne<any>(`SELECT id FROM promo WHERE id = $1 AND tenant_id = $2`, [params.id, s.tenant_id]);
  if (!row) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  if (typeof b.aktif === "boolean") {
    await dbRun(`UPDATE promo SET aktif = $1 WHERE id = $2`, [b.aktif, params.id]);
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/promo/[id] (admin).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await currentSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  await dbRun(`DELETE FROM promo WHERE id = $1 AND tenant_id = $2`, [params.id, s.tenant_id]);
  return NextResponse.json({ ok: true });
}
