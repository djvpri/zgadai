"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { rupiah } from "@/lib/gadai";

const DEFAULT_JENIS = ["emas", "elektronik", "kendaraan", "lainnya"];

export default function PengaturanPage() {
  const [harga, setHarga] = useState("");
  const [plafon, setPlafon] = useState("90");
  const [bunga, setBunga] = useState("2");
  const [periode, setPeriode] = useState("15");
  const [tempo, setTempo] = useState("30");
  const [admin, setAdmin] = useState("0");
  const [adminPersen, setAdminPersen] = useState("0");
  const [denda, setDenda] = useState("0");
  const [namaToko, setNamaToko] = useState("");
  const [wa, setWa] = useState("");
  const [alamatToko, setAlamatToko] = useState("");
  const [jenis, setJenis] = useState<string[]>(DEFAULT_JENIS);
  const [newJenis, setNewJenis] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      const s = d.settings || {};
      if (d.nama_usaha) setNamaToko(d.nama_usaha);
      if (s.harga_emas_per_gram) setHarga(String(s.harga_emas_per_gram));
      if (s.plafon_persen) setPlafon(String(s.plafon_persen));
      if (s.bunga_persen !== undefined) setBunga(String(s.bunga_persen));
      if (s.periode_hari) setPeriode(String(s.periode_hari));
      if (s.tempo_hari) setTempo(String(s.tempo_hari));
      if (s.biaya_admin !== undefined) setAdmin(String(s.biaya_admin));
      if (s.biaya_admin_persen !== undefined) setAdminPersen(String(s.biaya_admin_persen));
      if (s.denda_persen_per_hari !== undefined) setDenda(String(s.denda_persen_per_hari));
      if (s.no_wa) setWa(s.no_wa);
      if (s.alamat_toko) setAlamatToko(s.alamat_toko);
      if (Array.isArray(s.jenis_barang) && s.jenis_barang.length) setJenis(s.jenis_barang);
    }).finally(() => setLoading(false));
  }, []);

  function addJenis() {
    const v = newJenis.trim().toLowerCase();
    if (!v || jenis.includes(v)) { setNewJenis(""); return; }
    setJenis([...jenis, v]);
    setNewJenis("");
  }

  async function simpan() {
    setSaving(true); setMsg(""); setErr("");
    const r = await fetch("/api/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nama_usaha: namaToko,
        harga_emas_per_gram: Number(harga || 0),
        plafon_persen: Number(plafon || 90),
        bunga_persen: Number(bunga || 0),
        periode_hari: Number(periode || 15),
        tempo_hari: Number(tempo || 30),
        biaya_admin: Number(admin || 0),
        biaya_admin_persen: Number(adminPersen || 0),
        denda_persen_per_hari: Number(denda || 0),
        no_wa: wa,
        alamat_toko: alamatToko,
        jenis_barang: jenis,
      }),
    });
    setSaving(false);
    const d = await r.json();
    if (r.ok) setMsg("Pengaturan disimpan.");
    else setErr(d.error || "Gagal menyimpan");
  }

  const num = (v: string, set: (s: string) => void, extra = "") => (
    <input className={`input tnum ${extra}`} inputMode="numeric" value={v}
      onChange={(e) => set(e.target.value.replace(/[^\d.]/g, ""))} disabled={loading} />
  );

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Pengaturan</h1>
          <p className="text-slate-500 text-sm">Default & konfigurasi usaha gadai</p>
        </div>
        <button className="btn-primary" onClick={simpan} disabled={saving || loading}>
          <i className="bi bi-check2" /> {saving ? "Menyimpan…" : "Simpan"}
        </button>
      </div>

      {(msg || err) && (
        <p className={`text-sm mb-4 ${err ? "text-red-600" : "text-emerald-600"}`}>
          {err ? err : <><i className="bi bi-check-circle me-1" />{msg}</>}
        </p>
      )}

      <div className="grid lg:grid-cols-2 gap-5 max-w-4xl">
        {/* Harga emas */}
        <section className="card p-5 space-y-3">
          <h2 className="font-bold text-navy-900"><i className="bi bi-coin me-2 text-gold-500" />Harga Taksir Emas</h2>
          <div>
            <label className="label">Harga per gram (emas murni / 24K)</label>
            {num(harga, setHarga)}
            <p className="text-[11px] text-slate-400 mt-1.5">
              Taksiran emas = <b>berat × kadar × harga</b>. Contoh 22K 5gr = {rupiah(5 * 0.9167 * Number(harga || 0))}.
            </p>
          </div>
        </section>

        {/* Default pinjaman */}
        <section className="card p-5 space-y-3">
          <h2 className="font-bold text-navy-900"><i className="bi bi-sliders me-2 text-navy-500" />Default Pinjaman</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Bunga %/periode</label>{num(bunga, setBunga)}</div>
            <div><label className="label">Periode (hari)</label>{num(periode, setPeriode)}</div>
            <div><label className="label">Tempo (hari)</label>{num(tempo, setTempo)}</div>
            <div><label className="label">Plafon % taksiran</label>{num(plafon, setPlafon)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Biaya admin (nominal)</label>{num(admin, setAdmin)}</div>
            <div><label className="label">Biaya admin % pinjaman</label>{num(adminPersen, setAdminPersen)}</div>
          </div>
          <div>
            <label className="label">Denda telat (% pokok / hari)</label>
            {num(denda, setDenda)}
            <p className="text-[11px] text-slate-400 mt-1">Denda = sisa pokok × %/hari × hari telat, ditagih saat tebus/perpanjang/cicil.</p>
          </div>
          <p className="text-[11px] text-slate-400">Biaya admin = nominal + %×pinjaman, otomatis terisi di Gadai Baru (bisa diubah per transaksi).</p>
        </section>

        {/* Kontak toko */}
        <section className="card p-5 space-y-3 lg:col-span-2">
          <h2 className="font-bold text-navy-900"><i className="bi bi-shop me-2 text-navy-500" />Identitas & Kontak Toko</h2>
          <div>
            <label className="label">Nama Toko</label>
            <input className="input" placeholder="Nama usaha gadai" disabled={loading}
              value={namaToko} onChange={(e) => setNamaToko(e.target.value)} />
            <p className="text-[11px] text-slate-400 mt-1">Tampil di kop SBG, nota, portal nasabah & sidebar.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">No. WhatsApp toko</label>
              <input className="input tnum" inputMode="tel" placeholder="08xxxxxxxxxx" disabled={loading}
                value={wa} onChange={(e) => setWa(e.target.value)} />
              <p className="text-[11px] text-slate-400 mt-1">Dipakai di kop SBG & pengingat WhatsApp ke nasabah.</p>
            </div>
            <div>
              <label className="label">Alamat toko</label>
              <input className="input" placeholder="Alamat lengkap toko" disabled={loading}
                value={alamatToko} onChange={(e) => setAlamatToko(e.target.value)} />
            </div>
          </div>
        </section>

        {/* Jenis barang */}
        <section className="card p-5 space-y-3 lg:col-span-2">
          <h2 className="font-bold text-navy-900"><i className="bi bi-tags me-2 text-navy-500" />Jenis Barang Jaminan</h2>
          <div className="flex flex-wrap gap-2">
            {jenis.map((j) => (
              <span key={j} className="badge bg-navy-50 border border-slate-200 text-navy-700 capitalize pr-1">
                {j}
                <button onClick={() => setJenis(jenis.filter((x) => x !== j))}
                  className="ml-1 w-4 h-4 grid place-items-center rounded-full hover:bg-slate-200 text-slate-500">
                  <i className="bi bi-x text-xs" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 max-w-sm">
            <input className="input capitalize" placeholder="Tambah jenis (mis. laptop)"
              value={newJenis} onChange={(e) => setNewJenis(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addJenis(); } }} />
            <button className="btn-ghost" onClick={addJenis} type="button"><i className="bi bi-plus-lg" /></button>
          </div>
          <p className="text-[11px] text-slate-400">Muncul sebagai pilihan di form barang jaminan. &ldquo;emas&rdquo; dipakai untuk taksir otomatis via harga emas.</p>
        </section>
      </div>
    </AppShell>
  );
}
