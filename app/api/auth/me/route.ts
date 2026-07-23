import { NextResponse } from "next/server";
import { currentSession, currentNasabah } from "@/lib/auth";

export async function GET() {
  const s = await currentSession();
  if (s) {
    return NextResponse.json({
      kind: "staff",
      user: { id: s.user_id, email: s.email, nama: s.nama, role: s.role },
      tenant: { id: s.tenant_id, nama_usaha: s.nama_usaha, slug: s.slug },
    });
  }
  const nb = await currentNasabah();
  if (nb) {
    return NextResponse.json({
      kind: "nasabah",
      nasabah: { id: nb.nasabah_id, nama: nb.nama, email: nb.email },
    });
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
