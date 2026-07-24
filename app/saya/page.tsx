"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah, tanggalID, selisihHari, statusJatuhTempo, STATUS_BADGE, waLink } from "@/lib/gadai";

const ZONE = process.env.NEXT_PUBLIC_ZONE_URL || "https://zone.zomet.my.id";

export default function SayaPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/saya")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = ZONE;
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="bg-navy-900 text-white sticky top-0 z-20" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold flex items-center gap-2"><i className="bi bi-safe2-fill text-gold-400" /> ZGadai</span>
          <button onClick={logout} className="text-navy-200 text-sm"><i className="bi bi-box-arrow-right me-1" />Keluar</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 pb-16">
        {loading ? (
          <div className="p-10 text-center text-slate-400">Memuat…</div>
        ) : (
          <>
            <div className="mb-5">
              <h1 className="text-xl font-bold text-navy-900">Halo, {data?.nasabah?.nama || "Nasabah"}</h1>
              <p className="text-sm text-slate-500">Berikut pinjaman gadai atas nama Anda.</p>
            </div>

            {(!data?.gadai || data.gadai.length === 0) ? (
              <div className="card p-8 text-center">
                <i className="bi bi-safe2 text-3xl text-slate-300" />
                <p className="font-semibold text-slate-600 mt-3">Belum ada data pinjaman</p>
                <p className="text-sm text-slate-400">Pastikan email ini yang didaftarkan oleh tempat gadai.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.gadai.map((g: any) => <GadaiCard key={g.id} g={g} nama={data?.nasabah?.nama || ""} />)}
              </div>
            )}

            <p className="text-center text-xs text-slate-400 mt-8">
              Layanan ekosistem <a href={ZONE} className="text-navy-600 font-semibold">Zomet</a>
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function GadaiCard({ g, nama }: { g: any; nama: string }) {
  const aktif = g.status === "aktif";
  const badge = aktif ? (STATUS_BADGE[statusJatuhTempo(g.tgl_jatuh_tempo)] || STATUS_BADGE.aktif) : STATUS_BADGE[g.status];
  const sisa = selisihHari(new Date(), g.tgl_jatuh_tempo);
  const pesanWa = `Halo ${g.usaha}, saya ${nama}. Ingin bertanya tentang gadai SBG ${g.no_sbg}` +
    (aktif && g.tebus ? ` (jatuh tempo ${tanggalID(g.tgl_jatuh_tempo)}, total tebus ${rupiah(g.tebus.total)}).` : ".");

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="font-bold text-navy-900 tnum">{g.no_sbg}</div>
          <div className="text-[11px] text-slate-500">{g.usaha}</div>
        </div>
        <span className={`badge ${badge?.cls}`}><i className={`bi ${badge?.icon}`} />{badge?.label}</span>
      </div>

      <div className="p-5">
        {aktif && g.tebus ? (
          <>
            <div className="text-center mb-4">
              <div className="text-xs text-slate-500">Total tebus hari ini</div>
              <div className="text-3xl font-black text-navy-900 tnum">{rupiah(g.tebus.total)}</div>
              <div className={`text-xs font-semibold mt-1 ${sisa < 0 ? "text-red-600" : sisa <= 7 ? "text-amber-600" : "text-emerald-600"}`}>
                {sisa < 0 ? `Telat ${Math.abs(sisa)} hari` : sisa === 0 ? "Jatuh tempo hari ini" : `${sisa} hari lagi`} · JT {tanggalID(g.tgl_jatuh_tempo)}
              </div>
            </div>
            <div className="bg-navy-50 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-sm mb-4">
              <div><div className="text-[11px] text-slate-500">Sisa Pokok</div><div className="font-semibold tnum">{rupiah(g.tebus.pokok)}</div></div>
              <div><div className="text-[11px] text-slate-500">Bunga</div><div className="font-semibold tnum">{rupiah(g.tebus.bunga)}</div></div>
              <div><div className="text-[11px] text-slate-500">Denda</div><div className="font-semibold tnum">{rupiah(g.tebus.denda)}</div></div>
            </div>
          </>
        ) : g.status === "lunas" ? (
          <div className="text-center text-emerald-700 text-sm mb-3"><i className="bi bi-bag-check me-1" />Sudah ditebus {tanggalID(g.tgl_lunas)}</div>
        ) : (
          <div className="text-center text-red-600 text-sm mb-3"><i className="bi bi-hammer me-1" />Barang telah dilelang {tanggalID(g.tgl_lelang)}</div>
        )}

        {/* Barang */}
        <div className="text-xs font-semibold text-slate-500 mb-1">Barang jaminan</div>
        <ul className="text-sm mb-3 space-y-2">
          {g.barang.map((b: any, i: number) => {
            const fotos: string[] = Array.isArray(b.foto_urls) && b.foto_urls.length ? b.foto_urls : (b.foto_url ? [b.foto_url] : []);
            return (
              <li key={i} className="border-b border-slate-50 pb-2">
                <div className="flex justify-between">
                  <span className="text-navy-800 capitalize">{b.nama} <span className="text-slate-400">· {b.jenis}{b.kadar ? ` ${b.kadar}` : ""}</span></span>
                  <span className="text-slate-500 tnum">{rupiah(b.taksiran)}</span>
                </div>
                {fotos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {fotos.map((f, fi) => <img key={fi} src={f} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-200" />)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Riwayat */}
        {g.pembayaran.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-navy-600 font-medium">Riwayat pembayaran ({g.pembayaran.length})</summary>
            <ul className="mt-2 space-y-1">
              {g.pembayaran.map((p: any, i: number) => (
                <li key={i} className="flex justify-between text-xs">
                  <span className="capitalize text-slate-600">{p.jenis} · {tanggalID(p.tgl)}</span>
                  <span className="tnum font-medium">{rupiah(p.total)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {g.wa && (
          <a href={waLink(g.wa, pesanWa)} target="_blank" rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
            <i className="bi bi-whatsapp" /> Hubungi Toko
          </a>
        )}
      </div>
    </div>
  );
}
