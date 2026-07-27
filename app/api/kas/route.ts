import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbOne, dbRun } from "@/lib/db";
import { currentSession } from "@/lib/auth";

const KATEGORI = ["pencairan", "pembayaran", "operasional", "modal", "prive", "lelang", "lainnya"];

// GET /api/kas?from&to — daftar arus kas + ringkasan saldo (tunai/transfer, all-time).
export async function GET(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.access === "none") return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const today = new Date().toISOString().slice(0, 10);
  const first = today.slice(0, 8) + "01";
  const from = req.nextUrl.searchParams.get("from") || first;
  const to = req.nextUrl.searchParams.get("to") || today;

  const entries = await dbAll<any>(
    `SELECT k.id, k.tgl, k.arah, k.kategori, k.metode, k.jumlah, k.keterangan,
            k.ref_gadai_id, k.ref_pembayaran_id, u.nama AS oleh
       FROM kas k LEFT JOIN users u ON u.id = k.created_by
      WHERE k.tenant_id = $1 AND k.tgl BETWEEN $2 AND $3
      ORDER BY k.tgl DESC, k.id DESC`,
    [s.tenant_id, from, to]
  );

  // Saldo kumulatif seluruh waktu, per metode.
  const saldoRows = await dbAll<any>(
    `SELECT metode,
            COALESCE(SUM(jumlah) FILTER (WHERE arah='masuk'),0)::bigint AS masuk,
            COALESCE(SUM(jumlah) FILTER (WHERE arah='keluar'),0)::bigint AS keluar
       FROM kas WHERE tenant_id = $1 GROUP BY metode`,
    [s.tenant_id]
  );
  let saldoTunai = 0, saldoTransfer = 0;
  for (const r of saldoRows) {
    const net = Number(r.masuk) - Number(r.keluar);
    if (r.metode === "transfer") saldoTransfer += net; else saldoTunai += net;
  }

  // Total dalam periode terpilih.
  const per = entries.reduce((a: any, e: any) => {
    if (e.arah === "masuk") a.masuk += Number(e.jumlah); else a.keluar += Number(e.jumlah);
    return a;
  }, { masuk: 0, keluar: 0 });

  const tutupHariIni = await dbOne<any>(`SELECT * FROM kas_tutup WHERE tenant_id=$1 AND tgl=$2`, [s.tenant_id, today]);

  return NextResponse.json({
    entries: entries.map((e) => ({ ...e, jumlah: Number(e.jumlah) })),
    saldo: { tunai: saldoTunai, transfer: saldoTransfer, total: saldoTunai + saldoTransfer },
    periode: { from, to, masuk: per.masuk, keluar: per.keluar, net: per.masuk - per.keluar },
    tutup_hari_ini: tutupHariIni ? { saldo_fisik: Number(tutupHariIni.saldo_fisik), selisih: Number(tutupHariIni.selisih) } : null,
    admin: s.access === "admin",
  });
}

// POST /api/kas — entri manual (operasional/modal/prive/lainnya).
export async function POST(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.access === "none") return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const b = await req.json().catch(() => ({}));

  const arah = b.arah === "masuk" ? "masuk" : b.arah === "keluar" ? "keluar" : null;
  if (!arah) return NextResponse.json({ error: "Arah wajib (masuk/keluar)" }, { status: 400 });
  const kategori = KATEGORI.includes(b.kategori) ? b.kategori : "lainnya";
  const metode = b.metode === "transfer" ? "transfer" : "tunai";
  const jumlah = Math.round(Number(b.jumlah || 0));
  if (jumlah <= 0) return NextResponse.json({ error: "Jumlah harus > 0" }, { status: 400 });
  const tgl = /^\d{4}-\d{2}-\d{2}$/.test(b.tgl) ? b.tgl : new Date().toISOString().slice(0, 10);

  await dbRun(
    `INSERT INTO kas (tenant_id, tgl, arah, kategori, metode, jumlah, keterangan, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [s.tenant_id, tgl, arah, kategori, metode, jumlah, String(b.keterangan || "").slice(0, 200) || null, s.user_id]
  );
  return NextResponse.json({ ok: true });
}

// DELETE /api/kas?id= — hapus entri MANUAL (admin; entri auto dari gadai/pembayaran tak bisa dihapus).
export async function DELETE(req: NextRequest) {
  const s = await currentSession();
  if (!s || s.access !== "admin") return NextResponse.json({ error: "Hanya admin" }, { status: 403 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  const row = await dbOne<any>(`SELECT ref_gadai_id, ref_pembayaran_id FROM kas WHERE id=$1 AND tenant_id=$2`, [id, s.tenant_id]);
  if (!row) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  if (row.ref_gadai_id || row.ref_pembayaran_id) {
    return NextResponse.json({ error: "Entri otomatis (dari transaksi) tidak bisa dihapus di sini" }, { status: 400 });
  }
  await dbRun(`DELETE FROM kas WHERE id=$1 AND tenant_id=$2`, [id, s.tenant_id]);
  return NextResponse.json({ ok: true });
}
