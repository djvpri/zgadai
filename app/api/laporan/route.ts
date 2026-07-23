import { NextRequest, NextResponse } from "next/server";
import { dbOne } from "@/lib/db";
import { currentSession } from "@/lib/auth";

// GET /api/laporan?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const t = s.tenant_id;
  const sp = req.nextUrl.searchParams;
  const today = new Date();
  const from = sp.get("from") || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const to = sp.get("to") || today.toISOString().slice(0, 10);

  // Pembayaran (kas masuk dari nasabah) dalam rentang
  const bayar = await dbOne<any>(
    `SELECT
       COALESCE(SUM(bunga_dibayar),0)::bigint AS bunga,
       COALESCE(SUM(denda_dibayar),0)::bigint AS denda,
       COALESCE(SUM(pokok_dibayar),0)::bigint AS pokok,
       COALESCE(SUM(total),0)::bigint AS total,
       COUNT(*) FILTER (WHERE jenis='tebus')::int AS n_tebus,
       COUNT(*) FILTER (WHERE jenis='perpanjang')::int AS n_perpanjang,
       COUNT(*) FILTER (WHERE jenis='cicil')::int AS n_cicil
     FROM pembayaran WHERE tenant_id=$1 AND tgl BETWEEN $2 AND $3`,
    [t, from, to]
  );

  // Pencairan pinjaman (kas keluar) = gadai baru dalam rentang
  const cair = await dbOne<any>(
    `SELECT COUNT(*)::int AS jumlah,
            COALESCE(SUM(pokok),0)::bigint AS pokok,
            COALESCE(SUM(biaya_admin),0)::bigint AS admin
     FROM gadai WHERE tenant_id=$1 AND tgl_gadai BETWEEN $2 AND $3`,
    [t, from, to]
  );

  // Lelang dalam rentang
  const lelang = await dbOne<any>(
    `SELECT COUNT(*)::int AS jumlah,
            COALESCE(SUM(harga_lelang),0)::bigint AS harga,
            COALESCE(SUM(nilai_kewajiban_lelang),0)::bigint AS kewajiban
     FROM gadai WHERE tenant_id=$1 AND tgl_lelang BETWEEN $2 AND $3`,
    [t, from, to]
  );

  // Aging portofolio aktif (saat ini, tanpa filter tanggal)
  const aging = await dbOne<any>(
    `SELECT
       COUNT(*) FILTER (WHERE tgl_jatuh_tempo > current_date + 7)::int AS belum_n,
       COALESCE(SUM(pokok_sisa) FILTER (WHERE tgl_jatuh_tempo > current_date + 7),0)::bigint AS belum_p,
       COUNT(*) FILTER (WHERE tgl_jatuh_tempo BETWEEN current_date AND current_date + 7)::int AS dekat_n,
       COALESCE(SUM(pokok_sisa) FILTER (WHERE tgl_jatuh_tempo BETWEEN current_date AND current_date + 7),0)::bigint AS dekat_p,
       COUNT(*) FILTER (WHERE tgl_jatuh_tempo < current_date)::int AS lewat_n,
       COALESCE(SUM(pokok_sisa) FILTER (WHERE tgl_jatuh_tempo < current_date),0)::bigint AS lewat_p
     FROM gadai WHERE tenant_id=$1 AND status='aktif'`,
    [t]
  );

  const N = (v: any) => Number(v || 0);
  const bunga = N(bayar?.bunga), denda = N(bayar?.denda), admin = N(cair?.admin);
  const masuk = N(bayar?.total) + N(lelang?.harga);
  const keluar = N(cair?.pokok);

  return NextResponse.json({
    periode: { from, to },
    kas: { masuk, keluar, net: masuk - keluar },
    pendapatan: { bunga, denda, admin, laba: bunga + denda + admin },
    pencairan: { jumlah: N(cair?.jumlah), pokok: N(cair?.pokok), admin },
    pembayaran: {
      n_tebus: N(bayar?.n_tebus), n_perpanjang: N(bayar?.n_perpanjang), n_cicil: N(bayar?.n_cicil),
      bunga, denda, pokok: N(bayar?.pokok), total: N(bayar?.total),
    },
    lelang: { jumlah: N(lelang?.jumlah), harga: N(lelang?.harga), kewajiban: N(lelang?.kewajiban), selisih: N(lelang?.harga) - N(lelang?.kewajiban) },
    aging: {
      belum: { n: N(aging?.belum_n), pokok: N(aging?.belum_p) },
      dekat: { n: N(aging?.dekat_n), pokok: N(aging?.dekat_p) },
      lewat: { n: N(aging?.lewat_n), pokok: N(aging?.lewat_p) },
    },
  });
}
