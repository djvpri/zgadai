import { NextRequest, NextResponse } from "next/server";
import pool, { dbAll } from "@/lib/db";
import { currentSession } from "@/lib/auth";
import { tambahHari } from "@/lib/gadai";

// GET /api/gadai?status=aktif|lunas|lelang&q=...
export async function GET(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") || "";
  const q = (sp.get("q") || "").trim().toLowerCase();

  const rows = await dbAll(
    `SELECT g.id, g.no_sbg, g.tgl_gadai, g.tgl_jatuh_tempo, g.periode_hari, g.bunga_persen,
            g.taksiran, g.pokok, g.pokok_sisa, g.status, n.nama AS nasabah_nama, n.no_hp
       FROM gadai g JOIN nasabah n ON n.id = g.nasabah_id
      WHERE g.tenant_id = $1
        AND ($2 = '' OR g.status = $2)
        AND ($3 = '' OR lower(n.nama) LIKE '%'||$3||'%' OR lower(g.no_sbg) LIKE '%'||$3||'%')
      ORDER BY (g.status = 'aktif') DESC, g.tgl_jatuh_tempo ASC
      LIMIT 300`,
    [s.tenant_id, status, q]
  );
  return NextResponse.json({ gadai: rows });
}

// POST /api/gadai — buat pinjaman baru
export async function POST(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  const nasabahId = Number(b.nasabah_id);
  const barang: any[] = Array.isArray(b.barang) ? b.barang : [];
  const pokok = Math.round(Number(b.pokok || 0));
  if (!nasabahId) return NextResponse.json({ error: "Nasabah wajib dipilih" }, { status: 400 });
  if (barang.length === 0) return NextResponse.json({ error: "Minimal 1 barang jaminan" }, { status: 400 });
  if (pokok <= 0) return NextResponse.json({ error: "Uang pinjaman harus > 0" }, { status: 400 });

  const tglGadai = b.tgl_gadai || new Date().toISOString().slice(0, 10);
  const tempoHari = Math.max(1, Number(b.tempo_hari || 30));
  const periodeHari = Math.max(1, Number(b.periode_hari || 15));
  const bungaPersen = Number(b.bunga_persen || 0);
  const biayaAdmin = Math.round(Number(b.biaya_admin || 0));
  const jatuhTempo = tambahHari(tglGadai, tempoHari);
  const taksiran = barang.reduce((sum, x) => sum + Math.round(Number(x.taksiran || 0)), 0);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query(
      `INSERT INTO gadai (tenant_id, no_sbg, nasabah_id, tgl_gadai, tgl_jatuh_tempo,
                          periode_hari, bunga_persen, taksiran, pokok, pokok_sisa, biaya_admin, keterangan, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,$12) RETURNING id`,
      [s.tenant_id, "tmp-" + Date.now(), nasabahId, tglGadai, jatuhTempo,
       periodeHari, bungaPersen, taksiran, pokok, biayaAdmin, b.keterangan || null, s.user_id]
    );
    const id = ins.rows[0].id as number;
    const noSbg = "SBG" + String(id).padStart(5, "0");
    await client.query(`UPDATE gadai SET no_sbg = $1 WHERE id = $2`, [noSbg, id]);

    for (const x of barang) {
      const foto = typeof x.foto === "string" && x.foto.startsWith("data:image/") && x.foto.length < 300_000
        ? x.foto : null;
      await client.query(
        `INSERT INTO barang (gadai_id, jenis, nama, deskripsi, berat_gram, kadar, taksiran, foto_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, x.jenis || "lainnya", String(x.nama || "Barang"), x.deskripsi || null,
         x.berat_gram || null, x.kadar || null, Math.round(Number(x.taksiran || 0)), foto]
      );
    }
    await client.query("COMMIT");
    return NextResponse.json({ id, no_sbg: noSbg });
  } catch (e: any) {
    await client.query("ROLLBACK").catch(() => {});
    return NextResponse.json({ error: e.message || "Gagal menyimpan gadai" }, { status: 500 });
  } finally {
    client.release();
  }
}
