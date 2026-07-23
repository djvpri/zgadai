import { NextRequest, NextResponse } from "next/server";
import { dbOne, dbAll } from "@/lib/db";
import { currentSession } from "@/lib/auth";

// GET /api/nasabah/[id] -> { nasabah, gadai[] }
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const nasabah = await dbOne<any>(
    `SELECT * FROM nasabah WHERE id = $1 AND tenant_id = $2`, [params.id, s.tenant_id]);
  if (!nasabah) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const gadai = await dbAll(
    `SELECT id, no_sbg, status, tgl_gadai, tgl_jatuh_tempo, taksiran, pokok, pokok_sisa
       FROM gadai WHERE nasabah_id = $1 AND tenant_id = $2
      ORDER BY (status='aktif') DESC, created_at DESC`,
    [params.id, s.tenant_id]
  );

  return NextResponse.json({ nasabah, gadai });
}

// PATCH /api/nasabah/[id] -> update data nasabah
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const row = await dbOne<any>(`SELECT id FROM nasabah WHERE id = $1 AND tenant_id = $2`, [params.id, s.tenant_id]);
  if (!row) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const nama = String(b.nama || "").trim();
  if (!nama) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });

  const email = b.email ? String(b.email).trim().toLowerCase() : null;
  await dbOne(
    `UPDATE nasabah SET nama=$1, no_ktp=$2, no_hp=$3, alamat=$4, catatan=$5, email=$6, updated_at=now()
     WHERE id=$7 RETURNING id`,
    [nama, b.no_ktp || null, b.no_hp || null, b.alamat || null, b.catatan || null, email, params.id]
  );
  return NextResponse.json({ ok: true });
}
