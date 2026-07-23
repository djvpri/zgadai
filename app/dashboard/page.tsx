"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { rupiah, tanggalID } from "@/lib/gadai";

interface Stat {
  uang_beredar: number; gadai_aktif: number; jt_dekat: number;
  lewat_tempo: number; bunga_bulan: number; nasabah: number;
}
interface JT {
  id: number; no_sbg: string; tgl_jatuh_tempo: string; pokok_sisa: number;
  nasabah_nama: string; sisa_hari: number;
}

export default function DashboardPage() {
  const [stat, setStat] = useState<Stat | null>(null);
  const [jt, setJt] = useState<JT[]>([]);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then((d) => {
      if (d.stat) { setStat(d.stat); setJt(d.jatuhTempo || []); }
    });
  }, []);

  const cards = [
    { label: "Uang Beredar", value: rupiah(stat?.uang_beredar ?? 0), icon: "bi-cash-stack", tone: "text-navy-800", sub: "Total pokok pinjaman aktif" },
    { label: "Gadai Aktif", value: String(stat?.gadai_aktif ?? 0), icon: "bi-safe2", tone: "text-navy-800", sub: "SBG berjalan" },
    { label: "Jatuh Tempo ≤7 Hari", value: String(stat?.jt_dekat ?? 0), icon: "bi-clock-history", tone: "text-amber-600", sub: "Perlu diingatkan" },
    { label: "Lewat Tempo", value: String(stat?.lewat_tempo ?? 0), icon: "bi-exclamation-triangle", tone: "text-red-600", sub: "Kandidat lelang" },
    { label: "Bunga Bulan Ini", value: rupiah(stat?.bunga_bulan ?? 0), icon: "bi-graph-up-arrow", tone: "text-emerald-600", sub: "Pendapatan sewa modal" },
    { label: "Total Nasabah", value: String(stat?.nasabah ?? 0), icon: "bi-people", tone: "text-navy-800", sub: "Terdaftar" },
  ];

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Dashboard</h1>
          <p className="text-slate-500 text-sm">Ringkasan usaha gadai kamu</p>
        </div>
        <Link href="/gadai/baru" className="btn-gold"><i className="bi bi-plus-lg" /> Gadai Baru</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">{c.label}</span>
              <i className={`bi ${c.icon} ${c.tone}`} />
            </div>
            <div className={`text-xl md:text-2xl font-bold mt-2 tnum ${c.tone}`}>{c.value}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-navy-900"><i className="bi bi-clock-history text-amber-500 me-2" />Jatuh Tempo Terdekat</h2>
          <Link href="/transaksi" className="text-sm text-navy-600 hover:underline">Semua transaksi</Link>
        </div>
        {jt.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Belum ada gadai aktif.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {jt.map((g) => {
              const late = g.sisa_hari < 0;
              const soon = g.sisa_hari >= 0 && g.sisa_hari <= 7;
              return (
                <li key={g.id}>
                  <Link href={`/transaksi/${g.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-navy-900 truncate">{g.nasabah_nama}</div>
                      <div className="text-xs text-slate-500 tnum">{g.no_sbg} · {rupiah(g.pokok_sisa)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500 tnum">{tanggalID(g.tgl_jatuh_tempo)}</div>
                      <span className={`text-[11px] font-semibold ${late ? "text-red-600" : soon ? "text-amber-600" : "text-emerald-600"}`}>
                        {late ? `Telat ${Math.abs(g.sisa_hari)} hr` : g.sisa_hari === 0 ? "Hari ini" : `${g.sisa_hari} hari lagi`}
                      </span>
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
