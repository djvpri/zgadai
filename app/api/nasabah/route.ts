import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbOne } from "@/lib/db";
import { currentSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.role === "investor") return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();

  const rows = await dbAll(
    `SELECT n.*,
       (SELECT COUNT(*)::int FROM gadai g WHERE g.nasabah_id = n.id AND g.status = 'aktif') AS gadai_aktif
     FROM nasabah n
     WHERE n.tenant_id = $1
       AND ($2 = '' OR lower(n.nama) LIKE '%'||$2||'%' OR n.no_hp LIKE '%'||$2||'%' OR n.no_ktp LIKE '%'||$2||'%')
     ORDER BY n.created_at DESC
     LIMIT 200`,
    [s.tenant_id, q]
  );
  return NextResponse.json({ nasabah: rows });
}

export async function POST(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (s.role === "investor") return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const nama = String(b.nama || "").trim();
  if (!nama) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });

  // Batasi ukuran foto (data URL) agar payload wajar (~200KB).
  const foto = typeof b.foto === "string" && b.foto.startsWith("data:image/") && b.foto.length < 200_000
    ? b.foto : null;

  const email = b.email ? String(b.email).trim().toLowerCase() : null;
  const row = await dbOne(
    `INSERT INTO nasabah (tenant_id, nama, no_ktp, no_hp, alamat, catatan, foto, email)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [s.tenant_id, nama, b.no_ktp || null, b.no_hp || null, b.alamat || null, b.catatan || null, foto, email]
  );
  return NextResponse.json({ nasabah: row });
}
