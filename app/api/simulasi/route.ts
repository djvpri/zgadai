import { NextResponse } from "next/server";
import { dbOne } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/simulasi — PUBLIK (tanpa login). Tarif toko + promo aktif untuk
// halaman simulasi calon nasabah. Single-shop: pakai toko aktif pertama.
export async function GET() {
  const t = await dbOne<any>(
    `SELECT id, nama_usaha, settings FROM tenants WHERE is_active = true ORDER BY created_at LIMIT 1`
  );
  if (!t) return NextResponse.json({ error: "Belum ada toko" }, { status: 404 });

  const s = t.settings || {};
  const sim = {
    plafon_persen: Number(s.plafon_persen ?? 90),
    bunga_persen: Number(s.bunga_persen ?? 2),
    periode_hari: Number(s.periode_hari ?? 15),
    biaya_admin: Number(s.biaya_admin ?? 0),
    biaya_admin_persen: Number(s.biaya_admin_persen ?? 0),
  };

  const promo = await dbOne<any>(
    `SELECT nama, diskon_bunga_persen, to_char(tgl_selesai,'YYYY-MM-DD') AS tgl_selesai
       FROM promo
      WHERE tenant_id = $1 AND aktif = true AND current_date BETWEEN tgl_mulai AND tgl_selesai
      ORDER BY tgl_mulai DESC LIMIT 1`,
    [t.id]
  );
  const promoAktif = promo ? { nama: promo.nama, diskon: Number(promo.diskon_bunga_persen), sampai: promo.tgl_selesai } : null;

  return NextResponse.json({ usaha: t.nama_usaha, alamat: s.alamat_toko || null, wa: s.no_wa || null, sim, promoAktif });
}
