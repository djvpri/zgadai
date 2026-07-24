"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { rupiah } from "@/lib/gadai";

export default function InvestorPage() {
  const router = useRouter();
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/investor").then(async (r) => {
      if (r.status === 403) { router.replace("/dashboard"); return; }
      setD(await r.json());
    }).finally(() => setLoading(false));
  }, [router]);

  const isAdmin = d?.role === "admin";

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-navy-900 mb-1">{isAdmin ? "Investor & Bagi Hasil" : "Return Saya"}</h1>
      <p className="text-slate-500 text-sm mb-5">Bagi hasil dihitung dari total laba usaha (bunga + denda + biaya admin).</p>

      {loading ? (
        <div className="card p-8 text-center text-slate-400 text-sm">Memuat…</div>
      ) : (
        <div className="space-y-5">
          {/* Ringkasan usaha */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="card p-4"><div className="text-xs font-semibold text-slate-500">Laba Usaha (kumulatif)</div><div className="text-xl font-bold text-gold-600 tnum mt-2">{rupiah(d?.laba || 0)}</div></div>
            <div className="card p-4"><div className="text-xs font-semibold text-slate-500">Uang Beredar</div><div className="text-xl font-bold text-navy-800 tnum mt-2">{rupiah(d?.uang_beredar || 0)}</div></div>
            {isAdmin && <div className="card p-4"><div className="text-xs font-semibold text-slate-500">Total Modal Investor</div><div className="text-xl font-bold text-navy-800 tnum mt-2">{rupiah(d?.total_modal || 0)}</div></div>}
          </div>

          {/* Daftar investor / return sendiri */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 font-bold text-navy-900">
              <i className="bi bi-people me-2 text-navy-500" />{isAdmin ? "Bagi Hasil per Investor" : "Bagi Hasil Anda"}
            </div>
            {(!d?.investors || d.investors.length === 0) ? (
              <div className="p-8 text-center text-slate-400 text-sm">Belum ada data investor.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.investors.map((i: any) => (
                  <li key={i.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-navy-900 truncate">{i.nama}</div>
                      <div className="text-xs text-slate-500 tnum">Modal {rupiah(i.modal)} · bagi hasil {i.bagi_hasil_persen}%</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-emerald-700 tnum">{rupiah(i.ret)}</div>
                      <div className="text-[11px] text-slate-400">estimasi return</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-[11px] text-slate-400">Estimasi return = bagi hasil % × laba kumulatif. Angka final & jadwal pembagian diatur pemilik.</p>
        </div>
      )}
    </AppShell>
  );
}
