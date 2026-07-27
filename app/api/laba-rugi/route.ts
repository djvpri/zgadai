import { NextRequest, NextResponse } from "next/server";
import { dbOne } from "@/lib/db";
import { currentSession } from "@/lib/auth";

// GET /api/laba-rugi?bulan=YYYY-MM — laporan laba-rugi bulanan (admin), basis realisasi/kas.
export async function GET(req: NextRequest) {
  const s = await currentSession();
  if (!s || s.access !== "admin") return NextResponse.json({ error: "Hanya admin" }, { status: 403 });
  const t = s.tenant_id;

  const now = new Date();
  const raw = req.nextUrl.searchParams.get("bulan") || "";
  const bulan = /^\d{4}-\d{2}$/.test(raw) ? raw : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const m = `${bulan}-01`; // patokan bulan

  const num = (v: any) => Number(v || 0);

  // Pendapatan
  const pemb = await dbOne<any>(
    `SELECT COALESCE(SUM(bunga_dibayar),0)::bigint AS bunga, COALESCE(SUM(denda_dibayar),0)::bigint AS denda
       FROM pembayaran WHERE tenant_id=$1 AND date_trunc('month',tgl)=date_trunc('month',$2::date)`,
    [t, m]
  );
  const adm = await dbOne<any>(
    `SELECT COALESCE(SUM(biaya_admin),0)::bigint AS admin
       FROM gadai WHERE tenant_id=$1 AND date_trunc('month',tgl_gadai)=date_trunc('month',$2::date)`,
    [t, m]
  );
  const lel = await dbOne<any>(
    `SELECT COALESCE(SUM(GREATEST(0, LEAST(harga_lelang, nilai_kewajiban_lelang) - pokok_sisa)),0)::bigint AS untung,
            COALESCE(SUM(GREATEST(0, pokok_sisa - harga_lelang)),0)::bigint AS rugi
       FROM gadai WHERE tenant_id=$1 AND status='lelang' AND date_trunc('month',tgl_lelang)=date_trunc('month',$2::date)`,
    [t, m]
  );

  // Beban
  const ops = await dbOne<any>(
    `SELECT COALESCE(SUM(jumlah),0)::bigint AS x
       FROM kas WHERE tenant_id=$1 AND arah='keluar' AND kategori='operasional'
        AND date_trunc('month',tgl)=date_trunc('month',$2::date)`,
    [t, m]
  );
  const fee = await dbOne<any>(
    `SELECT COALESCE(SUM(fee),0)::bigint AS x
       FROM mitra_fee WHERE tenant_id=$1 AND date_trunc('month',tgl)=date_trunc('month',$2::date)`,
    [t, m]
  );

  const pendapatan = {
    bunga: num(pemb?.bunga), denda: num(pemb?.denda), admin: num(adm?.admin), lelang_untung: num(lel?.untung),
  };
  const beban = {
    operasional: num(ops?.x), fee_mitra: num(fee?.x), lelang_rugi: num(lel?.rugi),
  };
  const totalPendapatan = pendapatan.bunga + pendapatan.denda + pendapatan.admin + pendapatan.lelang_untung;
  const totalBeban = beban.operasional + beban.fee_mitra + beban.lelang_rugi;

  return NextResponse.json({
    bulan, usaha: s.nama_usaha,
    pendapatan, beban,
    total_pendapatan: totalPendapatan,
    total_beban: totalBeban,
    laba_bersih: totalPendapatan - totalBeban,
  });
}
