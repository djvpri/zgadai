"use client";
import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { rupiah } from "@/lib/gadai";

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function LaporanPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/laporan?from=${from}&to=${to}`).then((r) => r.json()).then(setD).finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Laporan</h1>
          <p className="text-slate-500 text-sm">Rekap kas, pendapatan & portofolio</p>
        </div>
        <div className="flex items-end gap-2">
          <div><label className="label">Dari</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label">Sampai</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </div>

      {loading || !d ? (
        <div className="card p-8 text-center text-slate-400 text-sm">Memuat…</div>
      ) : (
        <div className="space-y-5">
          {/* Kas & laba */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Kas Masuk" value={rupiah(d.kas.masuk)} icon="bi-arrow-down-circle" tone="text-emerald-600" />
            <Stat label="Kas Keluar (pencairan)" value={rupiah(d.kas.keluar)} icon="bi-arrow-up-circle" tone="text-red-600" />
            <Stat label="Kas Bersih" value={rupiah(d.kas.net)} icon="bi-cash-stack" tone={d.kas.net >= 0 ? "text-navy-800" : "text-red-600"} />
            <Stat label="Laba (bunga+denda+admin)" value={rupiah(d.pendapatan.laba)} icon="bi-graph-up-arrow" tone="text-gold-600" />
          </div>

          {/* Pendapatan rinci */}
          <section className="card p-5">
            <h2 className="font-bold text-navy-900 mb-3"><i className="bi bi-wallet2 me-2 text-navy-500" />Pendapatan</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Mini label="Bunga" value={rupiah(d.pendapatan.bunga)} />
              <Mini label="Denda" value={rupiah(d.pendapatan.denda)} />
              <Mini label="Biaya Admin" value={rupiah(d.pendapatan.admin)} />
            </div>
          </section>

          {/* Rekap transaksi */}
          <section className="card p-5">
            <h2 className="font-bold text-navy-900 mb-3"><i className="bi bi-list-check me-2 text-navy-500" />Rekap Transaksi</h2>
            <div className="divide-y divide-slate-100 text-sm">
              <RowLR k={`Gadai baru (${d.pencairan.jumlah})`} v={rupiah(d.pencairan.pokok)} sub="pokok dicairkan" />
              <RowLR k={`Tebus (${d.pembayaran.n_tebus})`} v={rupiah(d.pembayaran.total)} sub="total penerimaan pembayaran" />
              <RowLR k={`Perpanjang (${d.pembayaran.n_perpanjang})`} v="" />
              <RowLR k={`Cicil (${d.pembayaran.n_cicil})`} v={rupiah(d.pembayaran.pokok)} sub="pokok dari cicilan" />
              <RowLR k={`Lelang (${d.lelang.jumlah})`} v={rupiah(d.lelang.harga)} sub={`selisih ${rupiah(d.lelang.selisih)}`} />
            </div>
          </section>

          {/* Aging */}
          <section className="card p-5">
            <h2 className="font-bold text-navy-900 mb-1"><i className="bi bi-hourglass-split me-2 text-navy-500" />Umur Pinjaman Aktif</h2>
            <p className="text-[11px] text-slate-400 mb-3">Kondisi portofolio saat ini (uang beredar per status jatuh tempo).</p>
            <div className="grid grid-cols-3 gap-3">
              <Bucket label="Belum jatuh tempo" n={d.aging.belum.n} p={rupiah(d.aging.belum.pokok)} cls="text-emerald-600" />
              <Bucket label="≤ 7 hari" n={d.aging.dekat.n} p={rupiah(d.aging.dekat.pokok)} cls="text-amber-600" />
              <Bucket label="Lewat tempo" n={d.aging.lewat.n} p={rupiah(d.aging.lewat.pokok)} cls="text-red-600" />
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: string; tone: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <i className={`bi ${icon} ${tone}`} />
      </div>
      <div className={`text-lg md:text-xl font-bold mt-2 tnum ${tone}`}>{value}</div>
    </div>
  );
}
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-navy-50 rounded-xl p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-bold text-navy-900 tnum mt-0.5">{value}</div>
    </div>
  );
}
function RowLR({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-slate-700">{k}</span>
      <span className="text-right">
        {v && <span className="font-semibold text-navy-900 tnum">{v}</span>}
        {sub && <span className="block text-[11px] text-slate-400">{sub}</span>}
      </span>
    </div>
  );
}
function Bucket({ label, n, p, cls }: { label: string; n: number; p: string; cls: string }) {
  return (
    <div className="border border-slate-200 rounded-xl p-3 text-center">
      <div className={`text-2xl font-bold ${cls}`}>{n}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
      <div className="text-xs font-semibold text-navy-800 tnum mt-1">{p}</div>
    </div>
  );
}
