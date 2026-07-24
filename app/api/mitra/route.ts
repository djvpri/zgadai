import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbRun } from "@/lib/db";
import { currentSession } from "@/lib/auth";

// GET /api/mitra — laporan fee. Admin: semua mitra. Mitra: fee-nya sendiri.
export async function GET() {
  const s = await currentSession();
  if (!s || (s.role !== "admin" && s.role !== "mitra"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const isAdmin = s.role === "admin";
  const filter = isAdmin ? "" : "AND mf.mitra_id = $2";
  const params: any[] = isAdmin ? [s.tenant_id] : [s.tenant_id, s.user_id];

  const summary = await dbAll(
    `SELECT mf.mitra_id, u.nama AS mitra_nama,
            COALESCE(SUM(mf.fee),0)::bigint AS total,
            COALESCE(SUM(mf.fee) FILTER (WHERE NOT mf.paid),0)::bigint AS belum,
            COUNT(*)::int AS jumlah
       FROM mitra_fee mf JOIN users u ON u.id = mf.mitra_id
      WHERE mf.tenant_id = $1 ${filter}
      GROUP BY mf.mitra_id, u.nama
      ORDER BY belum DESC`,
    params
  );

  const entries = await dbAll(
    `SELECT mf.id, mf.mitra_id, u.nama AS mitra_nama, mf.no_sbg, mf.nasabah,
            mf.bunga_dibayar, mf.fee, mf.paid, mf.tgl
       FROM mitra_fee mf JOIN users u ON u.id = mf.mitra_id
      WHERE mf.tenant_id = $1 ${filter}
      ORDER BY mf.created_at DESC LIMIT 300`,
    params
  );

  return NextResponse.json({ role: s.role, summary, entries });
}

// POST /api/mitra — tandai fee mitra LUNAS (admin). Body: { mitra_id }
export async function POST(req: NextRequest) {
  const s = await currentSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const mitraId = Number(b.mitra_id);
  if (!mitraId) return NextResponse.json({ error: "mitra_id wajib" }, { status: 400 });

  await dbRun(
    `UPDATE mitra_fee SET paid = true WHERE tenant_id = $1 AND mitra_id = $2 AND NOT paid`,
    [s.tenant_id, mitraId]
  );
  return NextResponse.json({ ok: true });
}
