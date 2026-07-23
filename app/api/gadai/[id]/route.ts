import { NextRequest, NextResponse } from "next/server";
import { dbOne, dbAll } from "@/lib/db";
import { currentSession } from "@/lib/auth";
import { hitungTebus } from "@/lib/gadai";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gadai = await dbOne<any>(
    `SELECT g.*, n.nama AS nasabah_nama, n.no_hp AS nasabah_hp, n.no_ktp AS nasabah_ktp, n.alamat AS nasabah_alamat
       FROM gadai g JOIN nasabah n ON n.id = g.nasabah_id
      WHERE g.id = $1 AND g.tenant_id = $2`,
    [params.id, s.tenant_id]
  );
  if (!gadai) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const barang = await dbAll(`SELECT * FROM barang WHERE gadai_id = $1 ORDER BY id`, [gadai.id]);
  const pembayaran = await dbAll(
    `SELECT * FROM pembayaran WHERE gadai_id = $1 ORDER BY created_at DESC`, [gadai.id]);

  const tebus = gadai.status === "aktif"
    ? hitungTebus({
        tgl_gadai: gadai.tgl_gadai,
        periode_hari: gadai.periode_hari,
        bunga_persen: Number(gadai.bunga_persen),
        pokok_sisa: Number(gadai.pokok_sisa),
      })
    : null;

  return NextResponse.json({ gadai, barang, pembayaran, tebus, usaha: s.nama_usaha });
}
