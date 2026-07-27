"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { rupiah, tanggalID, selisihHari, waLink } from "@/lib/gadai";

const diingatkanHariIni = (t: any) => !!t && new Date(t).toDateString() === new Date().toDateString();

type Bucket = "semua" | "lewat" | "hari_ini" | "dekat";

export default function JatuhTempoPage() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Bucket>("semua");
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    fetch("/api/jatuh-tempo").then((r) => r.json()).then(setD).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function ingatkan(id: number) {
    await fetch("/api/jatuh-tempo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  const list: any[] = (d?.list || []).map((g: any) => ({ ...g, sisa: selisihHari(new Date(), g.tgl_jatuh_tempo) }));
  const bucketOf = (g: any): Bucket => (g.sisa < 0 ? "lewat" : g.sisa === 0 ? "hari_ini" : g.sisa <= 7 ? "dekat" : "semua");
  const cnt = {
    lewat: list.filter((g) => g.sisa < 0).length,
    hari_ini: list.filter((g) => g.sisa === 0).length,
    dekat: list.filter((g) => g.sisa > 0 && g.sisa <= 7).length,
    total: list.length,
  };

  const qq = q.trim().toLowerCase();
  const shown = list.filter((g) => {
    if (tab === "lewat" && g.sisa >= 0) return false;
    if (tab === "hari_ini" && g.sisa !== 0) return false;
    if (tab === "dekat" && !(g.sisa > 0 && g.sisa <= 7)) return false;
    if (qq && !(`${g.no_sbg} ${g.nasabah_nama}`.toLowerCase().includes(qq))) return false;
    return true;
  });

  function pesan(g: any) {
    return `Halo ${g.nasabah_nama}, pengingat gadai SBG ${g.no_sbg} jatuh tempo ${tanggalID(g.tgl_jatuh_tempo)}. ` +
      `Total tebus saat ini ${rupiah(g.total_tebus)}. Mohon segera ditebus atau diperpanjang. Terima kasih.` +
      (d?.usaha ? ` — ${d.usaha}` : "");
  }

  const tabs: { k: Bucket; label: string; n?: number }[] = [
    { k: "semua", label: "Semua", n: cnt.total },
    { k: "lewat", label: "Lewat tempo", n: cnt.lewat },
    { k: "hari_ini", label: "Hari ini", n: cnt.hari_ini },
    { k: "dekat", label: "≤7 hari", n: cnt.dekat },
  ];

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-navy-900 mb-1">Pusat Jatuh Tempo</h1>
      <p className="text-slate-500 text-sm mb-4">Pantau & ingatkan nasabah yang mendekati / lewat jatuh tempo.</p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className={`card p-3 text-center ${cnt.lewat ? "ring-1 ring-red-300" : ""}`}><div className={`text-xl font-bold ${cnt.lewat ? "text-red-600" : "text-slate-400"}`}>{cnt.lewat}</div><div className="text-[11px] text-slate-500">Lewat tempo</div></div>
        <div className="card p-3 text-center"><div className={`text-xl font-bold ${cnt.hari_ini ? "text-amber-600" : "text-slate-400"}`}>{cnt.hari_ini}</div><div className="text-[11px] text-slate-500">Jatuh tempo hari ini</div></div>
        <div className="card p-3 text-center"><div className="text-xl font-bold text-navy-900">{cnt.dekat}</div><div className="text-[11px] text-slate-500">≤7 hari lagi</div></div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === t.k ? "bg-navy-800 text-white" : "bg-white border border-slate-200 text-navy-700"}`}>
            {t.label}{typeof t.n === "number" ? ` (${t.n})` : ""}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <i className="bi bi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pl-10" placeholder="Cari SBG / nasabah…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-400 text-sm">Memuat…</div>
      ) : shown.length === 0 ? (
        <div className="card p-8 text-center text-slate-400 text-sm">Tidak ada gadai pada kategori ini. 🎉</div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {shown.map((g) => {
            const late = g.sisa < 0;
            const soon = g.sisa >= 0 && g.sisa <= 7;
            const sudah = diingatkanHariIni(g.terakhir_diingatkan);
            return (
              <div key={g.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <Link href={`/transaksi/${g.id}`} className="font-semibold text-navy-900 hover:underline tnum">{g.no_sbg}</Link>
                  <span className="text-slate-500"> · {g.nasabah_nama}</span>
                  <div className="text-xs text-slate-500 tnum">
                    JT {tanggalID(g.tgl_jatuh_tempo)} · tebus {rupiah(g.total_tebus)}{g.denda > 0 ? ` (+denda ${rupiah(g.denda)})` : ""}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className={`text-[11px] font-semibold ${late ? "text-red-600" : soon ? "text-amber-600" : "text-emerald-600"}`}>
                      {late ? `Telat ${Math.abs(g.sisa)} hari` : g.sisa === 0 ? "Jatuh tempo hari ini" : `${g.sisa} hari lagi`}
                    </span>
                    {sudah && <span className="text-[11px] text-slate-400"><i className="bi bi-check2-all text-emerald-500" /> sudah diingatkan</span>}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  {g.nasabah_hp ? (
                    <a href={waLink(g.nasabah_hp, pesan(g))} target="_blank" rel="noopener noreferrer" onClick={() => ingatkan(g.id)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 border border-emerald-200 rounded-lg px-2.5 py-1.5 hover:bg-emerald-50">
                      <i className="bi bi-whatsapp" /> Ingatkan
                    </a>
                  ) : (
                    <button onClick={() => ingatkan(g.id)} className="text-xs font-semibold text-navy-600 border border-slate-200 rounded-lg px-2.5 py-1.5">Tandai diingatkan</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
