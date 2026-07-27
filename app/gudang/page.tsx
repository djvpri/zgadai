"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { rupiah, tanggalID } from "@/lib/gadai";
import { cetakLabel } from "@/lib/cetak";

const kodeOf = (b: any) => `${b.no_sbg}-${b.id}`;
const dicekHariIni = (b: any) => !!b.terakhir_opname && new Date(b.terakhir_opname).toDateString() === new Date().toDateString();

export default function GudangPage() {
  const [barang, setBarang] = useState<any[]>([]);
  const [usaha, setUsaha] = useState("");
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [opname, setOpname] = useState(false);
  const [sembunyiDicek, setSembunyiDicek] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [lokModal, setLokModal] = useState<{ ids: number[]; val: string } | null>(null);

  const load = useCallback((query = q) => {
    fetch(`/api/gudang?q=${encodeURIComponent(query)}`).then((r) => r.json()).then((d) => {
      setBarang(d.barang || []);
    }).finally(() => setLoading(false));
  }, [q]);
  useEffect(() => { const t = setTimeout(() => load(q), 200); return () => clearTimeout(t); }, [q, load]);
  useEffect(() => { fetch("/api/dashboard").then((r) => r.json()).then((d) => setUsaha(d.usaha || "")).catch(() => {}); }, []);

  const total = barang.length;
  const hilang = barang.filter((b) => b.status_fisik === "hilang").length;
  const disimpan = barang.filter((b) => b.status_fisik === "disimpan");
  const dicek = disimpan.filter(dicekHariIni).length;

  const shown = barang.filter((b) => !(opname && sembunyiDicek && dicekHariIni(b) && b.status_fisik === "disimpan"));
  const groups = new Map<string, any[]>();
  for (const b of shown) { const k = b.lokasi || "Belum ditandai"; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(b); }

  function toggleSel(id: number) {
    setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function aksi(body: any) {
    await fetch("/api/gudang", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    load();
  }
  async function simpanLokasi() {
    if (!lokModal) return;
    await aksi({ action: "lokasi", ids: lokModal.ids, lokasi: lokModal.val });
    setLokModal(null); setSel(new Set());
  }
  function cetak(items: any[]) {
    if (!items.length) return;
    cetakLabel(items.map((b) => ({
      kode: kodeOf(b), no_sbg: b.no_sbg, nasabah: b.nasabah_nama, nama: b.nama,
      lokasi: b.lokasi, tgl_jatuh_tempo: b.tgl_jatuh_tempo,
    })), { nama: usaha || "ZGadai" });
  }

  const selItems = barang.filter((b) => sel.has(b.id));

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold text-navy-900">Gudang Jaminan</h1>
        <button onClick={() => { setOpname((v) => !v); setSel(new Set()); }}
          className={`text-sm font-semibold px-3 py-2 rounded-xl border transition-colors ${opname ? "bg-navy-800 text-white border-navy-800" : "bg-white text-navy-700 border-slate-200"}`}>
          <i className="bi bi-clipboard-check me-1" />{opname ? "Selesai Opname" : "Stok Opname"}
        </button>
      </div>
      <p className="text-slate-500 text-sm mb-4">Lokasi fisik & pengecekan barang jaminan yang sedang disimpan.</p>

      {/* Statistik */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card p-3 text-center"><div className="text-xl font-bold text-navy-900">{disimpan.length}</div><div className="text-[11px] text-slate-500">Barang disimpan</div></div>
        <div className="card p-3 text-center"><div className="text-xl font-bold text-emerald-600">{dicek}</div><div className="text-[11px] text-slate-500">Dicek hari ini</div></div>
        <div className={`card p-3 text-center ${hilang ? "ring-1 ring-red-300" : ""}`}><div className={`text-xl font-bold ${hilang ? "text-red-600" : "text-slate-400"}`}>{hilang}</div><div className="text-[11px] text-slate-500">Dilaporkan hilang</div></div>
      </div>

      {opname && disimpan.length > 0 && (
        <div className="card p-3 mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-navy-800">Progres opname hari ini</span>
            <span className="text-slate-500">{dicek}/{disimpan.length}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${disimpan.length ? (dicek / disimpan.length) * 100 : 0}%` }} />
          </div>
          <label className="flex items-center gap-2 mt-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" className="accent-navy-700" checked={sembunyiDicek} onChange={(e) => setSembunyiDicek(e.target.checked)} />
            Sembunyikan yang sudah dicek
          </label>
        </div>
      )}

      {/* Cari + aksi */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <i className="bi bi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Cari barang / SBG / nasabah / lokasi…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn-ghost whitespace-nowrap" onClick={() => cetak(disimpan)} disabled={!disimpan.length}>
          <i className="bi bi-printer" /> Label
        </button>
      </div>

      {/* Toolbar seleksi (mode normal) */}
      {!opname && sel.size > 0 && (
        <div className="card p-3 mb-4 flex items-center justify-between gap-2 sticky top-2 z-10">
          <span className="text-sm font-semibold text-navy-800">{sel.size} dipilih</span>
          <div className="flex gap-2">
            <button className="btn-ghost text-sm py-1.5" onClick={() => setLokModal({ ids: [...sel], val: "" })}><i className="bi bi-geo-alt" /> Set Lokasi</button>
            <button className="btn-ghost text-sm py-1.5" onClick={() => cetak(selItems)}><i className="bi bi-printer" /> Cetak Label</button>
            <button className="btn-ghost text-sm py-1.5" onClick={() => setSel(new Set())}>Batal</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-slate-400 text-sm">Memuat…</div>
      ) : shown.length === 0 ? (
        <div className="card p-8 text-center text-slate-400 text-sm">
          {q ? "Tidak ada barang cocok." : opname && sembunyiDicek ? "Semua barang sudah dicek. 🎉" : "Belum ada barang tersimpan."}
        </div>
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([lok, items]) => (
            <div key={lok}>
              <div className="flex items-center gap-2 mb-2">
                <i className={`bi ${lok === "Belum ditandai" ? "bi-question-circle text-amber-500" : "bi-geo-alt-fill text-navy-500"}`} />
                <h2 className="font-bold text-navy-900">{lok}</h2>
                <span className="text-xs text-slate-400">({items.length})</span>
              </div>
              <div className="space-y-2">
                {items.map((b) => {
                  const checked = dicekHariIni(b);
                  const isHilang = b.status_fisik === "hilang";
                  return (
                    <div key={b.id} className={`card p-3 flex items-center gap-3 ${isHilang ? "ring-1 ring-red-300 bg-red-50/40" : ""}`}>
                      {!opname && (
                        <input type="checkbox" className="accent-navy-700 shrink-0" checked={sel.has(b.id)} onChange={() => toggleSel(b.id)} />
                      )}
                      <div className="w-12 h-12 rounded-lg bg-navy-50 border border-slate-200 overflow-hidden grid place-items-center shrink-0">
                        {b.foto ? <img src={b.foto} alt="" className="w-full h-full object-cover" /> : <i className="bi bi-box text-xl text-slate-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-navy-900 capitalize truncate">{b.nama} <span className="font-normal text-slate-400 text-xs">· {b.jenis}{b.kadar ? ` ${b.kadar}` : ""}</span></div>
                        <div className="text-xs text-slate-500 tnum truncate">
                          <Link href={`/transaksi/${b.gadai_id}`} className="text-navy-600 hover:underline">{b.no_sbg}</Link> · {b.nasabah_nama}
                          {b.tgl_jatuh_tempo ? ` · JT ${tanggalID(b.tgl_jatuh_tempo)}` : ""}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {isHilang && <span className="text-red-600 font-semibold">⚠ HILANG · </span>}
                          <span className="tnum">{rupiah(b.taksiran)}</span>
                        </div>
                      </div>

                      {opname ? (
                        isHilang ? (
                          <button className="shrink-0 text-xs font-semibold text-emerald-700 border border-emerald-200 rounded-lg px-2.5 py-2" onClick={() => aksi({ action: "ketemu", id: b.id })}>
                            <i className="bi bi-check2" /> Ketemu
                          </button>
                        ) : (
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <button onClick={() => aksi({ action: "opname", id: b.id })}
                              className={`text-xs font-semibold rounded-lg px-3 py-2 border ${checked ? "bg-emerald-600 text-white border-emerald-600" : "text-emerald-700 border-emerald-300"}`}>
                              <i className={`bi ${checked ? "bi-check-circle-fill" : "bi-circle"} me-1`} />{checked ? "Ada ✓" : "Tandai Ada"}
                            </button>
                            <button onClick={() => { if (confirm(`Laporkan "${b.nama}" (${b.no_sbg}) HILANG?`)) aksi({ action: "hilang", id: b.id }); }}
                              className="text-[11px] text-red-500 hover:underline">Lapor hilang</button>
                          </div>
                        )
                      ) : (
                        <button className="shrink-0 text-xs font-semibold text-navy-600 border border-slate-200 rounded-lg px-2.5 py-2 hover:bg-navy-50"
                          onClick={() => setLokModal({ ids: [b.id], val: b.lokasi || "" })}>
                          <i className="bi bi-geo-alt me-1" />{b.lokasi ? "Ubah" : "Set lokasi"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal set lokasi */}
      {lokModal && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 grid place-items-center p-4" onClick={() => setLokModal(null)}>
          <div className="card p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-navy-900">Lokasi Penyimpanan</h2>
            <p className="text-xs text-slate-500">Untuk {lokModal.ids.length} barang. Contoh: <b>Brankas A / Rak 2 / Slot 15</b>.</p>
            <input className="input" autoFocus placeholder="mis. Brankas A / Rak 2" value={lokModal.val}
              onChange={(e) => setLokModal({ ...lokModal, val: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") simpanLokasi(); }} />
            <div className="flex gap-2 justify-end">
              <button className="btn-ghost" onClick={() => setLokModal(null)}>Batal</button>
              <button className="btn-primary" onClick={simpanLokasi}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
