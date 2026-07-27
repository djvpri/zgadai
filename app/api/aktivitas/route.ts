import { NextRequest, NextResponse } from "next/server";
import { dbAll } from "@/lib/db";
import { currentSession } from "@/lib/auth";

// GET /api/aktivitas?from&to&q — riwayat aktivitas (admin).
export async function GET(req: NextRequest) {
  const s = await currentSession();
  if (!s || s.access !== "admin") return NextResponse.json({ error: "Hanya admin" }, { status: 403 });

  const to = req.nextUrl.searchParams.get("to") || new Date().toISOString().slice(0, 10);
  const from = req.nextUrl.searchParams.get("from") || (to.slice(0, 8) + "01");
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();

  const rows = await dbAll<any>(
    `SELECT id, user_nama, aksi, entitas, ref_id, ringkasan, created_at
       FROM aktivitas
      WHERE tenant_id = $1 AND created_at::date BETWEEN $2 AND $3
        AND ($4 = '' OR lower(ringkasan) LIKE '%'||$4||'%' OR lower(coalesce(user_nama,'')) LIKE '%'||$4||'%' OR lower(aksi) LIKE '%'||$4||'%')
      ORDER BY created_at DESC LIMIT 500`,
    [s.tenant_id, from, to, q]
  );
  return NextResponse.json({ aktivitas: rows, from, to });
}
