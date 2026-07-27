"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { rupiah } from "@/lib/gadai";
import { cetakLabaRugi } from "@/lib/cetak";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const labelBulan = (b: string) => { const [y, m] = b.split("-"); return `${BULAN[Number(m) - 1]} ${y}`; };
const thisMonth = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; };

export default function LabaRugiPage() {
  const router = useRouter();
  const [bulan, setBulan] = useState(thisMonth());
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/laba-rugi?bulan=${bulan}`).then(async (r) => {
      if (r.status === 403) { router.replace("/dashboard"); return; }
      setD(await r.json());
    }).finally(() => setLoading(false));
  }, [bulan, router]);
  useEffect(() => { load(); }, [load]);

  const P = d?.pendapatan, B = d?.beban;
  const rugi = d && d.laba_bersih < 0;

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold text-navy-900">Laba Rugi</h1>
        {d && <button className="btn-ghost text-sm" onClick={() => cetakLabaRugi(d, labelBulan(bulan), d.usaha || "ZGadai")}><i className="bi bi-printer" /> Cetak</button>}
      </div>
      <p className="text-slate-500 text-sm mb-4">Ringkasan pendapatan & beban per bulan (basis realisasi kas).</p>

      <div className="mb-4 max-w-[220px]">
        <label className="label">Bulan</label>
        <input type="month" className="input" value={bulan} onChange={(e) => setBulan(e.target.value)} />
      </div>

      {loading || !d ? (
        <div className="card p-8 text-center text-slate-400 text-sm">Memuat…</div>
      ) : (
        <div className="card p-5 max-w-lg">
          <div className="text-center mb-4">
            <div className="text-xs text-slate-500">Laba Bersih · {labelBulan(bulan)}</div>
            <div className={`text-3xl font-black tnum ${rugi ? "text-red-600" : "text-emerald-700"}`}>{rupiah(d.laba_bersih)}</div>
            {rugi && <div className="text-xs text-red-500 font-semibold">Rugi</div>}
          </div>

          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100 pb-1 mb-1">Pendapatan</h2>
          <Line k="Bunga (sewa modal)" v={P.bunga} />
          <Line k="Denda keterlambatan" v={P.denda} />
          <Line k="Biaya administrasi" v={P.admin} />
          <Line k="Laba lelang" v={P.lelang_untung} />
          <Sub k="Total Pendapatan" v={d.total_pendapatan} tone="text-emerald-700" />

          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100 pb-1 mb-1 mt-4">Beban</h2>
          <Line k="Beban operasional" v={B.operasional} />
          <Line k="Fee mitra" v={B.fee_mitra} />
          <Line k="Rugi lelang" v={B.lelang_rugi} />
          <Sub k="Total Beban" v={d.total_beban} tone="text-red-600" />

          <div className="flex justify-between items-center border-t-2 border-navy-900 mt-4 pt-3">
            <span className="font-bold text-navy-900">LABA BERSIH</span>
            <span className={`font-black tnum text-lg ${rugi ? "text-red-600" : "text-emerald-700"}`}>{rupiah(d.laba_bersih)}</span>
          </div>

          <p className="text-[11px] text-slate-400 mt-4">
            Basis realisasi kas: bunga/denda dihitung dari pembayaran bulan ini; biaya admin dari gadai yang dibuat bulan ini.
            Bagi hasil investor & pengambilan modal (prive) <b>tidak</b> dihitung sebagai beban.
          </p>
        </div>
      )}
    </AppShell>
  );
}

function Line({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between py-1 text-sm pl-3">
      <span className="text-slate-600">{k}</span>
      <span className="tnum text-navy-800">{rupiah(v)}</span>
    </div>
  );
}
function Sub({ k, v, tone }: { k: string; v: number; tone: string }) {
  return (
    <div className="flex justify-between py-1.5 border-t border-slate-200 mt-1 font-bold text-sm">
      <span className="text-navy-900">{k}</span>
      <span className={`tnum ${tone}`}>{rupiah(v)}</span>
    </div>
  );
}
