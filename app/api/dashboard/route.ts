import { NextResponse } from "next/server";
import { dbOne, dbAll } from "@/lib/db";
import { currentSession } from "@/lib/auth";

export async function GET() {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const t = s.tenant_id;

  const stat = await dbOne<any>(
    `SELECT
       COALESCE(SUM(pokok_sisa) FILTER (WHERE status='aktif'),0)::bigint AS uang_beredar,
       COUNT(*) FILTER (WHERE status='aktif')::int AS gadai_aktif,
       COUNT(*) FILTER (WHERE status='aktif' AND tgl_jatuh_tempo >= current_date AND tgl_jatuh_tempo <= current_date + 7)::int AS jt_dekat,
       COUNT(*) FILTER (WHERE status='aktif' AND tgl_jatuh_tempo < current_date)::int AS lewat_tempo
     FROM gadai WHERE tenant_id = $1`,
    [t]
  );

  const bunga = await dbOne<any>(
    `SELECT COALESCE(SUM(bunga_dibayar),0)::bigint AS bunga_bulan
       FROM pembayaran
      WHERE tenant_id = $1 AND date_trunc('month', tgl) = date_trunc('month', current_date)`,
    [t]
  );

  const nasabah = await dbOne<any>(
    `SELECT COUNT(*)::int AS jumlah FROM nasabah WHERE tenant_id = $1`, [t]);

  const jatuhTempo = await dbAll(
    `SELECT g.id, g.no_sbg, g.tgl_jatuh_tempo, g.pokok_sisa, n.nama AS nasabah_nama, n.no_hp AS nasabah_hp,
            (g.tgl_jatuh_tempo - current_date) AS sisa_hari
       FROM gadai g JOIN nasabah n ON n.id = g.nasabah_id
      WHERE g.tenant_id = $1 AND g.status = 'aktif'
      ORDER BY g.tgl_jatuh_tempo ASC
      LIMIT 8`,
    [t]
  );

  const setRow = await dbOne<any>(`SELECT settings FROM tenants WHERE id = $1`, [t]);

  return NextResponse.json({
    usaha: s.nama_usaha,
    no_wa: setRow?.settings?.no_wa || null,
    stat: {
      uang_beredar: Number(stat?.uang_beredar || 0),
      gadai_aktif: stat?.gadai_aktif || 0,
      jt_dekat: stat?.jt_dekat || 0,
      lewat_tempo: stat?.lewat_tempo || 0,
      bunga_bulan: Number(bunga?.bunga_bulan || 0),
      nasabah: nasabah?.jumlah || 0,
    },
    jatuhTempo,
  });
}
