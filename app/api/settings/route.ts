import { NextRequest, NextResponse } from "next/server";
import { dbOne, dbRun } from "@/lib/db";
import { currentSession } from "@/lib/auth";

// GET /api/settings -> { settings } milik tenant.
export async function GET() {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const row = await dbOne<any>(`SELECT nama_usaha, settings FROM tenants WHERE id = $1`, [s.tenant_id]);
  return NextResponse.json({ nama_usaha: row?.nama_usaha || "", settings: row?.settings || {} });
}

// POST /api/settings -> merge setting (admin saja). Body: { harga_emas_per_gram }
export async function POST(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.role !== "admin") return NextResponse.json({ error: "Hanya admin yang boleh mengubah pengaturan" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  const numMin = (v: any, min = 0) => Math.max(min, Math.round(Number(v) || 0));

  if (b.harga_emas_per_gram !== undefined) patch.harga_emas_per_gram = numMin(b.harga_emas_per_gram);
  if (b.plafon_persen !== undefined) patch.plafon_persen = Math.min(100, Math.max(1, Math.round(Number(b.plafon_persen) || 90)));
  if (b.bunga_persen !== undefined) patch.bunga_persen = Math.max(0, Number(b.bunga_persen) || 0);
  if (b.periode_hari !== undefined) patch.periode_hari = numMin(b.periode_hari, 1);
  if (b.tempo_hari !== undefined) patch.tempo_hari = numMin(b.tempo_hari, 1);
  if (b.biaya_admin !== undefined) patch.biaya_admin = numMin(b.biaya_admin);
  if (b.biaya_admin_persen !== undefined) patch.biaya_admin_persen = Math.max(0, Number(b.biaya_admin_persen) || 0);
  if (b.denda_persen_per_hari !== undefined) patch.denda_persen_per_hari = Math.max(0, Number(b.denda_persen_per_hari) || 0);
  if (b.no_wa !== undefined) patch.no_wa = String(b.no_wa || "").replace(/[^\d+]/g, "").slice(0, 20);
  if (b.alamat_toko !== undefined) patch.alamat_toko = String(b.alamat_toko || "").slice(0, 200);
  if (Array.isArray(b.jenis_barang)) {
    const arr = Array.from(new Set(
      b.jenis_barang.map((x: any) => String(x || "").trim().toLowerCase()).filter(Boolean)
    )).slice(0, 20);
    if (arr.length) patch.jenis_barang = arr;
  }

  const nama = typeof b.nama_usaha === "string" ? b.nama_usaha.trim().slice(0, 100) : "";
  const hasPatch = Object.keys(patch).length > 0;
  if (!nama && !hasPatch) return NextResponse.json({ error: "Tidak ada yang diubah" }, { status: 400 });

  if (nama) await dbRun(`UPDATE tenants SET nama_usaha = $1, updated_at = now() WHERE id = $2`, [nama, s.tenant_id]);
  if (hasPatch) await dbRun(`UPDATE tenants SET settings = COALESCE(settings,'{}'::jsonb) || $1::jsonb, updated_at = now() WHERE id = $2`,
    [JSON.stringify(patch), s.tenant_id]);

  const row = await dbOne<any>(`SELECT nama_usaha, settings FROM tenants WHERE id = $1`, [s.tenant_id]);
  return NextResponse.json({ nama_usaha: row?.nama_usaha || "", settings: row?.settings || {} });
}
