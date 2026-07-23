"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { rupiah, tanggalID, statusJatuhTempo, STATUS_BADGE } from "@/lib/gadai";
import { cetakSBG } from "@/lib/cetak";

type Aksi = "tebus" | "perpanjang" | "cicil" | "lelang" | null;

export default function DetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aksi, setAksi] = useState<Aksi>(null);
  const [cicil, setCicil] = useState("");
  const [hargaLelang, setHargaLelang] = useState("");
  const [proc, setProc] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(() => {
    fetch(`/api/gadai/${id}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => {
      setData(d); setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2600); return () => clearTimeout(t); }, [toast]);

  if (loading) return <AppShell><div className="p-8 text-center text-slate-400">Memuat…</div></AppShell>;
  if (!data?.gadai) return <AppShell><div className="p-8 text-center text-slate-400">Transaksi tidak ditemukan.</div></AppShell>;

  const g = data.gadai;
  const tebus = data.tebus;
  const aktif = g.status === "aktif";
  const badge = aktif ? (STATUS_BADGE[statusJatuhTempo(g.tgl_jatuh_tempo)] || STATUS_BADGE.aktif) : STATUS_BADGE[g.status];
  const selisihLelang = Number(g.harga_lelang || 0) - Number(g.nilai_kewajiban_lelang || 0);
  const previewSelisih = Number(hargaLelang || 0) - (tebus ? tebus.total : 0);

  async function proses() {
    setProc(true);
    let r: Response;
    if (aksi === "lelang") {
      r = await fetch(`/api/gadai/${id}/lelang`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ harga_lelang: Number(hargaLelang || 0) }),
      });
    } else {
      const body: any = { jenis: aksi };
      if (aksi === "cicil") body.pokok_dibayar = Number(cicil || 0);
      r = await fetch(`/api/gadai/${id}/bayar`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
    }
    setProc(false);
    const d = await r.json();
    if (r.ok) {
      setAksi(null); setCicil(""); setHargaLelang("");
      setToast(aksi === "tebus" ? "Barang ditebus / lunas" : aksi === "perpanjang" ? "Gadai diperpanjang"
        : aksi === "cicil" ? "Cicilan tercatat" : "Barang ditandai lelang");
      load();
    } else {
      setToast(d.error || "Gagal memproses");
    }
  }

  function doCetak() {
    cetakSBG(g, data.barang || [], data.usaha || g.nasabah_nama);
  }

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-5">
        <Link href="/transaksi" className="btn-ghost px-3"><i className="bi bi-arrow-left" /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-navy-900 tnum">{g.no_sbg}</h1>
          <span className={`badge ${badge?.cls} mt-1`}><i className={`bi ${badge?.icon}`} />{badge?.label}</span>
        </div>
        <button className="btn-ghost" onClick={doCetak}><i className="bi bi-printer" /> Cetak SBG</button>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Nasabah */}
          <section className="card p-5">
            <h2 className="font-bold text-navy-900 mb-2"><i className="bi bi-person me-2 text-navy-500" />Nasabah</h2>
            <div className="text-lg font-semibold text-navy-900">{g.nasabah_nama}</div>
            <div className="text-sm text-slate-500 tnum">{g.nasabah_hp || "—"}{g.nasabah_ktp ? ` · KTP ${g.nasabah_ktp}` : ""}</div>
            {g.nasabah_alamat && <div className="text-sm text-slate-500 mt-1">{g.nasabah_alamat}</div>}
          </section>

          {/* Barang */}
          <section className="card p-5">
            <h2 className="font-bold text-navy-900 mb-3"><i className="bi bi-box-seam me-2 text-navy-500" />Barang Jaminan</h2>
            <ul className="divide-y divide-slate-100">
              {(data.barang || []).map((b: any) => (
                <li key={b.id} className="flex items-center gap-3 py-2.5">
                  {b.foto_url && (
                    <img src={b.foto_url} alt="" className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-navy-900">{b.nama}</div>
                    <div className="text-xs text-slate-500 capitalize">
                      {b.jenis}{b.kadar ? ` · ${b.kadar}` : ""}{b.berat_gram ? ` · ${b.berat_gram} gr` : ""}
                    </div>
                  </div>
                  <div className="font-semibold text-navy-900 tnum">{rupiah(b.taksiran)}</div>
                </li>
              ))}
            </ul>
          </section>

          {/* Riwayat pembayaran */}
          <section className="card p-5">
            <h2 className="font-bold text-navy-900 mb-3"><i className="bi bi-receipt me-2 text-navy-500" />Riwayat Pembayaran</h2>
            {(data.pembayaran || []).length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada pembayaran.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.pembayaran.map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="font-medium capitalize text-navy-900">{p.jenis}</div>
                      <div className="text-xs text-slate-500 tnum">{tanggalID(p.tgl)}
                        {p.bunga_dibayar > 0 ? ` · bunga ${rupiah(p.bunga_dibayar)}` : ""}
                        {p.denda_dibayar > 0 ? ` · denda ${rupiah(p.denda_dibayar)}` : ""}
                        {p.pokok_dibayar > 0 ? ` · pokok ${rupiah(p.pokok_dibayar)}` : ""}</div>
                    </div>
                    <div className="font-semibold text-navy-900 tnum">{rupiah(p.total)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Ringkasan + aksi */}
        <div className="space-y-5">
          <section className="card p-5 space-y-2 lg:sticky lg:top-6">
            <h2 className="font-bold text-navy-900 mb-1"><i className="bi bi-cash-coin me-2 text-navy-500" />Pinjaman</h2>
            <Row k="Total Taksiran" v={rupiah(g.taksiran)} />
            <Row k="Pokok Awal" v={rupiah(g.pokok)} />
            <Row k="Sisa Pokok" v={rupiah(g.pokok_sisa)} bold />
            <Row k="Bunga" v={`${g.bunga_persen}% / ${g.periode_hari} hr`} />
            <Row k="Tgl Gadai" v={tanggalID(g.tgl_gadai)} />
            <Row k="Jatuh Tempo" v={tanggalID(g.tgl_jatuh_tempo)} />

            {aktif && tebus && (
              <div className="bg-navy-50 rounded-xl p-3 mt-3 space-y-1">
                <div className="text-xs font-semibold text-slate-500 mb-1">
                  Untuk tebus hari ini ({tebus.periode} periode{tebus.hariTelat > 0 ? `, telat ${tebus.hariTelat} hr` : ""})
                </div>
                <Row k="Sisa Pokok" v={rupiah(tebus.pokok)} />
                <Row k="Bunga" v={rupiah(tebus.bunga)} />
                {tebus.denda > 0 && <Row k="Denda telat" v={rupiah(tebus.denda)} />}
                <div className="flex justify-between border-t border-navy-200 pt-1.5 mt-1">
                  <span className="font-semibold text-navy-900">Total Tebus</span>
                  <span className="font-bold text-emerald-700 tnum">{rupiah(tebus.total)}</span>
                </div>
              </div>
            )}

            {aktif ? (
              <>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <button className="btn-primary text-xs px-2" onClick={() => setAksi("tebus")}><i className="bi bi-bag-check" />Tebus</button>
                  <button className="btn-ghost text-xs px-2" onClick={() => setAksi("perpanjang")}><i className="bi bi-arrow-repeat" />Perpanjang</button>
                  <button className="btn-ghost text-xs px-2" onClick={() => setAksi("cicil")}><i className="bi bi-coin" />Cicil</button>
                </div>
                <button className="w-full mt-2 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-xl py-2 transition-colors"
                  onClick={() => setAksi("lelang")}>
                  <i className="bi bi-hammer me-1" />Lelang Barang
                </button>
              </>
            ) : g.status === "lunas" ? (
              <div className="text-center text-sm text-slate-500 pt-2">Ditebus {tanggalID(g.tgl_lunas)}</div>
            ) : (
              <div className="bg-navy-50 rounded-xl p-3 mt-2 space-y-1">
                <div className="text-xs font-semibold text-slate-500 mb-1"><i className="bi bi-hammer me-1" />Hasil Lelang · {tanggalID(g.tgl_lelang)}</div>
                <Row k="Kewajiban" v={rupiah(g.nilai_kewajiban_lelang)} />
                <Row k="Harga Jual" v={rupiah(g.harga_lelang)} />
                <div className="flex justify-between border-t border-navy-200 pt-1.5 mt-1">
                  {selisihLelang >= 0 ? (
                    <><span className="font-semibold text-emerald-700">Kelebihan (ke nasabah)</span><span className="font-bold text-emerald-700 tnum">{rupiah(selisihLelang)}</span></>
                  ) : (
                    <><span className="font-semibold text-red-600">Kekurangan</span><span className="font-bold text-red-600 tnum">{rupiah(-selisihLelang)}</span></>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Modal aksi */}
      {aksi && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 grid place-items-center p-4" onClick={() => !proc && setAksi(null)}>
          <div className="card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-navy-900 mb-3">
              {aksi === "tebus" ? "Tebus / Pelunasan" : aksi === "perpanjang" ? "Perpanjang Gadai" : aksi === "cicil" ? "Cicil Pokok" : "Lelang Barang"}
            </h3>

            {aksi === "tebus" && tebus && (
              <p className="text-sm text-slate-600 mb-4">Nasabah membayar <b className="text-navy-900">{rupiah(tebus.total)}</b> (pokok {rupiah(tebus.pokok)} + bunga {rupiah(tebus.bunga)}{tebus.denda > 0 ? ` + denda ${rupiah(tebus.denda)}` : ""}). Barang dikembalikan & SBG lunas.</p>
            )}
            {aksi === "perpanjang" && tebus && (
              <p className="text-sm text-slate-600 mb-4">Nasabah membayar bunga <b className="text-navy-900">{rupiah(tebus.bunga)}</b>{tebus.denda > 0 ? ` + denda ${rupiah(tebus.denda)}` : ""} = <b className="text-navy-900">{rupiah(tebus.bunga + tebus.denda)}</b>. Jatuh tempo diperpanjang & siklus bunga direset.</p>
            )}
            {aksi === "cicil" && tebus && (
              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-2">Bayar bunga <b className="text-navy-900">{rupiah(tebus.bunga)}</b>{tebus.denda > 0 ? ` + denda ${rupiah(tebus.denda)}` : ""} + cicilan pokok:</p>
                <input className="input tnum" inputMode="numeric" placeholder="Nominal cicilan pokok"
                  value={cicil} onChange={(e) => setCicil(e.target.value.replace(/\D/g, ""))} autoFocus />
                <p className="text-[11px] text-slate-400 mt-1">Maks {rupiah(g.pokok_sisa)}. Total bayar: {rupiah(tebus.bunga + tebus.denda + Number(cicil || 0))}</p>
              </div>
            )}
            {aksi === "lelang" && tebus && (
              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-2">Kewajiban nasabah <b className="text-navy-900">{rupiah(tebus.total)}</b> (pokok+bunga+denda). Masukkan harga jual barang:</p>
                <input className="input tnum" inputMode="numeric" placeholder="Harga jual lelang"
                  value={hargaLelang} onChange={(e) => setHargaLelang(e.target.value.replace(/\D/g, ""))} autoFocus />
                {hargaLelang !== "" && (
                  <p className={`text-xs mt-1.5 font-semibold ${previewSelisih >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {previewSelisih >= 0 ? `Kelebihan ${rupiah(previewSelisih)} dikembalikan ke nasabah` : `Kekurangan ${rupiah(-previewSelisih)}`}
                  </p>
                )}
                <p className="text-[11px] text-slate-400 mt-1">Status gadai akan menjadi &ldquo;Lelang&rdquo; dan tidak bisa ditebus lagi.</p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button className="btn-ghost" onClick={() => setAksi(null)} disabled={proc}>Batal</button>
              <button className="btn-gold" onClick={proses} disabled={proc || (aksi === "cicil" && Number(cicil) <= 0) || (aksi === "lelang" && hargaLelang === "")}>
                {proc ? "Memproses…" : "Konfirmasi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-navy-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-pop">
          {toast}
        </div>
      )}
    </AppShell>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{k}</span>
      <span className={`tnum ${bold ? "font-bold text-navy-900" : "font-medium text-navy-800"}`}>{v}</span>
    </div>
  );
}
