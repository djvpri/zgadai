import { NextResponse } from "next/server";
import { dbAll, dbOne } from "@/lib/db";
import { currentSession, currentNasabah } from "@/lib/auth";
import { hitungTebus } from "@/lib/gadai";

// GET /api/saya — portal pribadi terpadu (agregasi by EMAIL).
// Satu orang bisa punya beberapa "topi": nasabah (pinjaman), mitra (fee), investor (return).
// Bisa diakses baik oleh sesi staf (akses=none) maupun sesi nasabah (SSO).
export async function GET() {
  const staff = await currentSession();
  const nb = staff ? null : await currentNasabah();
  if (!staff && !nb) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = ((staff?.email || nb?.email) || "").toLowerCase();
  const nama = staff?.nama || nb?.nama || "";

  // ── Kapabilitas orang ini (baris users dengan email sama; bisa lintas toko) ──
  const capRows = email
    ? await dbAll<any>(
        `SELECT id, tenant_id, is_mitra, is_investor, fee_persen, modal, bagi_hasil_persen
           FROM users WHERE lower(email) = $1 AND is_active = true`,
        [email]
      )
    : [];

  // ── PINJAMAN (sebagai nasabah), dicocokkan lewat email ──
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
    [email || nb!.nasabah_id]
  );

  const ids = gadai.map((g) => g.id);
  const barang = ids.length
    ? await dbAll<any>(`SELECT gadai_id, nama, jenis, kadar, berat_gram, taksiran, foto_url, foto_urls FROM barang WHERE gadai_id = ANY($1::bigint[]) ORDER BY id`, [ids])
    : [];
  const pembayaran = ids.length
    ? await dbAll<any>(`SELECT gadai_id, tgl, jenis, total, bunga_dibayar, denda_dibayar, pokok_dibayar FROM pembayaran WHERE gadai_id = ANY($1::bigint[]) ORDER BY created_at DESC`, [ids])
    : [];

  const byGadai = <T extends { gadai_id: any }>(arr: T[], gid: any) => arr.filter((x) => String(x.gadai_id) === String(gid));

  const pinjaman = gadai.map((g) => {
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

  // ── FEE MITRA (sebagai mitra) ──
  const mitraIds = capRows.filter((r) => r.is_mitra).map((r) => r.id);
  let fee: any = null;
  if (mitraIds.length) {
    const rows = await dbAll<any>(
      `SELECT mf.id, mf.no_sbg, mf.nasabah, mf.bunga_dibayar, mf.fee, mf.paid, mf.tgl, t.nama_usaha AS usaha
         FROM mitra_fee mf JOIN tenants t ON t.id = mf.tenant_id
        WHERE mf.mitra_id = ANY($1::bigint[])
        ORDER BY mf.created_at DESC LIMIT 300`,
      [mitraIds]
    );
    const total = rows.reduce((a, r) => a + Number(r.fee || 0), 0);
    const belum = rows.filter((r) => !r.paid).reduce((a, r) => a + Number(r.fee || 0), 0);
    fee = {
      total, belum, jumlah: rows.length,
      entries: rows.map((r) => ({
        id: r.id, no_sbg: r.no_sbg, nasabah: r.nasabah, usaha: r.usaha,
        bunga_dibayar: Number(r.bunga_dibayar || 0), fee: Number(r.fee || 0), paid: r.paid, tgl: r.tgl,
      })),
    };
  }

  // ── RETURN INVESTOR (sebagai investor) ──
  const invRows = capRows.filter((r) => r.is_investor);
  let ret: any = null;
  if (invRows.length) {
    const items: any[] = [];
    for (const r of invRows) {
      const t = r.tenant_id;
      const pemb = await dbOne<any>(`SELECT COALESCE(SUM(bunga_dibayar + denda_dibayar),0)::bigint AS x FROM pembayaran WHERE tenant_id = $1`, [t]);
      const adm = await dbOne<any>(`SELECT COALESCE(SUM(biaya_admin),0)::bigint AS x FROM gadai WHERE tenant_id = $1`, [t]);
      const laba = Number(pemb?.x || 0) + Number(adm?.x || 0);
      const beredar = await dbOne<any>(`SELECT COALESCE(SUM(pokok_sisa) FILTER (WHERE status='aktif'),0)::bigint AS x FROM gadai WHERE tenant_id = $1`, [t]);
      const tn = await dbOne<any>(`SELECT nama_usaha FROM tenants WHERE id = $1`, [t]);
      const bagi = Number(r.bagi_hasil_persen || 0);
      items.push({
        usaha: tn?.nama_usaha || "",
        modal: Number(r.modal || 0),
        bagi_hasil_persen: bagi,
        laba,
        uang_beredar: Number(beredar?.x || 0),
        ret: Math.round((laba * bagi) / 100),
      });
    }
    ret = { items };
  }

  // ── Tarif toko + promo (untuk simulasi) ──
  const tenantId = nb?.tenant_id || staff?.tenant_id || capRows[0]?.tenant_id || gadai[0]?.tenant_id || null;
  let sim: any = null;
  let promoAktif: any = null;
  if (tenantId) {
    const setRow = await dbOne<any>(`SELECT settings FROM tenants WHERE id = $1`, [tenantId]);
    const ss = setRow?.settings || {};
    sim = {
      plafon_persen: Number(ss.plafon_persen ?? 90),
      bunga_persen: Number(ss.bunga_persen ?? 2),
      periode_hari: Number(ss.periode_hari ?? 15),
      biaya_admin: Number(ss.biaya_admin ?? 0),
      biaya_admin_persen: Number(ss.biaya_admin_persen ?? 0),
    };
    const promo = await dbOne<any>(
      `SELECT nama, diskon_bunga_persen, to_char(tgl_selesai,'YYYY-MM-DD') AS tgl_selesai
         FROM promo
        WHERE tenant_id = $1 AND aktif = true AND current_date BETWEEN tgl_mulai AND tgl_selesai
        ORDER BY tgl_mulai DESC LIMIT 1`,
      [tenantId]
    );
    promoAktif = promo ? { nama: promo.nama, diskon: Number(promo.diskon_bunga_persen), sampai: promo.tgl_selesai } : null;
  }

  return NextResponse.json({
    orang: { nama, email },
    caps: {
      pinjaman: pinjaman.length > 0,
      mitra: mitraIds.length > 0,
      investor: invRows.length > 0,
    },
    pinjaman,
    fee,
    ret,
    sim,
    promoAktif,
  });
}
