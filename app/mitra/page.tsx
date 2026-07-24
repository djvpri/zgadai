"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { rupiah, tanggalID } from "@/lib/gadai";

export default function MitraPage() {
  const router = useRouter();
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/mitra").then(async (r) => {
      if (r.status === 403) { router.replace("/dashboard"); return; }
      setD(await r.json());
    }).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  async function tandaiLunas(mitraId: number) {
    if (!confirm("Tandai semua fee mitra ini sebagai LUNAS?")) return;
    await fetch("/api/mitra", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mitra_id: mitraId }),
    });
    load();
  }

  const isAdmin = d?.role === "admin";

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-navy-900 mb-1">{isAdmin ? "Fee Mitra" : "Fee Saya"}</h1>
      <p className="text-slate-500 text-sm mb-5">{isAdmin ? "Komisi mitra dari bunga transaksi yang mereka bawa." : "Komisi Anda dari bunga transaksi yang Anda proses."}</p>

      {loading ? (
        <div className="card p-8 text-center text-slate-400 text-sm">Memuat…</div>
      ) : (
        <div className="space-y-5">
          {/* Ringkasan per mitra */}
          <div className="grid sm:grid-cols-2 gap-4">
            {(d?.summary || []).map((m: any) => (
              <div key={m.mitra_id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-navy-900">{m.mitra_nama}</div>
                  {Number(m.belum) > 0 && isAdmin && (
                    <button onClick={() => tandaiLunas(m.mitra_id)} className="text-xs font-semibold text-emerald-600 hover:underline">Tandai Lunas</button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div><div className="text-lg font-bold text-navy-900 tnum">{rupiah(m.total)}</div><div className="text-[11px] text-slate-500">Total fee</div></div>
                  <div><div className="text-lg font-bold text-amber-600 tnum">{rupiah(m.belum)}</div><div className="text-[11px] text-slate-500">Belum dibayar</div></div>
                  <div><div className="text-lg font-bold text-slate-700">{m.jumlah}</div><div className="text-[11px] text-slate-500">Transaksi</div></div>
                </div>
              </div>
            ))}
            {(d?.summary || []).length === 0 && (
              <div className="card p-8 text-center text-slate-400 text-sm sm:col-span-2">Belum ada fee tercatat.</div>
            )}
          </div>

          {/* Rincian */}
          {(d?.entries || []).length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 font-bold text-navy-900"><i className="bi bi-receipt me-2 text-navy-500" />Rincian Fee</div>
              <ul className="divide-y divide-slate-100">
                {d.entries.map((e: any) => (
                  <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-navy-900 tnum">{e.no_sbg} <span className="font-normal text-slate-500">· {e.nasabah || "—"}</span></div>
                      <div className="text-xs text-slate-500 tnum">{tanggalID(e.tgl)}{isAdmin ? ` · ${e.mitra_nama}` : ""} · bunga {rupiah(e.bunga_dibayar)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-navy-900 tnum">{rupiah(e.fee)}</div>
                      <span className={`text-[11px] font-semibold ${e.paid ? "text-emerald-600" : "text-amber-600"}`}>{e.paid ? "Lunas" : "Belum"}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
