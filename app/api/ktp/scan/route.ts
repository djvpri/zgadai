import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = "gemini-2.5-flash";

// POST /api/ktp/scan  { image: base64(tanpa prefix), mimeType }
// -> { nama, nik, alamat, ttl, jenis_kelamin } hasil OCR Gemini.
export async function POST(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "GEMINI_API_KEY belum diset" }, { status: 500 });

  const b = await req.json().catch(() => ({}));
  const image = String(b.image || "");
  const mimeType = String(b.mimeType || "image/jpeg");
  if (!image) return NextResponse.json({ error: "Gambar KTP wajib" }, { status: 400 });
  if (!mimeType.startsWith("image/")) return NextResponse.json({ error: "File harus gambar" }, { status: 400 });
  // ~8MB base64
  if (image.length > 8 * 1024 * 1024) return NextResponse.json({ error: "Gambar terlalu besar (maks ~6MB)" }, { status: 413 });

  const prompt = `Kamu membaca foto KTP (Kartu Tanda Penduduk) Indonesia.
Ekstrak data dan kembalikan HANYA JSON valid (tanpa markdown) dengan format:
{"nama":"","nik":"","alamat":"","ttl":"","jenis_kelamin":""}
Aturan:
- "nik" = 16 digit angka NIK, tanpa spasi.
- "alamat" = gabungan Alamat + RT/RW + Kel/Desa + Kecamatan (pisahkan dengan koma), huruf kapital seperti di KTP.
- "ttl" = "Tempat, dd-mm-yyyy".
- Jika sebuah field tidak terbaca, isi string kosong "".`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: image } }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingBudget: 0 }, // matikan "thinking" agar output tidak terpotong
        },
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("[ktp scan] gemini error", resp.status, t.slice(0, 300));
      return NextResponse.json({ error: "Gagal membaca KTP (AI)" }, { status: 502 });
    }
    const data = await resp.json();
    const cand = data?.candidates?.[0];
    const text: string = (cand?.content?.parts || []).map((p: any) => p?.text || "").join("").trim();
    if (!text) {
      console.error("[ktp scan] empty text", cand?.finishReason, JSON.stringify(data?.promptFeedback || {}));
      return NextResponse.json({ error: "AI tidak mengembalikan data (coba foto lebih jelas)" }, { status: 502 });
    }
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);

    return NextResponse.json({
      nama: String(parsed.nama || "").trim(),
      nik: String(parsed.nik || "").replace(/\D/g, ""),
      alamat: String(parsed.alamat || "").trim(),
      ttl: String(parsed.ttl || "").trim(),
      jenis_kelamin: String(parsed.jenis_kelamin || "").trim(),
    });
  } catch (e: any) {
    console.error("[ktp scan]", e?.message);
    return NextResponse.json({ error: "Gagal memproses gambar" }, { status: 500 });
  }
}
