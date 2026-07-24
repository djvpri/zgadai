// lib/taksir.ts — logika identifikasi & taksir barang via Gemini (server-only).
// Dipakai endpoint staf/nasabah (/api/jaminan/taksir) & publik (/api/simulasi/taksir).

const MODEL = "gemini-2.5-flash";

export interface TaksirHasil {
  jenis: string; nama: string; deskripsi: string;
  berat_gram: number | null; kadar: string; taksiran: number; catatan: string;
}
export type TaksirResult =
  | { ok: true; data: TaksirHasil }
  | { ok: false; status: number; error: string };

export async function taksirBarang(rawImages: any, mimeTypeIn?: string): Promise<TaksirResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, status: 500, error: "GEMINI_API_KEY belum diset" };

  const arr: string[] = Array.isArray(rawImages) ? rawImages : (rawImages ? [rawImages] : []);
  const images = arr
    .map((s) => String(s || "").replace(/^data:image\/[^;]+;base64,/, ""))
    .filter(Boolean)
    .slice(0, 4);
  const mimeType = String(mimeTypeIn || "image/jpeg");
  if (images.length === 0) return { ok: false, status: 400, error: "Gambar barang wajib" };
  const totalLen = images.reduce((n, s) => n + s.length, 0);
  if (totalLen > 12 * 1024 * 1024) return { ok: false, status: 413, error: "Gambar terlalu besar" };

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
- "catatan": peringatan singkat (mis. "Perlu timbang & uji kadar", "Cek kelengkapan/keaslian").
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
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    if (!resp.ok) {
      console.error("[taksir] gemini error", resp.status, (await resp.text()).slice(0, 300));
      return { ok: false, status: 502, error: "Gagal menaksir (AI)" };
    }
    const data = await resp.json();
    const cand = data?.candidates?.[0];
    const text: string = (cand?.content?.parts || []).map((p: any) => p?.text || "").join("").trim();
    if (!text) return { ok: false, status: 502, error: "AI tidak mengembalikan data (coba foto lebih jelas)" };

    const m = text.match(/\{[\s\S]*\}/);
    const p = JSON.parse(m ? m[0] : text);
    const JENIS = ["emas", "elektronik", "kendaraan", "lainnya"];
    return {
      ok: true,
      data: {
        jenis: JENIS.includes(String(p.jenis)) ? String(p.jenis) : "lainnya",
        nama: String(p.nama || "").trim(),
        deskripsi: String(p.deskripsi || "").trim(),
        berat_gram: p.berat_gram != null && !isNaN(Number(p.berat_gram)) ? Number(p.berat_gram) : null,
        kadar: String(p.kadar || "").trim(),
        taksiran: Math.max(0, Math.round(Number(p.taksiran || 0))),
        catatan: String(p.catatan || "").trim(),
      },
    };
  } catch (e: any) {
    console.error("[taksir]", e?.message);
    return { ok: false, status: 500, error: "Gagal memproses gambar" };
  }
}
