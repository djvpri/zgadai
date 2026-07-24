"use client";
import { useEffect, useState } from "react";
import { rupiah, plafon, tanggalID, waLink } from "@/lib/gadai";
import { compressImage } from "@/lib/img";

const ZONE = process.env.NEXT_PUBLIC_ZONE_URL || "https://zone.zomet.my.id";

export default function SimulasiPublik() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [taksiran, setTaksiran] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiNote, setAiNote] = useState("");

  async function fotoTaksir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setAiNote("");
    try {
      const dataUrl = await compressImage(file, 640, 0.8);
      const r = await fetch("/api/simulasi/taksir", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [dataUrl], mimeType: "image/jpeg" }),
      });
      const d = await r.json();
      if (!r.ok) { setAiNote(d.error || "Gagal menaksir"); return; }
      if (d.taksiran) setTaksiran(String(d.taksiran));
      setAiNote(`${d.nama || "Barang"}${d.catatan ? " — " + d.catatan : ""}`);
    } catch {
      setAiNote("Gagal memproses gambar");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    fetch("/api/simulasi").then((r) => (r.ok ? r.json() : Promise.reject())).then(setD).catch(() => setD(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-dvh grid place-items-center">
      <div className="w-8 h-8 border-2 border-navy-200 border-t-navy-700 rounded-full animate-spin" />
    </div>
  );
  if (!d?.sim) return (
    <div className="min-h-dvh grid place-items-center text-center px-6 text-slate-500">
      Layanan simulasi belum tersedia.
    </div>
  );

  const sim = d.sim;
  const promo = d.promoAktif;
  const bungaEfektif = promo ? +(sim.bunga_persen * (1 - promo.diskon / 100)).toFixed(3) : sim.bunga_persen;

  const t = Number(taksiran || 0);
  const pinjaman = plafon(t, sim.plafon_persen);
  const admin = sim.biaya_admin + Math.round((pinjaman * sim.biaya_admin_persen) / 100);
  const diterima = Math.max(0, pinjaman - admin);
  const rows = [1, 2, 3, 4].map((n) => {
    const bunga = Math.round(pinjaman * (bungaEfektif / 100) * n);
    return { hari: n * sim.periode_hari, bunga, total: pinjaman + bunga };
  });

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="bg-navy-900 text-white">
        <div className="max-w-lg mx-auto px-4 py-4 text-center">
          <div className="font-bold text-xl flex items-center justify-center gap-2"><i className="bi bi-safe2-fill text-gold-400" /> {d.usaha || "ZGadai"}</div>
          <div className="text-navy-200 text-xs mt-0.5">Simulasi Gadai{d.alamat ? ` · ${d.alamat}` : ""}</div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 pb-16">
        {promo && (
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-center px-3 py-2.5">
            <div className="font-bold"><i className="bi bi-megaphone-fill me-1" />Sedang ada promo: {promo.nama}!</div>
            <div className="text-xs text-emerald-600">Bunga spesial {bungaEfektif}%/periode (normal {sim.bunga_persen}%){promo.sampai ? ` — s/d ${tanggalID(promo.sampai)}` : ""}. Gadai sekarang, lebih hemat! 🎉</div>
          </div>
        )}

        <div className="card p-5">
          <h1 className="font-bold text-navy-900 text-lg mb-1">Hitung Estimasi Pinjaman</h1>
          <p className="text-sm text-slate-500 mb-4">Masukkan perkiraan nilai barang yang ingin digadaikan.</p>

          <label className="text-xs font-semibold text-slate-500">Perkiraan nilai barang (taksiran)</label>
          <div className="flex gap-2 mt-1">
            <input className="input tnum flex-1" inputMode="numeric" placeholder="mis. 2000000"
              value={taksiran} onChange={(e) => setTaksiran(e.target.value.replace(/\D/g, ""))} autoFocus />
            <label className="btn-ghost cursor-pointer text-xs px-3 whitespace-nowrap">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={fotoTaksir} disabled={busy} />
              {busy
                ? <span className="w-4 h-4 border-2 border-navy-300 border-t-navy-700 rounded-full animate-spin inline-block align-middle" />
                : <><i className="bi bi-camera" /> Foto</>}
            </label>
          </div>
          <p className="text-[11px] text-slate-400 mt-1"><i className="bi bi-stars text-gold-500 me-1" />Foto barang → AI perkirakan jenis & nilainya otomatis.</p>
          {aiNote && <p className="text-[11px] text-emerald-600 mt-1"><i className="bi bi-robot me-1" />{aiNote}</p>}

          {t > 0 && (
            <>
              <div className="bg-navy-50 rounded-xl p-3 mt-4 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Uang pinjaman ({sim.plafon_persen}%)</span><span className="font-medium tnum">{rupiah(pinjaman)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Biaya admin</span><span className="font-medium tnum">{rupiah(admin)}</span></div>
                <div className="flex justify-between border-t border-navy-200 pt-1.5 mt-1"><span className="font-semibold text-navy-900">Diterima</span><span className="font-bold text-emerald-700 tnum">{rupiah(diterima)}</span></div>
              </div>

              <div className="text-xs font-semibold text-slate-500 mt-4 mb-1">Perkiraan tebus (pinjaman + bunga){promo ? " · harga promo" : ""}</div>
              <table className="w-full text-sm">
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="py-1.5 text-slate-600">{r.hari} hari</td>
                      <td className="py-1.5 text-right text-slate-400 tnum">+{rupiah(r.bunga)}</td>
                      <td className="py-1.5 text-right font-semibold text-navy-900 tnum">{rupiah(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-slate-400 mt-2">Estimasi: plafon {sim.plafon_persen}% taksiran, bunga {bungaEfektif}%/{sim.periode_hari} hari{promo ? " (promo)" : ""}. Nilai final ditentukan penaksir & dapat berbeda.</p>
            </>
          )}
        </div>

        {/* CTA */}
        <div className="mt-4 space-y-2">
          {d.wa && (
            <a href={waLink(d.wa, `Halo ${d.usaha}, saya mau tanya soal gadai${t > 0 ? ` (perkiraan barang ${rupiah(t)})` : ""}.`)}
              target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
              <i className="bi bi-whatsapp" /> Tanya / Ajukan via WhatsApp
            </a>
          )}
          <a href={ZONE} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white border border-slate-200 text-navy-700 text-sm font-semibold">
            <i className="bi bi-box-arrow-in-right" /> Sudah nasabah? Cek pinjaman via Z One
          </a>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">Layanan ekosistem Zomet</p>
      </main>
    </div>
  );
}
