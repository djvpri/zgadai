import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbOne, dbRun } from "@/lib/db";
import { currentSession } from "@/lib/auth";
import { hitungTebus } from "@/lib/gadai";
import { logAktivitas } from "@/lib/log";

// GET /api/jatuh-tempo — semua gadai AKTIF + total tebus hari ini, untuk pusat jatuh tempo.
export async function GET() {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.access === "none") return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const setRow = await dbOne<any>(`SELECT settings FROM tenants WHERE id = $1`, [s.tenant_id]);
  const dendaPersen = Number(setRow?.settings?.denda_persen_per_hari || 0);

  const rows = await dbAll<any>(
    `SELECT g.id, g.no_sbg, g.tgl_gadai, g.tgl_jatuh_tempo, g.periode_hari, g.bunga_persen, g.pokok_sisa,
            g.terakhir_diingatkan, n.nama AS nasabah_nama, n.no_hp AS nasabah_hp
       FROM gadai g JOIN nasabah n ON n.id = g.nasabah_id
      WHERE g.tenant_id = $1 AND g.status = 'aktif'
      ORDER BY g.tgl_jatuh_tempo ASC`,
    [s.tenant_id]
  );

  const list = rows.map((g) => {
    const t = hitungTebus({
      tgl_gadai: g.tgl_gadai, tgl_jatuh_tempo: g.tgl_jatuh_tempo,
      periode_hari: g.periode_hari, bunga_persen: Number(g.bunga_persen), pokok_sisa: Number(g.pokok_sisa),
    }, dendaPersen);
    return {
      id: g.id, no_sbg: g.no_sbg, tgl_jatuh_tempo: g.tgl_jatuh_tempo,
      nasabah_nama: g.nasabah_nama, nasabah_hp: g.nasabah_hp,
      pokok_sisa: Number(g.pokok_sisa), total_tebus: t.total, denda: t.denda,
      terakhir_diingatkan: g.terakhir_diingatkan,
    };
  });

  return NextResponse.json({
    list,
    usaha: s.nama_usaha,
    no_wa: setRow?.settings?.no_wa || "",
  });
}

// POST /api/jatuh-tempo — tandai sudah diingatkan. Body: { id }
export async function POST(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.access === "none") return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const id = Number(b.id);
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const g = await dbOne<any>(
    `SELECT g.no_sbg FROM gadai g WHERE g.id = $1 AND g.tenant_id = $2 AND g.status = 'aktif'`,
    [id, s.tenant_id]
  );
  if (!g) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  await dbRun(`UPDATE gadai SET terakhir_diingatkan = now() WHERE id = $1`, [id]);
  await logAktivitas(s, "gadai.ingatkan", `Ingatkan jatuh tempo ${g.no_sbg}`, "gadai", id);
  return NextResponse.json({ ok: true });
}
