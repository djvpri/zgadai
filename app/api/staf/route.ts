import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbRun, dbOne } from "@/lib/db";
import { currentSession } from "@/lib/auth";

// GET /api/staf — daftar staf (admin).
export async function GET() {
  const s = await currentSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const staf = await dbAll(
    `SELECT id, email, nama, role, fee_persen, is_active
       FROM users WHERE tenant_id = $1 ORDER BY created_at`,
    [s.tenant_id]
  );
  return NextResponse.json({ staf, me: s.user_id });
}

// PATCH /api/staf — ubah role & fee% staf (admin). Body: { id, role, fee_persen }
export async function PATCH(req: NextRequest) {
  const s = await currentSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const id = Number(b.id);
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const row = await dbOne<any>(`SELECT id FROM users WHERE id = $1 AND tenant_id = $2`, [id, s.tenant_id]);
  if (!row) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const role = ["admin", "kasir", "mitra"].includes(b.role) ? b.role : "kasir";
  const fee = role === "mitra" ? Math.max(0, Math.min(100, Number(b.fee_persen) || 0)) : 0;
  await dbRun(`UPDATE users SET role = $1, fee_persen = $2 WHERE id = $3`, [role, fee, id]);
  return NextResponse.json({ ok: true });
}
