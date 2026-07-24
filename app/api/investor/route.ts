import { NextResponse } from "next/server";
import { dbAll, dbOne } from "@/lib/db";
import { currentSession } from "@/lib/auth";

// GET /api/investor — bagi hasil investor dari laba usaha.
// Admin: semua investor. Investor: dirinya sendiri.
export async function GET() {
  const s = await currentSession();
  if (!s || (s.role !== "admin" && s.role !== "investor"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const t = s.tenant_id;

  // Laba usaha (kumulatif): bunga + denda dari pembayaran + biaya admin dari gadai.
  const pemb = await dbOne<any>(`SELECT COALESCE(SUM(bunga_dibayar + denda_dibayar),0)::bigint AS x FROM pembayaran WHERE tenant_id = $1`, [t]);
  const adm = await dbOne<any>(`SELECT COALESCE(SUM(biaya_admin),0)::bigint AS x FROM gadai WHERE tenant_id = $1`, [t]);
  const laba = Number(pemb?.x || 0) + Number(adm?.x || 0);

  const beredar = await dbOne<any>(`SELECT COALESCE(SUM(pokok_sisa) FILTER (WHERE status='aktif'),0)::bigint AS x FROM gadai WHERE tenant_id = $1`, [t]);
  const uangBeredar = Number(beredar?.x || 0);

  const filter = s.role === "admin" ? "" : "AND id = $2";
  const params: any[] = s.role === "admin" ? [t] : [t, s.user_id];
  const rows = await dbAll<any>(
    `SELECT id, nama, modal, bagi_hasil_persen
       FROM users WHERE tenant_id = $1 AND role = 'investor' ${filter}
      ORDER BY created_at`,
    params
  );

  const investors = rows.map((r) => ({
    id: r.id, nama: r.nama,
    modal: Number(r.modal || 0),
    bagi_hasil_persen: Number(r.bagi_hasil_persen || 0),
    ret: Math.round(laba * Number(r.bagi_hasil_persen || 0) / 100),
  }));
  const totalModal = investors.reduce((a, i) => a + i.modal, 0);

  return NextResponse.json({ role: s.role, laba, uang_beredar: uangBeredar, total_modal: totalModal, investors });
}
