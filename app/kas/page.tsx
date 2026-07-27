"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { rupiah, tanggalID } from "@/lib/gadai";

const KAT: Record<string, string> = {
  pencairan: "Pencairan", pembayaran: "Pembayaran", operasional: "Operasional",
  modal: "Setor Modal", prive: "Prive/Ambil", lelang: "Lelang", lainnya: "Lainnya",
};
const today = () => new Date().toISOString().slice(0, 10);

export default function KasPage() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(today().slice(0, 8) + "01");
  const [to, setTo] = useState(today());
  const [add, setAdd] = useState(false);
  const [tutup, setTutup] = useState(false);
  const [form, setForm] = useState({ arah: "keluar", kategori: "operasional", metode: "tunai", jumlah: "", keterangan: "", tgl: today() });
  const [fisik, setFisik] = useState("");
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/kas?from=${from}&to=${to}`).then((r) => r.json()).then(setD).finally(() => setLoading(false));
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  async function simpanEntri() {
    if (Number(form.jumlah) <= 0) return;
    setBusy(true);
    const r = await fetch("/api/kas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setBusy(false);
    if (r.ok) { setAdd(false); setForm({ ...form, jumlah: "", keterangan: "" }); load(); }
  }
  async function hapus(id: number) {
    if (!confirm("Hapus entri kas ini?")) return;
    const r = await fetch(`/api/kas?id=${id}`, { method: "DELETE" });
    if (r.ok) load(); else alert((await r.json()).error || "Gagal");
  }
  async function simpanTutup() {
    setBusy(true);
    const r = await fetch("/api/kas/tutup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saldo_fisik: Number(fisik) || 0, catatan }) });
    setBusy(false);
    if (r.ok) { setTutup(false); setCatatan(""); load(); }
  }

  const saldo = d?.saldo || { tunai: 0, transfer: 0, total: 0 };
  const per = d?.periode || { masuk: 0, keluar: 0, net: 0 };
  const selisihPreview = (Number(fisik) || 0) - saldo.tunai;

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold text-navy-900">Buku Kas</h1>
        <div className="flex gap-2">
          <button className="btn-ghost text-sm" onClick={() => setTutup(true)}><i className="bi bi-safe2" /> Tutup Kas</button>
          <button className="btn-gold text-sm" onClick={() => { setForm({ arah: "keluar", kategori: "operasional", metode: "tunai", jumlah: "", keterangan: "", tgl: today() }); setAdd(true); }}><i className="bi bi-plus-lg" /> Entri</button>
        </div>
      </div>
      <p className="text-slate-500 text-sm mb-4">Arus kas masuk/keluar & saldo. Pencairan & pembayaran tercatat otomatis.</p>

      {/* Saldo */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card p-4 text-center">
          <div className="text-[11px] text-slate-500 mb-0.5"><i className="bi bi-cash-stack me-1" />Kas Tunai</div>
          <div className={`text-lg font-bold tnum ${saldo.tunai < 0 ? "text-red-600" : "text-navy-900"}`}>{rupiah(saldo.tunai)}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-[11px] text-slate-500 mb-0.5"><i className="bi bi-bank me-1" />Bank/Transfer</div>
          <div className={`text-lg font-bold tnum ${saldo.transfer < 0 ? "text-red-600" : "text-navy-900"}`}>{rupiah(saldo.transfer)}</div>
        </div>
        <div className="card p-4 text-center bg-navy-900 text-white">
          <div className="text-[11px] text-navy-200 mb-0.5">Total Saldo</div>
          <div className="text-lg font-bold tnum">{rupiah(saldo.total)}</div>
        </div>
      </div>

      {d?.tutup_hari_ini && (
        <div className={`card p-3 mb-4 text-sm flex items-center gap-2 ${d.tutup_hari_ini.selisih === 0 ? "text-emerald-700" : "text-red-600"}`}>
          <i className={`bi ${d.tutup_hari_ini.selisih === 0 ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}`} />
          Kas hari ini sudah ditutup — fisik {rupiah(d.tutup_hari_ini.saldo_fisik)}
          {d.tutup_hari_ini.selisih === 0 ? " (cocok)" : ` (selisih ${rupiah(d.tutup_hari_ini.selisih)})`}
        </div>
      )}

      {/* Filter periode */}
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div><label className="label">Dari</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label">Sampai</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="flex-1 min-w-[180px] text-right text-sm">
          <span className="text-emerald-600 font-semibold tnum">+{rupiah(per.masuk)}</span>
          <span className="text-slate-300 mx-1">/</span>
          <span className="text-red-600 font-semibold tnum">−{rupiah(per.keluar)}</span>
          <div className="text-[11px] text-slate-500">Net periode: <b className={per.net < 0 ? "text-red-600" : "text-navy-800"}>{rupiah(per.net)}</b></div>
        </div>
      </div>

      {/* Daftar */}
      {loading ? (
        <div className="card p-8 text-center text-slate-400 text-sm">Memuat…</div>
      ) : (d?.entries || []).length === 0 ? (
        <div className="card p-8 text-center text-slate-400 text-sm">Belum ada arus kas pada periode ini.</div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {d.entries.map((e: any) => {
            const masuk = e.arah === "masuk";
            const auto = e.ref_gadai_id || e.ref_pembayaran_id;
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${masuk ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                  <i className={`bi ${masuk ? "bi-arrow-down-left" : "bi-arrow-up-right"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-navy-900 truncate">
                    {KAT[e.kategori] || e.kategori}
                    {e.keterangan ? <span className="font-normal text-slate-500"> · {e.ref_gadai_id ? <Link href={`/transaksi/${e.ref_gadai_id}`} className="text-navy-600 hover:underline">{e.keterangan}</Link> : e.keterangan}</span> : ""}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {tanggalID(e.tgl)} · <span className="capitalize">{e.metode}</span>{e.oleh ? ` · ${e.oleh}` : ""}
                  </div>
                </div>
                <div className={`font-bold tnum shrink-0 ${masuk ? "text-emerald-600" : "text-red-600"}`}>{masuk ? "+" : "−"}{rupiah(e.jumlah)}</div>
                {d.admin && !auto && (
                  <button className="shrink-0 text-slate-300 hover:text-red-500" onClick={() => hapus(e.id)} title="Hapus"><i className="bi bi-trash3" /></button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal entri manual */}
      {add && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 grid place-items-center p-4" onClick={() => setAdd(false)}>
          <div className="card p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-navy-900">Entri Kas Manual</h2>
            <div className="grid grid-cols-2 gap-2">
              {(["keluar", "masuk"] as const).map((a) => (
                <button key={a} onClick={() => setForm({ ...form, arah: a })}
                  className={`py-2 rounded-xl text-sm font-semibold border ${form.arah === a ? (a === "masuk" ? "bg-emerald-600 text-white border-emerald-600" : "bg-red-600 text-white border-red-600") : "bg-white text-navy-700 border-slate-200"}`}>
                  {a === "masuk" ? "Uang Masuk" : "Uang Keluar"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Kategori</label>
                <select className="input" value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}>
                  <option value="operasional">Operasional</option>
                  <option value="modal">Setor Modal</option>
                  <option value="prive">Prive / Ambil</option>
                  <option value="lelang">Lelang</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>
              <div><label className="label">Metode</label>
                <select className="input" value={form.metode} onChange={(e) => setForm({ ...form, metode: e.target.value })}>
                  <option value="tunai">Tunai</option><option value="transfer">Transfer</option>
                </select>
              </div>
            </div>
            <div><label className="label">Jumlah (Rp)</label>
              <input className="input tnum" inputMode="numeric" value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: e.target.value.replace(/\D/g, "") })} /></div>
            <div><label className="label">Tanggal</label><input type="date" className="input" value={form.tgl} onChange={(e) => setForm({ ...form, tgl: e.target.value })} /></div>
            <div><label className="label">Keterangan</label><input className="input" placeholder="mis. Bayar listrik" value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} /></div>
            <div className="flex gap-2 justify-end">
              <button className="btn-ghost" onClick={() => setAdd(false)}>Batal</button>
              <button className="btn-primary" onClick={simpanEntri} disabled={busy || Number(form.jumlah) <= 0}>{busy ? "…" : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal tutup kas */}
      {tutup && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 grid place-items-center p-4" onClick={() => setTutup(false)}>
          <div className="card p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-navy-900">Tutup Kas Hari Ini</h2>
            <div className="bg-navy-50 rounded-xl p-3 text-sm flex justify-between">
              <span className="text-slate-500">Kas tunai menurut sistem</span>
              <span className="font-bold text-navy-900 tnum">{rupiah(saldo.tunai)}</span>
            </div>
            <div><label className="label">Hitungan fisik laci (Rp)</label>
              <input className="input tnum" inputMode="numeric" autoFocus value={fisik} onChange={(e) => setFisik(e.target.value.replace(/\D/g, ""))} /></div>
            {fisik !== "" && (
              <div className={`text-sm font-semibold ${selisihPreview === 0 ? "text-emerald-600" : "text-red-600"}`}>
                {selisihPreview === 0 ? "✓ Cocok, tidak ada selisih." : `Selisih: ${rupiah(selisihPreview)} (${selisihPreview > 0 ? "lebih" : "kurang"})`}
              </div>
            )}
            <div><label className="label">Catatan (opsional)</label><input className="input" value={catatan} onChange={(e) => setCatatan(e.target.value)} /></div>
            <div className="flex gap-2 justify-end">
              <button className="btn-ghost" onClick={() => setTutup(false)}>Batal</button>
              <button className="btn-primary" onClick={simpanTutup} disabled={busy || fisik === ""}>{busy ? "…" : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
