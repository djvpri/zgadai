import { NextRequest, NextResponse } from "next/server";
import { currentSession, currentNasabah } from "@/lib/auth";
import { taksirBarang } from "@/lib/taksir";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/jaminan/taksir { images[] | image, mimeType } -> hasil taksir AI.
// Boleh staf ATAU nasabah (untuk simulasi di portal /saya).
export async function POST(req: NextRequest) {
  const actor = (await currentSession()) || (await currentNasabah());
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const res = await taksirBarang(b.images ?? b.image, b.mimeType);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res.data);
}
