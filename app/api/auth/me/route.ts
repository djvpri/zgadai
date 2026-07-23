import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";

export async function GET() {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    user: { id: s.user_id, email: s.email, nama: s.nama, role: s.role },
    tenant: { id: s.tenant_id, nama_usaha: s.nama_usaha, slug: s.slug },
  });
}
