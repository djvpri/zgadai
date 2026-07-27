import { NextRequest, NextResponse } from "next/server";
import { dbOne, dbRun } from "@/lib/db";
import { currentSession } from "@/lib/auth";

// POST /api/nasabah/[id]/kapabilitas — jadikan nasabah ini Mitra/Investor (admin).
// Membuat/menautkan baris users berdasarkan EMAIL nasabah (access='none' bila baru),
// lalu set flag is_mitra/is_investor + fee/modal/bagi hasil.
// Body: { is_mitra, fee_persen, is_investor, modal, bagi_hasil_persen }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await currentSession();
  if (!s || s.access !== "admin") return NextResponse.json({ error: "Hanya admin" }, { status: 403 });

  const nasabah = await dbOne<any>(
    `SELECT id, nama, email FROM nasabah WHERE id = $1 AND tenant_id = $2`,
    [params.id, s.tenant_id]
  );
  if (!nasabah) return NextResponse.json({ error: "Nasabah tidak ditemukan" }, { status: 404 });

  const email = (nasabah.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Nasabah belum punya email. Isi email dulu di data nasabah." }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}));
  const isMitra = !!b.is_mitra;
  const isInvestor = !!b.is_investor;
  const fee = isMitra ? Math.max(0, Math.min(100, Number(b.fee_persen) || 0)) : 0;
  const modal = isInvestor ? Math.max(0, Math.round(Number(b.modal) || 0)) : 0;
  const bagi = isInvestor ? Math.max(0, Math.min(100, Number(b.bagi_hasil_persen) || 0)) : 0;

  // Sudah ada baris users dengan email ini? (email unik global)
  const existing = await dbOne<any>(`SELECT id, tenant_id, access FROM users WHERE lower(email) = $1 LIMIT 1`, [email]);

  if (existing) {
    // Jangan turunkan akses operasional yang sudah ada — cukup ubah flag.
    await dbRun(
      `UPDATE users SET is_mitra=$1, is_investor=$2, fee_persen=$3, modal=$4, bagi_hasil_persen=$5 WHERE id=$6`,
      [isMitra, isInvestor, fee, modal, bagi, existing.id]
    );
    return NextResponse.json({ ok: true, user_id: existing.id, created: false });
  }

  // Belum ada → buat baris users baru (login via SSO, tanpa password, tanpa akses operasional).
  const created = await dbOne<any>(
    `INSERT INTO users (tenant_id, email, nama, access, is_mitra, is_investor, fee_persen, modal, bagi_hasil_persen)
     VALUES ($1,$2,$3,'none',$4,$5,$6,$7,$8) RETURNING id`,
    [s.tenant_id, email, nasabah.nama, isMitra, isInvestor, fee, modal, bagi]
  );
  return NextResponse.json({ ok: true, user_id: created!.id, created: true });
}
