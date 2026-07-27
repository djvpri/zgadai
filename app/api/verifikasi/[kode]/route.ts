import { NextRequest, NextResponse } from "next/server";
import { dbOne, dbAll } from "@/lib/db";

// GET /api/verifikasi/[kode] — PUBLIK (tanpa login). Verifikasi keaslian SBG.
// Kembalikan data minimal & aman (tanpa detail pribadi/nominal).
function maskNama(nama: string): string {
  return (nama || "").split(/\s+/).map((w) => (w.length <= 2 ? w : w[0] + "*".repeat(Math.min(w.length - 1, 4)))).join(" ");
}

export async function GET(_req: NextRequest, { params }: { params: { kode: string } }) {
  const kode = String(params.kode || "").trim().toLowerCase();
  if (!kode || kode.length < 6) return NextResponse.json({ found: false }, { status: 404 });

  const g = await dbOne<any>(
    `SELECT g.no_sbg, g.status, g.tgl_gadai, g.tgl_jatuh_tempo, g.tgl_lunas, g.tgl_lelang,
            n.nama AS nasabah_nama, t.nama_usaha
       FROM gadai g
       JOIN nasabah n ON n.id = g.nasabah_id
       JOIN tenants t ON t.id = g.tenant_id
      WHERE lower(g.verif_kode) = $1 AND t.is_active = true
      LIMIT 1`,
    [kode]
  );
  if (!g) return NextResponse.json({ found: false }, { status: 404 });

  const barang = await dbAll<any>(
    `SELECT b.jenis, b.nama FROM barang b
       JOIN gadai g ON g.id = b.gadai_id
      WHERE lower(g.verif_kode) = $1 ORDER BY b.id`,
    [kode]
  );

  return NextResponse.json({
    found: true,
    usaha: g.nama_usaha,
    no_sbg: g.no_sbg,
    status: g.status, // aktif | lunas | lelang
    nasabah: maskNama(g.nasabah_nama),
    tgl_gadai: g.tgl_gadai,
    tgl_jatuh_tempo: g.tgl_jatuh_tempo,
    tgl_lunas: g.tgl_lunas,
    tgl_lelang: g.tgl_lelang,
    barang: barang.map((b) => ({ jenis: b.jenis, nama: b.nama })),
  });
}
