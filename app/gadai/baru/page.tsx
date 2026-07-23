"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { rupiah, plafon, tambahHari, tanggalID, taksiranEmas } from "@/lib/gadai";
import { compressImage, frameToDataUrl, stripDataUrl } from "@/lib/img";

interface Nasabah { id: number; nama: string; no_hp: string | null }
interface Barang { jenis: string; nama: string; berat_gram: string; kadar: string; taksiran: string; foto: string }

const JENIS = ["emas", "elektronik", "kendaraan", "lainnya"];
const emptyBarang = (): Barang => ({ jenis: "emas", nama: "", berat_gram: "", kadar: "", taksiran: "", foto: "" });

export default function GadaiBaruPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState<Nasabah[]>([]);
  const [nasabah, setNasabah] = useState<Nasabah | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [baru, setBaru] = useState({ nama: "", no_hp: "", no_ktp: "" });

  const [barang, setBarang] = useState<Barang[]>([emptyBarang()]);
  const [tglGadai, setTglGadai] = useState(new Date().toISOString().slice(0, 10));
  const [tempoHari, setTempoHari] = useState(30);
  const [periodeHari, setPeriodeHari] = useState(15);
  const [bunga, setBunga] = useState("2");
  const [biayaAdmin, setBiayaAdmin] = useState("0");
  const [pokok, setPokok] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [camIdx, setCamIdx] = useState<number | null>(null);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [hargaEmas, setHargaEmas] = useState(0);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      setHargaEmas(Number(d.settings?.harga_emas_per_gram || 0));
    }).catch(() => {});
  }, []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Webcam untuk foto barang jaminan (kamera belakang).
  useEffect(() => {
    if (camIdx === null) return;
    let active = true;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
      })
      .catch(() => { setErr("Tidak bisa mengakses kamera. Izinkan akses atau pakai Upload."); setCamIdx(null); });
    return () => { active = false; streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  }, [camIdx]);

  useEffect(() => {
    if (nasabah) return;
    const t = setTimeout(() => {
      fetch(`/api/nasabah?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((d) => setHasil(d.nasabah || []));
    }, 200);
    return () => clearTimeout(t);
  }, [q, nasabah]);

  const totalTaksiran = barang.reduce((s, b) => s + Number(b.taksiran || 0), 0);
  const saranPlafon = plafon(totalTaksiran, 90);
  const jatuhTempo = tambahHari(tglGadai, tempoHari);

  function setB(i: number, patch: Partial<Barang>) {
    setBarang((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
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

  async function taksir(idx: number, dataUrl: string) {
    setBusyIdx(idx);
    setNotes((n) => ({ ...n, [idx]: "" }));
    try {
      const r = await fetch("/api/jaminan/taksir", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: stripDataUrl(dataUrl), mimeType: "image/jpeg" }),
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

  function captureJaminan() {
    const v = videoRef.current;
    if (!v || !v.videoWidth || camIdx === null) return;
    const idx = camIdx;
    const dataUrl = frameToDataUrl(v, 640, 0.8);
    setCamIdx(null);
    setB(idx, { foto: dataUrl });
    taksir(idx, dataUrl);
  }

  async function uploadJaminan(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await compressImage(file, 640, 0.8);
    setB(idx, { foto: dataUrl });
    taksir(idx, dataUrl);
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
    if (Number(pokok) <= 0) { setErr("Isi uang pinjaman"); return; }
    setSaving(true);
    const r = await fetch("/api/gadai", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nasabah_id: nasabah.id, tgl_gadai: tglGadai, tempo_hari: tempoHari,
        periode_hari: periodeHari, bunga_persen: Number(bunga), biaya_admin: Number(biayaAdmin),
        pokok: Number(pokok),
        barang: validBarang.map((b) => ({
          jenis: b.jenis, nama: b.nama, berat_gram: b.berat_gram || null,
          kadar: b.kadar || null, taksiran: Number(b.taksiran), foto: b.foto || null,
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
              <div className="flex items-center justify-between bg-navy-50 rounded-xl px-4 py-3">
                <div>
                  <div className="font-semibold text-navy-900">{nasabah.nama}</div>
                  <div className="text-xs text-slate-500 tnum">{nasabah.no_hp || "—"}</div>
                </div>
                <button className="text-sm text-navy-600 hover:underline" onClick={() => { setNasabah(null); setQ(""); }}>Ganti</button>
              </div>
            ) : showNew ? (
              <div className="space-y-3">
                <input className="input" placeholder="Nama lengkap" value={baru.nama} onChange={(e) => setBaru({ ...baru, nama: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <input className="input" placeholder="No. HP" value={baru.no_hp} onChange={(e) => setBaru({ ...baru, no_hp: e.target.value })} />
                  <input className="input" placeholder="No. KTP" value={baru.no_ktp} onChange={(e) => setBaru({ ...baru, no_ktp: e.target.value })} />
                </div>
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
                <div key={i} className="border border-slate-200 rounded-xl p-3">
                  <div className="flex gap-3">
                    {/* Foto jaminan + tombol */}
                    <div className="shrink-0 w-16">
                      <div className="w-16 h-16 rounded-lg bg-navy-50 border border-slate-200 overflow-hidden grid place-items-center">
                        {b.foto ? <img src={b.foto} alt="" className="w-full h-full object-cover" /> : <i className="bi bi-image text-slate-300 text-xl" />}
                      </div>
                      <div className="flex gap-1 mt-1">
                        <button type="button" title="Kamera" onClick={() => { setErr(""); setCamIdx(i); }}
                          className="flex-1 text-[11px] py-1 rounded bg-slate-100 hover:bg-slate-200 text-navy-700"><i className="bi bi-camera" /></button>
                        <label title="Upload" className="flex-1 text-[11px] py-1 rounded bg-slate-100 hover:bg-slate-200 text-navy-700 text-center cursor-pointer">
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => uploadJaminan(i, e)} />
                          <i className="bi bi-upload" />
                        </label>
                      </div>
                    </div>

                    {/* Field */}
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-2 mb-2">
                        <select className="input max-w-[130px] capitalize" value={b.jenis} onChange={(e) => setB(i, { jenis: e.target.value })}>
                          {JENIS.map((j) => <option key={j} value={j} className="capitalize">{j}</option>)}
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
                        <p className="text-[11px] text-slate-400 mt-1.5">
                          {hargaEmas > 0
                            ? <>Taksiran otomatis: berat × kadar × {rupiah(hargaEmas)}/gr</>
                            : <>Set harga emas/gram di <a href="/pengaturan" className="text-gold-600 underline">Pengaturan</a> untuk taksir otomatis.</>}
                        </p>
                      )}
                    </div>
                  </div>

                  {(busyIdx === i || notes[i]) && (
                    <div className="mt-2 text-xs flex items-center gap-2">
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
                  <button className="text-[11px] text-gold-600 font-semibold" onClick={() => setPokok(String(saranPlafon))}>
                    Saran {rupiah(saranPlafon)}
                  </button>
                )}
              </div>
              <input className="input tnum mt-1" inputMode="numeric" placeholder="0"
                value={pokok} onChange={(e) => setPokok(e.target.value.replace(/\D/g, ""))} />
              <p className="text-[11px] text-slate-400 mt-1">Plafon = 90% taksiran</p>
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
      {camIdx !== null && (
        <div className="fixed inset-0 z-[60] bg-black/85 grid place-items-center p-4">
          <div className="w-full max-w-md bg-navy-950 rounded-2xl overflow-hidden">
            <div className="relative bg-black aspect-[4/3]">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-6 border-2 border-white/70 rounded-lg pointer-events-none" />
              <div className="absolute bottom-2 inset-x-0 text-center text-white/80 text-xs">Posisikan barang jaminan di dalam kotak</div>
            </div>
            <div className="flex gap-2 p-3">
              <button type="button" className="btn-ghost flex-1" onClick={() => setCamIdx(null)}>Tutup</button>
              <button type="button" className="btn-gold flex-1" onClick={captureJaminan}><i className="bi bi-camera" /> Ambil & Taksir</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
