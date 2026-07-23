"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { rupiah, tanggalID, statusJatuhTempo, STATUS_BADGE } from "@/lib/gadai";

interface Row {
  id: number; no_sbg: string; tgl_gadai: string; tgl_jatuh_tempo: string;
  taksiran: number; pokok: number; pokok_sisa: number; status: string;
  nasabah_nama: string; no_hp: string | null;
}

const TABS = [
  { key: "aktif", label: "Aktif" },
  { key: "", label: "Semua" },
  { key: "lunas", label: "Ditebus" },
  { key: "lelang", label: "Lelang" },
];

export default function TransaksiPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState("aktif");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/gadai?status=${tab}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => setRows(d.gadai || []))
      .finally(() => setLoading(false));
  }, [tab, q]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-navy-900">Transaksi Gadai</h1>
        <Link href="/gadai/baru" className="btn-gold"><i className="bi bi-plus-lg" /> Gadai Baru</Link>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
              tab === t.key ? "bg-navy-800 text-white" : "bg-white border border-slate-200 text-navy-700 hover:border-slate-400"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <i className="bi bi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pl-10" placeholder="Cari nama nasabah atau no. SBG…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Memuat…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Tidak ada data.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((g) => {
              const badge = g.status === "aktif"
                ? STATUS_BADGE[statusJatuhTempo(g.tgl_jatuh_tempo)] || STATUS_BADGE.aktif
                : STATUS_BADGE[g.status];
              return (
                <li key={g.id}>
                  <Link href={`/transaksi/${g.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-navy-900 truncate">{g.nasabah_nama}</div>
                      <div className="text-xs text-slate-500 tnum">{g.no_sbg} · JT {tanggalID(g.tgl_jatuh_tempo)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-navy-900 tnum">{rupiah(g.pokok_sisa)}</div>
                      <span className={`badge ${badge?.cls} mt-0.5`}><i className={`bi ${badge?.icon}`} />{badge?.label}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
