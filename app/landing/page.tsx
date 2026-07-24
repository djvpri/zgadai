"use client";
import { useEffect, useState } from "react";
import { tanggalID, waLink } from "@/lib/gadai";
import { cetakBrosur } from "@/lib/cetak";

const ZONE = process.env.NEXT_PUBLIC_ZONE_URL || "https://zone.zomet.my.id";

const BENEFITS = [
  { icon: "bi-lightning-charge-fill", title: "Proses Cepat", desc: "Pengajuan simpel, dana cair hari itu juga." },
  { icon: "bi-cash-coin", title: "Bunga Ringan", desc: "Sewa modal terjangkau, transparan tanpa biaya tersembunyi." },
  { icon: "bi-shield-lock-fill", title: "Barang Aman", desc: "Disimpan rapi & terjaga sampai Anda tebus kembali." },
  { icon: "bi-robot", title: "Taksir Instan (AI)", desc: "Foto barang, langsung tahu perkiraan nilainya." },
  { icon: "bi-arrow-repeat", title: "Fleksibel", desc: "Bisa tebus, perpanjang, atau cicil kapan saja." },
  { icon: "bi-phone", title: "Cek Online", desc: "Pantau pinjaman & jatuh tempo lewat Z One." },
];

export default function LandingPage() {
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    fetch("/api/simulasi").then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => setD(null));
  }, []);

  const usaha = d?.usaha || "ZGadai";
  const sim = d?.sim;
  const promo = d?.promoAktif;
  const bunga = sim ? (promo ? +(sim.bunga_persen * (1 - promo.diskon / 100)).toFixed(3) : sim.bunga_persen) : null;

  function brosur() {
    if (!sim) return;
    cetakBrosur({
      usaha, alamat: d?.alamat, wa: d?.wa, sim, promo,
      simulasiUrl: `${location.origin}/simulasi`,
    });
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Hero */}
      <header className="bg-navy-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="font-bold text-lg flex items-center gap-2"><i className="bi bi-safe2-fill text-gold-400" /> {usaha}</span>
          <a href={ZONE} className="text-xs text-navy-200 hover:text-white">Masuk</a>
        </div>
        <div className="max-w-4xl mx-auto px-4 pt-8 pb-14 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3 py-1 text-xs text-gold-200 mb-5">
            <i className="bi bi-shield-check" /> Layanan Gadai Terpercaya
          </div>
          <h1 className="text-3xl md:text-5xl font-black leading-tight">Butuh Dana Cepat?<br /><span className="text-gold-400">Gadai Aman & Bunga Ringan.</span></h1>
          <p className="text-navy-200 mt-4 max-w-xl mx-auto">Cairkan pinjaman dari barang berharga Anda — emas, elektronik, kendaraan, dan lainnya. Cepat, transparan, aman.</p>
          <div className="flex flex-wrap gap-3 justify-center mt-7">
            <a href="/simulasi" className="btn-gold px-6 py-3"><i className="bi bi-calculator" /> Hitung Simulasi</a>
            {d?.wa && (
              <a href={waLink(d.wa, `Halo ${usaha}, saya mau tanya soal gadai.`)} target="_blank" rel="noopener noreferrer"
                className="btn px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white"><i className="bi bi-whatsapp" /> Chat WhatsApp</a>
            )}
          </div>
          <button onClick={brosur} disabled={!sim} className="mt-4 text-xs text-navy-200 hover:text-white underline underline-offset-2">
            <i className="bi bi-printer me-1" />Cetak Brosur (A5)
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 -mt-8 pb-16">
        {/* Promo */}
        {promo && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-center px-4 py-3 shadow-card mb-6">
            <div className="font-bold"><i className="bi bi-megaphone-fill me-1" />PROMO {promo.nama} — Diskon Bunga {promo.diskon}%!</div>
            <div className="text-xs text-emerald-600">Bunga spesial {bunga}%/{sim.periode_hari} hari{promo.sampai ? ` · s/d ${tanggalID(promo.sampai)}` : ""}. Gadai sekarang, lebih hemat! 🎉</div>
          </div>
        )}

        {/* Benefits */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BENEFITS.map((b) => (
            <div key={b.title} className="card p-5">
              <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-700 grid place-items-center text-xl mb-3"><i className={`bi ${b.icon}`} /></div>
              <div className="font-bold text-navy-900">{b.title}</div>
              <div className="text-sm text-slate-500 mt-1">
                {b.title === "Bunga Ringan" && bunga != null ? `Mulai ${bunga}% per ${sim.periode_hari} hari — ${b.desc}` : b.desc}
              </div>
            </div>
          ))}
        </div>

        {/* Cara kerja */}
        <section className="card p-6 mt-6">
          <h2 className="font-bold text-navy-900 text-lg text-center mb-5">Cara Gadai — 3 Langkah Mudah</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { n: 1, t: "Bawa / Foto Barang", d: "Emas, HP, laptop, kendaraan (BPKB), dan lainnya." },
              { n: 2, t: "Ditaksir & Cair", d: "Barang dinilai, dana langsung diterima." },
              { n: 3, t: "Tebus / Perpanjang", d: "Ambil barang kapan saja sebelum jatuh tempo." },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <div className="w-10 h-10 rounded-full bg-navy-800 text-white grid place-items-center font-bold mx-auto mb-2">{s.n}</div>
                <div className="font-semibold text-navy-900">{s.t}</div>
                <div className="text-sm text-slate-500 mt-0.5">{s.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-6 rounded-2xl bg-navy-900 text-white p-6 text-center">
          <h2 className="text-xl font-bold">Hitung Estimasi Pinjaman Anda</h2>
          <p className="text-navy-200 text-sm mt-1">Foto barang → tahu perkiraan nilai & tebusnya. Gratis, tanpa daftar.</p>
          <a href="/simulasi" className="btn-gold px-6 py-3 mt-4 inline-flex"><i className="bi bi-calculator" /> Buka Simulasi</a>
        </section>

        {/* Kontak */}
        <footer className="text-center text-sm text-slate-500 mt-8">
          {d?.wa && <div className="font-semibold text-navy-800"><i className="bi bi-whatsapp text-emerald-600" /> {d.wa}</div>}
          {d?.alamat && <div className="text-xs mt-0.5"><i className="bi bi-geo-alt" /> {d.alamat}</div>}
          <div className="text-xs text-slate-400 mt-4">
            Sudah jadi nasabah? <a href={ZONE} className="text-navy-600 font-semibold">Cek pinjaman via Z One</a>
          </div>
          <div className="text-[11px] text-slate-400 mt-3">{usaha} · Layanan ekosistem Zomet</div>
        </footer>
      </main>
    </div>
  );
}
