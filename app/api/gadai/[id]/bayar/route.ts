import { NextRequest, NextResponse } from "next/server";
import pool, { dbOne } from "@/lib/db";
import { currentSession } from "@/lib/auth";
import { hitungBunga, periodeBerjalan, selisihHari, tambahHari } from "@/lib/gadai";

// POST /api/gadai/[id]/bayar  { jenis, pokok_dibayar? }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const jenis = b.jenis as string;
  if (!["tebus", "perpanjang", "cicil"].includes(jenis))
    return NextResponse.json({ error: "Jenis tidak valid" }, { status: 400 });

  const g = await dbOne<any>(
    `SELECT * FROM gadai WHERE id = $1 AND tenant_id = $2`, [params.id, s.tenant_id]);
  if (!g) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  if (g.status !== "aktif") return NextResponse.json({ error: "Gadai sudah tidak aktif" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const pokokSisa = Number(g.pokok_sisa);
  const periode = periodeBerjalan(g.tgl_gadai, today, g.periode_hari);
  const bunga = hitungBunga(pokokSisa, Number(g.bunga_persen), periode);
  const tenorHari = Math.max(1, selisihHari(g.tgl_gadai, g.tgl_jatuh_tempo));
  const jatuhBaru = tambahHari(today, tenorHari);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let pokokDibayar = 0;
    let total = 0;
    let jatuhTempoBaru: string | null = null;

    if (jenis === "tebus") {
      pokokDibayar = pokokSisa;
      total = pokokSisa + bunga;
      await client.query(
        `UPDATE gadai SET status='lunas', pokok_sisa=0, tgl_lunas=$1, updated_at=now() WHERE id=$2`,
        [today, g.id]
      );
    } else if (jenis === "perpanjang") {
      total = bunga;
      jatuhTempoBaru = jatuhBaru;
      await client.query(
        `UPDATE gadai SET tgl_gadai=$1, tgl_jatuh_tempo=$2, updated_at=now() WHERE id=$3`,
        [today, jatuhBaru, g.id]
      );
    } else {
      // cicil: bayar bunga + kurangi pokok, reset siklus bunga
      pokokDibayar = Math.round(Number(b.pokok_dibayar || 0));
      if (pokokDibayar <= 0) return failTx(client, "Nominal cicilan pokok harus > 0");
      if (pokokDibayar > pokokSisa) return failTx(client, "Cicilan melebihi sisa pokok");
      total = bunga + pokokDibayar;
      const sisaBaru = pokokSisa - pokokDibayar;
      if (sisaBaru <= 0) {
        await client.query(
          `UPDATE gadai SET pokok_sisa=0, status='lunas', tgl_lunas=$1, updated_at=now() WHERE id=$2`,
          [today, g.id]
        );
      } else {
        jatuhTempoBaru = jatuhBaru;
        await client.query(
          `UPDATE gadai SET pokok_sisa=$1, tgl_gadai=$2, tgl_jatuh_tempo=$3, updated_at=now() WHERE id=$4`,
          [sisaBaru, today, jatuhBaru, g.id]
        );
      }
    }

    await client.query(
      `INSERT INTO pembayaran (tenant_id, gadai_id, tgl, jenis, bunga_dibayar, pokok_dibayar, total, jatuh_tempo_baru, keterangan, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [s.tenant_id, g.id, today, jenis, bunga, pokokDibayar, total, jatuhTempoBaru, b.keterangan || null, s.user_id]
    );
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, jenis, bunga, pokok_dibayar: pokokDibayar, total, jatuh_tempo_baru: jatuhTempoBaru });
  } catch (e: any) {
    await client.query("ROLLBACK").catch(() => {});
    return NextResponse.json({ error: e.message || "Gagal memproses" }, { status: 500 });
  } finally {
    client.release();
  }
}

// Hanya ROLLBACK di sini; pelepasan client ditangani oleh finally di POST.
async function failTx(client: any, msg: string) {
  await client.query("ROLLBACK").catch(() => {});
  return NextResponse.json({ error: msg }, { status: 400 });
}
