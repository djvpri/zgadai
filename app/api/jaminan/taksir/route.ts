import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = "gemini-2.5-flash";

// POST /api/jaminan/taksir { image, mimeType }
// -> { jenis, nama, deskripsi, berat_gram, kadar, taksiran, catatan }
// Identifikasi & taksiran AWAL dari foto barang jaminan (bersifat bantuan, WAJIB
// diverifikasi petugas — emas tetap harus ditimbang & diuji kadar).
export async function POST(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "GEMINI_API_KEY belum diset" }, { status: 500 });

  const b = await req.json().catch(() => ({}));
  // Terima banyak gambar (images[]) atau satu (image). Maks 4, buang prefix data URL.
  const raw: string[] = Array.isArray(b.images) ? b.images : (b.image ? [b.image] : []);
  const images = raw
    .map((s) => String(s || "").replace(/^data:image\/[^;]+;base64,/, ""))
    .filter(Boolean)
    .slice(0, 4);
  const mimeType = String(b.mimeType || "image/jpeg");
  if (images.length === 0) return NextResponse.json({ error: "Gambar barang wajib" }, { status: 400 });
  const totalLen = images.reduce((n, s) => n + s.length, 0);
  if (totalLen > 12 * 1024 * 1024) return NextResponse.json({ error: "Gambar terlalu besar" }, { status: 413 });

  const prompt = `Kamu penaksir barang gadai (pegadaian) berpengalaman di Indonesia.
Dari FOTO barang jaminan ini, identifikasi barang lalu beri TAKSIRAN nilai gadai yang KONSERVATIF
(perkiraan nilai jual cepat / harga bekas, dalam Rupiah).

Kembalikan HANYA JSON valid (tanpa markdown):
{"jenis":"emas|elektronik|kendaraan|lainnya","nama":"","deskripsi":"","berat_gram":null,"kadar":"","taksiran":0,"catatan":""}

Aturan:
- "jenis": pilih salah satu dari emas, elektronik, kendaraan, lainnya.
- "nama": nama singkat barang (mis. "Kalung Emas", "HP Samsung A14", "Motor Honda Beat").
- "berat_gram": HANYA untuk emas — perkiraan visual kasar (angka) atau null. Berat asli WAJIB ditimbang.
- "kadar": untuk emas mis "22K"/"24K" jika terlihat, selain itu "".
- "taksiran": angka Rupiah, konservatif. Jika tak yakin, beri estimasi rendah yang aman.
- "catatan": peringatan singkat untuk petugas (mis. "Perlu timbang & uji kadar", "Cek kelengkapan/keaslian").
- Jika barang tak dikenali, jenis="lainnya" dan taksiran kecil/0 dengan catatan.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: prompt },
          ...images.map((data) => ({ inline_data: { mime_type: mimeType, data } })),
        ] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingBudget: 0 }, // matikan "thinking" agar output tidak terpotong
        },
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("[taksir] gemini error", resp.status, t.slice(0, 300));
      return NextResponse.json({ error: "Gagal menaksir (AI)" }, { status: 502 });
    }
    const data = await resp.json();
    const cand = data?.candidates?.[0];
    const text: string = (cand?.content?.parts || []).map((p: any) => p?.text || "").join("").trim();
    if (!text) {
      console.error("[taksir] empty text", cand?.finishReason, JSON.stringify(data?.promptFeedback || {}));
      return NextResponse.json({ error: "AI tidak mengembalikan data (coba foto lebih jelas)" }, { status: 502 });
    }
    const match = text.match(/\{[\s\S]*\}/);
    const p = JSON.parse(match ? match[0] : text);

    const JENIS = ["emas", "elektronik", "kendaraan", "lainnya"];
    const jenis = JENIS.includes(String(p.jenis)) ? String(p.jenis) : "lainnya";
    return NextResponse.json({
      jenis,
      nama: String(p.nama || "").trim(),
      deskripsi: String(p.deskripsi || "").trim(),
      berat_gram: p.berat_gram != null && !isNaN(Number(p.berat_gram)) ? Number(p.berat_gram) : null,
      kadar: String(p.kadar || "").trim(),
      taksiran: Math.max(0, Math.round(Number(p.taksiran || 0))),
      catatan: String(p.catatan || "").trim(),
    });
  } catch (e: any) {
    console.error("[taksir]", e?.message);
    return NextResponse.json({ error: "Gagal memproses gambar" }, { status: 500 });
  }
}
