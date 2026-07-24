"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { rupiah, plafon, tambahHari, tanggalID, taksiranEmas } from "@/lib/gadai";
import { compressImage, frameToDataUrl } from "@/lib/img";

interface Nasabah { id: number; nama: string; no_hp: string | null }
interface Barang { jenis: string; nama: string; berat_gram: string; kadar: string; taksiran: string; fotos: string[] }

const JENIS = ["emas", "elektronik", "kendaraan", "lainnya"];
const MIN_FOTO = 4;
const emptyBarang = (): Barang => ({ jenis: "emas", nama: "", berat_gram: "", kadar: "", taksiran: "", fotos: [] });

export default function GadaiBaruPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState<Nasabah[]>([]);
  const [nasabah, setNasabah] = useState<Nasabah | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [baru, setBaru] = useState({ nama: "", no_hp: "", no_ktp: "", email: "" });

  const [barang, setBarang] = useState<Barang[]>([emptyBarang()]);
  const [tglGadai, setTglGadai] = useState(new Date().toISOString().slice(0, 10));
  const [tempoHari, setTempoHari] = useState(30);
  const [periodeHari, setPeriodeHari] = useState(15);
  const [bunga, setBunga] = useState("2");
  const [biayaAdmin, setBiayaAdmin] = useState("0");
  const [pokok, setPokok] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [cam, setCam] = useState<{ kind: "barang"; idx: number } | { kind: "nasabah" } | null>(null);
  const [fotoNasabah, setFotoNasabah] = useState("");
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [hargaEmas, setHargaEmas] = useState(0);
  const [jenisOpts, setJenisOpts] = useState<string[]>(JENIS);
  const [plafonPersen, setPlafonPersen] = useState(90);
  const [adminTetap, setAdminTetap] = useState(0);
  const [adminPersen, setAdminPersen] = useState(0);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      const s = d.settings || {};
      setHargaEmas(Number(s.harga_emas_per_gram || 0));
      if (Array.isArray(s.jenis_barang) && s.jenis_barang.length) setJenisOpts(s.jenis_barang);
      if (s.plafon_persen) setPlafonPersen(Number(s.plafon_persen));
      if (s.bunga_persen !== undefined) setBunga(String(s.bunga_persen));
      if (s.periode_hari) setPeriodeHari(Number(s.periode_hari));
      if (s.tempo_hari) setTempoHari(Number(s.tempo_hari));
      const at = Number(s.biaya_admin || 0);
      const ap = Number(s.biaya_admin_persen || 0);
      setAdminTetap(at); setAdminPersen(ap);
      if (at > 0) setBiayaAdmin(String(at));
    }).catch(() => {});
  }, []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Webcam: barang (kamera belakang) / nasabah (kamera depan).
  useEffect(() => {
    if (!cam) return;
    let active = true;
    const facingMode = cam.kind === "nasabah" ? "user" : "environment";
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode } }, audio: false })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
      })
      .catch(() => { setErr("Tidak bisa mengakses kamera. Izinkan akses atau pakai Upload."); setCam(null); });
    return () => { active = false; streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  }, [cam]);

  useEffect(() => {
    if (nasabah) return;
    const t = setTimeout(() => {
      fetch(`/api/nasabah?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((d) => setHasil(d.nasabah || []));
    }, 200);
    return () => clearTimeout(t);
  }, [q, nasabah]);

  const totalTaksiran = barang.reduce((s, b) => s + Number(b.taksiran || 0), 0);
  const saranPlafon = plafon(totalTaksiran, plafonPersen);
  const jatuhTempo = tambahHari(tglGadai, tempoHari);

  function setB(i: number, patch: Partial<Barang>) {
    setBarang((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  // Update uang pinjaman + hitung ulang biaya admin (nominal + %×pinjaman).
  function updatePokok(v: string) {
    setPokok(v);
    if (adminTetap > 0 || adminPersen > 0) {
      setBiayaAdmin(String(adminTetap + Math.round((Number(v || 0) * adminPersen) / 100)));
    }
  }

  // Emas: update field lalu hitung ulang taksiran = berat × kadar × harga.
  function setEmasField(i: number, patch: Partial<Barang>) {
    setBarang((prev) => prev.map((b, idx) => {
      if (idx !== i) return b;
      const nb = { ...b, ...patch };
      if (nb.jenis === "emas" && hargaEmas > 0) {
        const t = taksiranEmas(Number(nb.berat_gram), nb.kadar, hargaEmas);
        if (t > 0) nb.taksiran = String(t);
      }
      return nb;
    }));
  }

  async function taksir(idx: number, images: string[]) {
    if (images.length === 0) return;
    setBusyIdx(idx);
    setNotes((n) => ({ ...n, [idx]: "" }));
    try {
      const r = await fetch("/api/jaminan/taksir", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: images.slice(0, 4), mimeType: "image/jpeg" }),
      });
      const d = await r.json();
      if (!r.ok) { setNotes((n) => ({ ...n, [idx]: d.error || "Gagal menaksir" })); return; }
      setBarang((prev) => prev.map((b, i) => {
        if (i !== idx) return b;
        const nb = {
          ...b,
          jenis: d.jenis || b.jenis,
          nama: d.nama || b.nama,
          kadar: d.kadar || b.kadar,
          berat_gram: d.berat_gram != null ? String(d.berat_gram) : b.berat_gram,
          taksiran: d.taksiran ? String(d.taksiran) : b.taksiran,
        };
        // Emas + harga tersetel: pakai rumus (lebih andal dari tebakan AI).
        if (nb.jenis === "emas" && hargaEmas > 0) {
          const t = taksiranEmas(Number(nb.berat_gram), nb.kadar, hargaEmas);
          if (t > 0) nb.taksiran = String(t);
        }
        return nb;
      }));
      setNotes((n) => ({ ...n, [idx]: d.catatan || "Taksiran AI — verifikasi & sesuaikan." }));
    } catch {
      setNotes((n) => ({ ...n, [idx]: "Gagal memproses gambar" }));
    } finally {
      setBusyIdx(null);
    }
  }

  // Ambil foto webcam. Barang: tambah ke galeri (modal tetap terbuka).
  // Nasabah: foto dokumentasi transaksi (modal ditutup).
  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !cam) return;
    if (cam.kind === "nasabah") {
      setFotoNasabah(frameToDataUrl(v, 480, 0.7));
      setCam(null);
      return;
    }
    const idx = cam.idx;
    const dataUrl = frameToDataUrl(v, 640, 0.8);
    const cur = barang[idx]?.fotos || [];
    setB(idx, { fotos: [...cur, dataUrl].slice(0, 8) });
    if (cur.length === 0) taksir(idx, [dataUrl]); // auto-taksir dari foto pertama
  }

  async function uploadNasabah(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFotoNasabah(await compressImage(file, 480, 0.7));
  }

  async function uploadJaminan(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const cur = barang[idx]?.fotos || [];
    const added: string[] = [];
    for (const f of files.slice(0, 8)) added.push(await compressImage(f, 640, 0.8));
    setB(idx, { fotos: [...cur, ...added].slice(0, 8) });
    if (cur.length === 0 && added.length) taksir(idx, [added[0]]);
  }

  function removeFoto(i: number, fi: number) {
    setBarang((prev) => prev.map((b, idx) => (idx === i ? { ...b, fotos: b.fotos.filter((_, k) => k !== fi) } : b)));
  }

  async function buatNasabah() {
    if (!baru.nama.trim()) return;
    const r = await fetch("/api/nasabah", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(baru),
    });
    if (r.ok) {
      const d = await r.json();
      setNasabah({ id: d.nasabah.id, nama: d.nasabah.nama, no_hp: d.nasabah.no_hp });
      setShowNew(false);
    }
  }

  async function submit() {
    setErr("");
    if (!nasabah) { setErr("Pilih nasabah dulu"); return; }
    const validBarang = barang.filter((b) => b.nama.trim() && Number(b.taksiran) > 0);
    if (validBarang.length === 0) { setErr("Isi minimal 1 barang dengan taksiran"); return; }
    if (validBarang.some((b) => b.fotos.length < MIN_FOTO)) { setErr(`Setiap barang butuh minimal ${MIN_FOTO} foto`); return; }
    if (Number(pokok) <= 0) { setErr("Isi uang pinjaman"); return; }
    setSaving(true);
    const r = await fetch("/api/gadai", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nasabah_id: nasabah.id, tgl_gadai: tglGadai, tempo_hari: tempoHari,
        periode_hari: periodeHari, bunga_persen: Number(bunga), biaya_admin: Number(biayaAdmin),
        pokok: Number(pokok), foto_nasabah: fotoNasabah || null,
        barang: validBarang.map((b) => ({
          jenis: b.jenis, nama: b.nama, berat_gram: b.berat_gram || null,
          kadar: b.kadar || null, taksiran: Number(b.taksiran), fotos: b.fotos,
        })),
      }),
    });
    setSaving(false);
    if (r.ok) {
      const d = await r.json();
      router.push(`/transaksi/${d.id}?baru=1`);
    } else {
      const d = await r.json();
      setErr(d.error || "Gagal menyimpan");
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-navy-900 mb-1">Gadai Baru</h1>
      <p className="text-slate-500 text-sm mb-6">Buat pinjaman gadai & Surat Bukti Gadai (SBG)</p>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Nasabah */}
          <section className="card p-5">
            <h2 className="font-bold text-navy-900 mb-3"><i className="bi bi-person me-2 text-navy-500" />Nasabah</h2>
            {nasabah ? (
              <>
                <div className="flex items-center justify-between bg-navy-50 rounded-xl px-4 py-3">
                  <div>
                    <div className="font-semibold text-navy-900">{nasabah.nama}</div>
                    <div className="text-xs text-slate-500 tnum">{nasabah.no_hp || "—"}</div>
                  </div>
                  <button className="text-sm text-navy-600 hover:underline" onClick={() => { setNasabah(null); setQ(""); setFotoNasabah(""); }}>Ganti</button>
                </div>

                {/* Foto nasabah — dokumentasi transaksi */}
                <div className="flex items-center gap-3 mt-3">
                  <div className="w-16 h-16 rounded-lg bg-navy-50 border border-slate-200 overflow-hidden grid place-items-center shrink-0">
                    {fotoNasabah ? <img src={fotoNasabah} alt="" className="w-full h-full object-cover" /> : <i className="bi bi-person-bounding-box text-2xl text-slate-300" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-navy-800">Foto Nasabah (dokumentasi)</div>
                    <div className="text-[11px] text-slate-400 mb-1.5">Bukti nasabah hadir saat transaksi (opsional).</div>
                    <div className="flex gap-2">
                      <button type="button" className="btn-ghost text-xs py-1.5" onClick={() => { setErr(""); setCam({ kind: "nasabah" }); }}>
                        <i className="bi bi-camera" /> Foto
                      </button>
                      <label className="btn-ghost text-xs py-1.5 cursor-pointer">
                        <input type="file" accept="image/*" capture="user" className="hidden" onChange={uploadNasabah} />
                        <i className="bi bi-upload" /> Upload
                      </label>
                      {fotoNasabah && (
                        <button type="button" className="btn-ghost text-xs py-1.5" onClick={() => setFotoNasabah("")}>
                          <i className="bi bi-trash3 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : showNew ? (
              <div className="space-y-3">
                <input className="input" placeholder="Nama lengkap" value={baru.nama} onChange={(e) => setBaru({ ...baru, nama: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <input className="input" placeholder="No. HP" value={baru.no_hp} onChange={(e) => setBaru({ ...baru, no_hp: e.target.value })} />
                  <input className="input" placeholder="No. KTP" value={baru.no_ktp} onChange={(e) => setBaru({ ...baru, no_ktp: e.target.value })} />
                </div>
                <input className="input" type="email" placeholder="Email (opsional, untuk cek via Z One)" value={baru.email} onChange={(e) => setBaru({ ...baru, email: e.target.value })} />
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={buatNasabah}>Simpan & Pilih</button>
                  <button className="btn-ghost" onClick={() => setShowNew(false)}>Batal</button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <i className="bi bi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="input pl-10" placeholder="Cari nasabah…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                {hasil.length > 0 && (
                  <ul className="mt-2 border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-auto">
                    {hasil.map((n) => (
                      <li key={n.id}>
                        <button className="w-full text-left px-4 py-2.5 hover:bg-slate-50" onClick={() => setNasabah(n)}>
                          <div className="font-medium text-navy-900">{n.nama}</div>
                          <div className="text-xs text-slate-500 tnum">{n.no_hp || "—"}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button className="mt-3 text-sm text-navy-600 hover:underline" onClick={() => setShowNew(true)}>
                  <i className="bi bi-plus-circle me-1" />Nasabah baru
                </button>
              </>
            )}
          </section>

          {/* Barang jaminan */}
          <section className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-navy-900"><i className="bi bi-box-seam me-2 text-navy-500" />Barang Jaminan</h2>
              <button className="text-sm text-navy-600 hover:underline" onClick={() => setBarang([...barang, emptyBarang()])}>
                <i className="bi bi-plus-lg me-1" />Tambah barang
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-3 -mt-1"><i className="bi bi-stars text-gold-500 me-1" />Foto barang → AI identifikasi jenis, nama & taksiran otomatis (tetap verifikasi manual).</p>
            <div className="space-y-3">
              {barang.map((b, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-3">
                  <div className="flex gap-2">
                    <select className="input max-w-[130px] capitalize" value={b.jenis} onChange={(e) => setB(i, { jenis: e.target.value })}>
                      {(jenisOpts.includes(b.jenis) ? jenisOpts : [b.jenis, ...jenisOpts]).map((j) => <option key={j} value={j} className="capitalize">{j}</option>)}
                    </select>
                    <input className="input flex-1 min-w-0" placeholder="Nama barang" value={b.nama} onChange={(e) => setB(i, { nama: e.target.value })} />
                    {barang.length > 1 && (
                      <button className="btn-ghost px-3" onClick={() => setBarang(barang.filter((_, idx) => idx !== i))}>
                        <i className="bi bi-trash3 text-red-500" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {b.jenis === "emas" && (
                      <>
                        <input className="input" placeholder="Berat (gr)" value={b.berat_gram} onChange={(e) => setEmasField(i, { berat_gram: e.target.value.replace(/[^\d.]/g, "") })} />
                        <input className="input" placeholder="Kadar (mis. 22K)" value={b.kadar} onChange={(e) => setEmasField(i, { kadar: e.target.value })} />
                      </>
                    )}
                    <input className={`input tnum ${b.jenis === "emas" ? "" : "col-span-3"}`} inputMode="numeric"
                      placeholder="Taksiran (Rp)" value={b.taksiran}
                      onChange={(e) => setB(i, { taksiran: e.target.value.replace(/\D/g, "") })} />
                  </div>
                  {b.jenis === "emas" && (
                    <p className="text-[11px] text-slate-400 -mt-1">
                      {hargaEmas > 0
                        ? <>Taksiran otomatis: berat × kadar × {rupiah(hargaEmas)}/gr</>
                        : <>Set harga emas/gram di <a href="/pengaturan" className="text-gold-600 underline">Pengaturan</a> untuk taksir otomatis.</>}
                    </p>
                  )}

                  {/* Galeri foto (min 4) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-slate-500">Foto jaminan ({b.fotos.length}/{MIN_FOTO} min)</span>
                      {b.fotos.length > 0 && (
                        <button type="button" className="text-[11px] text-navy-600 hover:underline" onClick={() => taksir(i, b.fotos)}>
                          <i className="bi bi-stars me-1" />Taksir ulang
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {b.fotos.map((f, fi) => (
                        <div key={fi} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                          <img src={f} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => removeFoto(i, fi)}
                            className="absolute top-0 right-0 bg-black/60 text-white w-5 h-5 grid place-items-center rounded-bl-lg"><i className="bi bi-x text-xs" /></button>
                        </div>
                      ))}
                      {b.fotos.length < 8 && (
                        <>
                          <button type="button" onClick={() => { setErr(""); setCam({ kind: "barang", idx: i }); }}
                            className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 grid place-items-center text-slate-400 hover:border-navy-400 hover:text-navy-500"><i className="bi bi-camera text-lg" /></button>
                          <label className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 grid place-items-center text-slate-400 hover:border-navy-400 hover:text-navy-500 cursor-pointer">
                            <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => uploadJaminan(i, e)} />
                            <i className="bi bi-upload text-lg" />
                          </label>
                        </>
                      )}
                    </div>
                    {b.fotos.length < MIN_FOTO && (
                      <p className="text-[11px] text-amber-600 mt-1"><i className="bi bi-exclamation-circle me-1" />Minimal {MIN_FOTO} foto (kurang {MIN_FOTO - b.fotos.length}).</p>
                    )}
                  </div>

                  {(busyIdx === i || notes[i]) && (
                    <div className="text-xs flex items-center gap-2">
                      {busyIdx === i ? (
                        <span className="flex items-center gap-2 text-navy-600"><span className="w-3.5 h-3.5 border-2 border-navy-300 border-t-navy-700 rounded-full animate-spin" /> Mengidentifikasi & menaksir dengan AI…</span>
                      ) : (
                        <span className="text-amber-600"><i className="bi bi-info-circle me-1" />{notes[i]}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500">Total Taksiran</span>
              <span className="font-bold text-navy-900 tnum">{rupiah(totalTaksiran)}</span>
            </div>
          </section>
        </div>

        {/* Parameter pinjaman */}
        <div className="space-y-5">
          <section className="card p-5 space-y-3 lg:sticky lg:top-6">
            <h2 className="font-bold text-navy-900"><i className="bi bi-cash-coin me-2 text-navy-500" />Pinjaman</h2>

            <div>
              <div className="flex items-center justify-between">
                <label className="label mb-0">Uang Pinjaman *</label>
                {saranPlafon > 0 && (
                  <button className="text-[11px] text-gold-600 font-semibold" onClick={() => updatePokok(String(saranPlafon))}>
                    Saran {rupiah(saranPlafon)}
                  </button>
                )}
              </div>
              <input className="input tnum mt-1" inputMode="numeric" placeholder="0"
                value={pokok} onChange={(e) => updatePokok(e.target.value.replace(/\D/g, ""))} />
              <p className="text-[11px] text-slate-400 mt-1">Plafon = {plafonPersen}% taksiran</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Bunga %/periode</label>
                <input className="input tnum" inputMode="decimal" value={bunga} onChange={(e) => setBunga(e.target.value)} />
              </div>
              <div>
                <label className="label">Periode (hari)</label>
                <input className="input tnum" inputMode="numeric" value={periodeHari} onChange={(e) => setPeriodeHari(Number(e.target.value) || 15)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tgl Gadai</label>
                <input type="date" className="input" value={tglGadai} onChange={(e) => setTglGadai(e.target.value)} />
              </div>
              <div>
                <label className="label">Tempo (hari)</label>
                <input className="input tnum" inputMode="numeric" value={tempoHari} onChange={(e) => setTempoHari(Number(e.target.value) || 30)} />
              </div>
            </div>

            <div>
              <label className="label">Biaya Admin</label>
              <input className="input tnum" inputMode="numeric" placeholder="0" value={biayaAdmin} onChange={(e) => setBiayaAdmin(e.target.value.replace(/\D/g, ""))} />
            </div>

            <div className="bg-navy-50 rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Jatuh tempo</span><span className="font-medium text-navy-900 tnum">{tanggalID(jatuhTempo)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Diterima nasabah</span><span className="font-bold text-emerald-700 tnum">{rupiah(Math.max(0, Number(pokok || 0) - Number(biayaAdmin || 0)))}</span></div>
            </div>

            {err && <p className="text-sm text-red-600">{err}</p>}
            <button className="btn-gold w-full" onClick={submit} disabled={saving}>
              {saving ? "Menyimpan…" : <><i className="bi bi-check2-circle" /> Buat Gadai</>}
            </button>
          </section>
        </div>
      </div>
      {/* Modal kamera jaminan */}
      {cam && (
        <div className="fixed inset-0 z-[60] bg-black/85 grid place-items-center p-4">
          <div className="w-full max-w-md bg-navy-950 rounded-2xl overflow-hidden">
            <div className="relative bg-black aspect-[4/3]">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {cam.kind === "nasabah" ? (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-52 border-2 border-white/70 rounded-[50%] pointer-events-none" />
              ) : (
                <div className="absolute inset-6 border-2 border-white/70 rounded-lg pointer-events-none" />
              )}
              <div className="absolute bottom-2 inset-x-0 text-center text-white/80 text-xs">
                {cam.kind === "nasabah"
                  ? "Posisikan wajah nasabah di dalam oval"
                  : `${barang[cam.idx]?.fotos.length || 0} foto diambil · posisikan barang di dalam kotak`}
              </div>
            </div>
            <div className="flex gap-2 p-3">
              <button type="button" className="btn-ghost flex-1" onClick={() => setCam(null)}>{cam.kind === "nasabah" ? "Tutup" : "Selesai"}</button>
              <button type="button" className="btn-gold flex-1" onClick={capture}><i className="bi bi-camera" /> Ambil Foto</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
