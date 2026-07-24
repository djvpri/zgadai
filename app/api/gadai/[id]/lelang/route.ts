import { NextRequest, NextResponse } from "next/server";
import { dbOne, dbRun } from "@/lib/db";
import { currentSession } from "@/lib/auth";
import { hitungTebus } from "@/lib/gadai";

// POST /api/gadai/[id]/lelang { harga_lelang }
// Tandai gadai sebagai LELANG: catat harga jual + kewajiban (pokok+bunga+denda).
// Selisih (kelebihan dikembalikan / kekurangan) dihitung dari keduanya.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.role !== "admin") return NextResponse.json({ error: "Hanya admin/pemilik yang boleh melelang" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const harga = Math.max(0, Math.round(Number(b.harga_lelang || 0)));

  const g = await dbOne<any>(`SELECT * FROM gadai WHERE id = $1 AND tenant_id = $2`, [params.id, s.tenant_id]);
  if (!g) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  if (g.status !== "aktif") return NextResponse.json({ error: "Gadai sudah tidak aktif" }, { status: 400 });

  const setRow = await dbOne<any>(`SELECT settings FROM tenants WHERE id = $1`, [s.tenant_id]);
  const dendaPersen = Number(setRow?.settings?.denda_persen_per_hari || 0);

  const t = hitungTebus({
    tgl_gadai: g.tgl_gadai,
    tgl_jatuh_tempo: g.tgl_jatuh_tempo,
    periode_hari: g.periode_hari,
    bunga_persen: Number(g.bunga_persen),
    pokok_sisa: Number(g.pokok_sisa),
  }, dendaPersen);

  const kewajiban = t.total; // pokok_sisa + bunga + denda
  const today = new Date().toISOString().slice(0, 10);

  await dbRun(
    `UPDATE gadai SET status='lelang', harga_lelang=$1, nilai_kewajiban_lelang=$2, tgl_lelang=$3, updated_at=now()
     WHERE id=$4`,
    [harga, kewajiban, today, g.id]
  );

  return NextResponse.json({ ok: true, harga, kewajiban, selisih: harga - kewajiban });
}
