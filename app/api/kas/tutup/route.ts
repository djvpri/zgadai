import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbOne, dbRun } from "@/lib/db";
import { currentSession } from "@/lib/auth";

// POST /api/kas/tutup — tutup kas hari ini: cocokkan saldo tunai sistem vs hitungan fisik.
// Body: { saldo_fisik, catatan? }
export async function POST(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.access === "none") return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const today = new Date().toISOString().slice(0, 10);

  // Saldo tunai menurut sistem (kumulatif seluruh waktu).
  const row = await dbOne<any>(
    `SELECT COALESCE(SUM(jumlah) FILTER (WHERE arah='masuk'),0)
          - COALESCE(SUM(jumlah) FILTER (WHERE arah='keluar'),0) AS saldo
       FROM kas WHERE tenant_id=$1 AND metode='tunai'`,
    [s.tenant_id]
  );
  const saldoSistem = Number(row?.saldo || 0);
  const saldoFisik = Math.round(Number(b.saldo_fisik || 0));
  const selisih = saldoFisik - saldoSistem;

  await dbRun(
    `INSERT INTO kas_tutup (tenant_id, tgl, saldo_sistem, saldo_fisik, selisih, catatan, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (tenant_id, tgl) DO UPDATE
       SET saldo_sistem=excluded.saldo_sistem, saldo_fisik=excluded.saldo_fisik,
           selisih=excluded.selisih, catatan=excluded.catatan, created_by=excluded.created_by, created_at=now()`,
    [s.tenant_id, today, saldoSistem, saldoFisik, selisih, String(b.catatan || "").slice(0, 200) || null, s.user_id]
  );
  return NextResponse.json({ ok: true, saldo_sistem: saldoSistem, saldo_fisik: saldoFisik, selisih });
}

// GET /api/kas/tutup — riwayat tutup kas (30 terakhir).
export async function GET() {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.access === "none") return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const rows = await dbAll<any>(
    `SELECT t.tgl, t.saldo_sistem, t.saldo_fisik, t.selisih, t.catatan, u.nama AS oleh
       FROM kas_tutup t LEFT JOIN users u ON u.id = t.created_by
      WHERE t.tenant_id=$1 ORDER BY t.tgl DESC LIMIT 30`,
    [s.tenant_id]
  );
  return NextResponse.json({ riwayat: rows.map((r) => ({ ...r, saldo_sistem: Number(r.saldo_sistem), saldo_fisik: Number(r.saldo_fisik), selisih: Number(r.selisih) })) });
}
