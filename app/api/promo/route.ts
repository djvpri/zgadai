import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbOne } from "@/lib/db";
import { currentSession } from "@/lib/auth";

// GET /api/promo — daftar promo tenant.
export async function GET() {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const promo = await dbAll(
    `SELECT id, nama,
            to_char(tgl_mulai, 'YYYY-MM-DD')   AS tgl_mulai,
            to_char(tgl_selesai, 'YYYY-MM-DD') AS tgl_selesai,
            diskon_bunga_persen, aktif
       FROM promo WHERE tenant_id = $1 ORDER BY tgl_mulai DESC`,
    [s.tenant_id]
  );
  return NextResponse.json({ promo });
}

// POST /api/promo — buat promo (admin).
export async function POST(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.role !== "admin") return NextResponse.json({ error: "Hanya admin" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const nama = String(b.nama || "").trim();
  const mulai = String(b.tgl_mulai || "").slice(0, 10);
  const selesai = String(b.tgl_selesai || "").slice(0, 10);
  const diskon = Math.min(100, Math.max(0, Number(b.diskon_bunga_persen) || 0));
  if (!nama || !mulai || !selesai) return NextResponse.json({ error: "Nama & periode wajib diisi" }, { status: 400 });
  if (selesai < mulai) return NextResponse.json({ error: "Tanggal selesai sebelum mulai" }, { status: 400 });

  const row = await dbOne(
    `INSERT INTO promo (tenant_id, nama, tgl_mulai, tgl_selesai, diskon_bunga_persen)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [s.tenant_id, nama, mulai, selesai, diskon]
  );
  return NextResponse.json({ id: (row as any)?.id });
}
