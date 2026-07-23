import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteSession } from "@/lib/auth";

export async function POST() {
  const sid = cookies().get("session_id")?.value;
  if (sid) await deleteSession(sid);
  const res = NextResponse.json({ success: true });
  res.cookies.set("session_id", "", { path: "/", maxAge: 0 });
  return res;
}
