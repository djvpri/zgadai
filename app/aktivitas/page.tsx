"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { tanggalID } from "@/lib/gadai";

const today = () => new Date().toISOString().slice(0, 10);

// Ikon + warna per jenis aksi.
function meta(aksi: string): { icon: string; cls: string } {
  const m: Record<string, { icon: string; cls: string }> = {
    "gadai.buat": { icon: "bi-plus-square", cls: "bg-navy-50 text-navy-600" },
    "gadai.tebus": { icon: "bi-bag-check", cls: "bg-emerald-50 text-emerald-600" },
    "gadai.perpanjang": { icon: "bi-arrow-repeat", cls: "bg-sky-50 text-sky-600" },
    "gadai.cicil": { icon: "bi-coin", cls: "bg-amber-50 text-amber-600" },
    "gadai.lelang": { icon: "bi-hammer", cls: "bg-red-50 text-red-600" },
    "nasabah.buat": { icon: "bi-person-plus", cls: "bg-navy-50 text-navy-600" },
    "nasabah.ubah": { icon: "bi-person-gear", cls: "bg-slate-100 text-slate-600" },
    "kapabilitas.set": { icon: "bi-person-badge", cls: "bg-violet-50 text-violet-600" },
    "staf.ubah": { icon: "bi-people", cls: "bg-violet-50 text-violet-600" },
    "kas.entri": { icon: "bi-wallet2", cls: "bg-emerald-50 text-emerald-600" },
    "kas.hapus": { icon: "bi-trash3", cls: "bg-red-50 text-red-600" },
    "kas.tutup": { icon: "bi-safe2", cls: "bg-navy-50 text-navy-600" },
    "barang.lokasi": { icon: "bi-geo-alt", cls: "bg-navy-50 text-navy-600" },
    "barang.hilang": { icon: "bi-exclamation-triangle", cls: "bg-red-50 text-red-600" },
    "barang.ketemu": { icon: "bi-check-circle", cls: "bg-emerald-50 text-emerald-600" },
    "promo.buat": { icon: "bi-tags", cls: "bg-gold-100 text-gold-700" },
    "promo.hapus": { icon: "bi-tags", cls: "bg-red-50 text-red-600" },
    "promo.toggle": { icon: "bi-toggle-on", cls: "bg-gold-100 text-gold-700" },
    "settings.ubah": { icon: "bi-gear", cls: "bg-slate-100 text-slate-600" },
  };
  return m[aksi] || { icon: "bi-dot", cls: "bg-slate-100 text-slate-500" };
}

function hrefOf(e: any): string | null {
  if (!e.ref_id) return e.entitas === "kas" ? "/kas" : null;
  if (e.entitas === "gadai") return `/transaksi/${e.ref_id}`;
  if (e.entitas === "nasabah") return `/nasabah/${e.ref_id}`;
  if (e.entitas === "kas") return "/kas";
  return null;
}

export default function AktivitasPage() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(today().slice(0, 8) + "01");
  const [to, setTo] = useState(today());
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/aktivitas?from=${from}&to=${to}&q=${encodeURIComponent(q)}`).then(async (r) => {
      if (r.status === 403) { router.replace("/dashboard"); return; }
      const d = await r.json();
      setRows(d.aktivitas || []);
    }).finally(() => setLoading(false));
  }, [from, to, q, router]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  // Kelompokkan per tanggal.
  const groups = new Map<string, any[]>();
  for (const e of rows) {
    const k = String(e.created_at).slice(0, 10);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  }
  const jam = (t: string) => new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-navy-900 mb-1">Riwayat Aktivitas</h1>
      <p className="text-slate-500 text-sm mb-4">Jejak siapa melakukan apa — transaksi, kas, nasabah, gudang, pengaturan.</p>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div><label className="label">Dari</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label">Sampai</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="relative flex-1 min-w-[180px]">
          <i className="bi bi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Cari aktivitas / pelaku…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-400 text-sm">Memuat…</div>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center text-slate-400 text-sm">Belum ada aktivitas pada periode ini.</div>
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([tgl, items]) => (
            <div key={tgl}>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{tanggalID(tgl)}</div>
              <div className="card divide-y divide-slate-100">
                {items.map((e) => {
                  const mt = meta(e.aksi);
                  const href = hrefOf(e);
                  const inner = (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${mt.cls}`}><i className={`bi ${mt.icon}`} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-navy-900 truncate">{e.ringkasan}</div>
                        <div className="text-[11px] text-slate-500">{jam(e.created_at)}{e.user_nama ? ` · ${e.user_nama}` : ""}</div>
                      </div>
                      {href && <i className="bi bi-chevron-right text-slate-300 shrink-0" />}
                    </div>
                  );
                  return href
                    ? <Link key={e.id} href={href} className="block hover:bg-slate-50">{inner}</Link>
                    : <div key={e.id}>{inner}</div>;
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
