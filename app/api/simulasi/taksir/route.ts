import { NextRequest, NextResponse } from "next/server";
import { dbRun } from "@/lib/db";
import { taksirBarang } from "@/lib/taksir";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Batas percobaan foto per IP per hari (cegah abuse Gemini di endpoint publik).
const LIMIT_PER_HARI = 15;

// POST /api/simulasi/taksir — PUBLIK (tanpa login), rate-limited per IP.
export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || req.headers.get("x-real-ip") || "unknown";

  const row = await dbRun<{ jumlah: number }>(
    `INSERT INTO ratelimit (ip, hari, jumlah) VALUES ($1, current_date, 1)
     ON CONFLICT (ip, hari) DO UPDATE SET jumlah = ratelimit.jumlah + 1
     RETURNING jumlah`,
    [ip]
  );
  if ((row?.jumlah ?? 0) > LIMIT_PER_HARI) {
    return NextResponse.json(
      { error: "Batas percobaan foto hari ini tercapai. Coba lagi besok atau hubungi toko." },
      { status: 429 }
    );
  }

  const b = await req.json().catch(() => ({}));
  const res = await taksirBarang(b.images ?? b.image, b.mimeType);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res.data);
}
