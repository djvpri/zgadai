import { NextRequest, NextResponse } from "next/server";
import { dbOne, dbAll } from "@/lib/db";
import { currentSession } from "@/lib/auth";

// GET /api/nasabah/[id] -> { nasabah, gadai[] }
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.access === "none") return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const nasabah = await dbOne<any>(
    `SELECT * FROM nasabah WHERE id = $1 AND tenant_id = $2`, [params.id, s.tenant_id]);
  if (!nasabah) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const gadai = await dbAll(
    `SELECT id, no_sbg, status, tgl_gadai, tgl_jatuh_tempo, taksiran, pokok, pokok_sisa
       FROM gadai WHERE nasabah_id = $1 AND tenant_id = $2
      ORDER BY (status='aktif') DESC, created_at DESC`,
    [params.id, s.tenant_id]
  );

  // Kapabilitas: apakah email nasabah ini juga punya baris users (mitra/investor)?
  const email = (nasabah.email || "").toLowerCase();
  const u = email
    ? await dbOne<any>(
        `SELECT id, access, is_mitra, is_investor, fee_persen, modal, bagi_hasil_persen
           FROM users WHERE lower(email) = $1 LIMIT 1`,
        [email]
      )
    : null;
  const kapabilitas = {
    has_email: !!email,
    is_mitra: !!u?.is_mitra,
    is_investor: !!u?.is_investor,
    fee_persen: Number(u?.fee_persen || 0),
    modal: Number(u?.modal || 0),
    bagi_hasil_persen: Number(u?.bagi_hasil_persen || 0),
    access: u?.access || null, // null = belum jadi user
  };

  return NextResponse.json({ nasabah, gadai, kapabilitas, admin: s.access === "admin" });
}

// PATCH /api/nasabah/[id] -> update data nasabah
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.access === "none") return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const row = await dbOne<any>(`SELECT id FROM nasabah WHERE id = $1 AND tenant_id = $2`, [params.id, s.tenant_id]);
  if (!row) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const nama = String(b.nama || "").trim();
  if (!nama) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });

  const email = b.email ? String(b.email).trim().toLowerCase() : null;
  await dbOne(
    `UPDATE nasabah SET nama=$1, no_ktp=$2, no_hp=$3, alamat=$4, catatan=$5, email=$6,
            bank_nama=$7, no_rekening=$8, rekening_atas_nama=$9, updated_at=now()
     WHERE id=$10 RETURNING id`,
    [nama, b.no_ktp || null, b.no_hp || null, b.alamat || null, b.catatan || null, email,
     b.bank_nama || null, b.no_rekening || null, b.rekening_atas_nama || null, params.id]
  );
  return NextResponse.json({ ok: true });
}
