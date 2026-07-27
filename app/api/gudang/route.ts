import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbRun, dbOne } from "@/lib/db";
import { currentSession } from "@/lib/auth";
import { logAktivitas } from "@/lib/log";

// GET /api/gudang?q= — daftar barang yang fisiknya HARUS ada (disimpan) + yang dilaporkan hilang.
export async function GET(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.access === "none") return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();

  const rows = await dbAll<any>(
    `SELECT b.id, b.nama, b.jenis, b.kadar, b.taksiran, b.lokasi, b.status_fisik,
            b.foto_url, b.foto_urls, b.terakhir_opname,
            g.id AS gadai_id, g.no_sbg, g.tgl_jatuh_tempo, g.status AS gadai_status,
            n.nama AS nasabah_nama
       FROM barang b
       JOIN gadai g ON g.id = b.gadai_id
       JOIN nasabah n ON n.id = g.nasabah_id
      WHERE g.tenant_id = $1
        AND b.status_fisik IN ('disimpan','hilang')
        AND ($2 = '' OR lower(b.nama) LIKE '%'||$2||'%' OR lower(g.no_sbg) LIKE '%'||$2||'%'
             OR lower(n.nama) LIKE '%'||$2||'%' OR lower(coalesce(b.lokasi,'')) LIKE '%'||$2||'%')
      ORDER BY b.lokasi NULLS FIRST, g.no_sbg`,
    [s.tenant_id, q]
  );

  const barang = rows.map((r) => ({
    id: r.id, nama: r.nama, jenis: r.jenis, kadar: r.kadar, taksiran: Number(r.taksiran || 0),
    lokasi: r.lokasi || "", status_fisik: r.status_fisik,
    foto: (Array.isArray(r.foto_urls) && r.foto_urls[0]) || r.foto_url || null,
    terakhir_opname: r.terakhir_opname,
    gadai_id: r.gadai_id, no_sbg: r.no_sbg, tgl_jatuh_tempo: r.tgl_jatuh_tempo, gadai_status: r.gadai_status,
    nasabah_nama: r.nasabah_nama,
  }));

  return NextResponse.json({ barang });
}

// PATCH /api/gudang — aksi manajemen barang (operasional).
// Body: { action:'lokasi', ids:number[], lokasi } | { action:'opname'|'hilang'|'ketemu', id }
export async function PATCH(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.access === "none") return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "");
  const scope = `gadai_id IN (SELECT id FROM gadai WHERE tenant_id = $2)`;

  if (action === "lokasi") {
    const ids = (Array.isArray(b.ids) ? b.ids : []).map((x: any) => Number(x)).filter(Boolean);
    if (!ids.length) return NextResponse.json({ error: "Pilih barang dulu" }, { status: 400 });
    const lokasi = String(b.lokasi || "").trim() || null;
    await dbRun(`UPDATE barang SET lokasi=$1 WHERE id = ANY($3::bigint[]) AND ${scope}`, [lokasi, s.tenant_id, ids]);
    await logAktivitas(s, "barang.lokasi", `Set lokasi ${ids.length} barang → ${lokasi || "(kosong)"}`, "barang");
    return NextResponse.json({ ok: true });
  }

  const id = Number(b.id);
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  if (action === "opname") {
    await dbRun(`UPDATE barang SET terakhir_opname=now() WHERE id=$1 AND ${scope}`, [id, s.tenant_id]);
    return NextResponse.json({ ok: true });
  }
  if (action === "hilang") {
    const bd = await dbOne<any>(`SELECT nama FROM barang WHERE id=$1 AND ${scope}`, [id, s.tenant_id]);
    await dbRun(`UPDATE barang SET status_fisik='hilang' WHERE id=$1 AND ${scope}`, [id, s.tenant_id]);
    await logAktivitas(s, "barang.hilang", `Lapor HILANG: ${bd?.nama || "barang #" + id}`, "barang", id);
    return NextResponse.json({ ok: true });
  }
  if (action === "ketemu") {
    const bd = await dbOne<any>(`SELECT nama FROM barang WHERE id=$1 AND ${scope}`, [id, s.tenant_id]);
    await dbRun(`UPDATE barang SET status_fisik='disimpan', terakhir_opname=now() WHERE id=$1 AND ${scope}`, [id, s.tenant_id]);
    await logAktivitas(s, "barang.ketemu", `Barang ketemu kembali: ${bd?.nama || "barang #" + id}`, "barang", id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 });
}
