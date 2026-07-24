import { NextResponse } from "next/server";
import { dbAll, dbOne } from "@/lib/db";
import { currentNasabah } from "@/lib/auth";
import { hitungTebus } from "@/lib/gadai";

// GET /api/saya — daftar pinjaman milik nasabah yang login (SSO).
// Cocokkan lewat EMAIL → bisa lintas tempat gadai (ekosistem).
export async function GET() {
  const nb = await currentNasabah();
  if (!nb) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const email = (nb.email || "").toLowerCase();

  // Kalau email kosong (data lama), batasi ke nasabah_id sesi saja.
  const gadai = await dbAll<any>(
    email
      ? `SELECT g.*, t.nama_usaha, t.settings
           FROM gadai g JOIN nasabah n ON n.id = g.nasabah_id JOIN tenants t ON t.id = g.tenant_id
          WHERE lower(n.email) = $1
          ORDER BY (g.status='aktif') DESC, g.tgl_jatuh_tempo ASC`
      : `SELECT g.*, t.nama_usaha, t.settings
           FROM gadai g JOIN tenants t ON t.id = g.tenant_id
          WHERE g.nasabah_id = $1
          ORDER BY (g.status='aktif') DESC, g.tgl_jatuh_tempo ASC`,
    [email || nb.nasabah_id]
  );

  const ids = gadai.map((g) => g.id);
  const barang = ids.length
    ? await dbAll<any>(`SELECT gadai_id, nama, jenis, kadar, berat_gram, taksiran, foto_url, foto_urls FROM barang WHERE gadai_id = ANY($1::bigint[]) ORDER BY id`, [ids])
    : [];
  const pembayaran = ids.length
    ? await dbAll<any>(`SELECT gadai_id, tgl, jenis, total, bunga_dibayar, denda_dibayar, pokok_dibayar FROM pembayaran WHERE gadai_id = ANY($1::bigint[]) ORDER BY created_at DESC`, [ids])
    : [];

  const byGadai = <T extends { gadai_id: any }>(arr: T[], gid: any) => arr.filter((x) => String(x.gadai_id) === String(gid));

  const result = gadai.map((g) => {
    const dendaPersen = Number(g.settings?.denda_persen_per_hari || 0);
    const tebus = g.status === "aktif"
      ? hitungTebus({
          tgl_gadai: g.tgl_gadai, tgl_jatuh_tempo: g.tgl_jatuh_tempo,
          periode_hari: g.periode_hari, bunga_persen: Number(g.bunga_persen), pokok_sisa: Number(g.pokok_sisa),
        }, dendaPersen)
      : null;
    return {
      id: g.id, no_sbg: g.no_sbg, status: g.status, usaha: g.nama_usaha,
      wa: g.settings?.no_wa || null,
      promo_nama: g.promo_nama, promo_diskon: g.promo_diskon,
      tgl_gadai: g.tgl_gadai, tgl_jatuh_tempo: g.tgl_jatuh_tempo,
      bunga_persen: g.bunga_persen, periode_hari: g.periode_hari,
      taksiran: Number(g.taksiran), pokok: Number(g.pokok), pokok_sisa: Number(g.pokok_sisa),
      tgl_lunas: g.tgl_lunas, harga_lelang: g.harga_lelang, nilai_kewajiban_lelang: g.nilai_kewajiban_lelang, tgl_lelang: g.tgl_lelang,
      barang: byGadai(barang, g.id),
      pembayaran: byGadai(pembayaran, g.id),
      tebus,
    };
  });

  // Tarif toko nasabah (untuk simulasi pinjaman).
  const setRow = await dbOne<any>(`SELECT settings FROM tenants WHERE id = $1`, [nb.tenant_id]);
  const ss = setRow?.settings || {};
  const sim = {
    plafon_persen: Number(ss.plafon_persen ?? 90),
    bunga_persen: Number(ss.bunga_persen ?? 2),
    periode_hari: Number(ss.periode_hari ?? 15),
    biaya_admin: Number(ss.biaya_admin ?? 0),
    biaya_admin_persen: Number(ss.biaya_admin_persen ?? 0),
  };

  return NextResponse.json({ nasabah: { nama: nb.nama, email: nb.email }, gadai: result, sim });
}
