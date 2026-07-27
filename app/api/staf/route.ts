import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbRun, dbOne } from "@/lib/db";
import { currentSession } from "@/lib/auth";

// GET /api/staf — daftar staf (admin).
export async function GET() {
  const s = await currentSession();
  if (!s || s.access !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const staf = await dbAll(
    `SELECT id, email, nama, access, is_mitra, is_investor, fee_persen, modal, bagi_hasil_persen, is_active
       FROM users WHERE tenant_id = $1 ORDER BY created_at`,
    [s.tenant_id]
  );
  return NextResponse.json({ staf, me: s.user_id });
}

// PATCH /api/staf — ubah kapabilitas staf (admin).
// Body: { id, access, is_mitra, fee_persen, is_investor, modal, bagi_hasil_persen }
export async function PATCH(req: NextRequest) {
  const s = await currentSession();
  if (!s || s.access !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const id = Number(b.id);
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const row = await dbOne<any>(`SELECT id FROM users WHERE id = $1 AND tenant_id = $2`, [id, s.tenant_id]);
  if (!row) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const access = ["admin", "marketing", "none"].includes(b.access) ? b.access : "none";
  const isMitra = !!b.is_mitra;
  const isInvestor = !!b.is_investor;
  const fee = isMitra ? Math.max(0, Math.min(100, Number(b.fee_persen) || 0)) : 0;
  const modal = isInvestor ? Math.max(0, Math.round(Number(b.modal) || 0)) : 0;
  const bagi = isInvestor ? Math.max(0, Math.min(100, Number(b.bagi_hasil_persen) || 0)) : 0;
  await dbRun(
    `UPDATE users SET access = $1, is_mitra = $2, is_investor = $3, fee_persen = $4, modal = $5, bagi_hasil_persen = $6 WHERE id = $7`,
    [access, isMitra, isInvestor, fee, modal, bagi, id]
  );
  return NextResponse.json({ ok: true });
}
