"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { tanggalID } from "@/lib/gadai";

interface Nasabah {
  id: number; nama: string; no_ktp: string | null; no_hp: string | null;
  alamat: string | null; created_at: string; gadai_aktif: number; foto: string | null;
}

// Baca file gambar -> base64 (tanpa prefix data URI) + mime.
function toBase64(file: File): Promise<{ data: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ data: (r.result as string).split(",")[1], mime: file.type });
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Kompres gambar -> data URL JPEG kecil (untuk foto wajah nasabah).
function compressImage(file: File, max = 320, q = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d")?.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", q));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Ambil frame video -> data URL JPEG (terkompres jika untuk wajah).
function frameToDataUrl(v: HTMLVideoElement, max?: number, q = 0.85): string {
  let w = v.videoWidth, h = v.videoHeight;
  if (max) { const s = Math.min(1, max / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s); }
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")?.drawImage(v, 0, 0, w, h);
  return c.toDataURL("image/jpeg", q);
}

export default function NasabahPage() {
  const [list, setList] = useState<Nasabah[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nama: "", no_ktp: "", no_hp: "", alamat: "", catatan: "", foto: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [err, setErr] = useState("");
  const [camMode, setCamMode] = useState<null | "ktp" | "wajah">(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Hidupkan/matikan webcam mengikuti camMode (ktp=kamera belakang, wajah=depan).
  useEffect(() => {
    if (!camMode) return;
    let active = true;
    const facingMode = camMode === "wajah" ? "user" : "environment";
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facingMode } }, audio: false })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
      })
      .catch(() => { setErr("Tidak bisa mengakses kamera. Izinkan akses atau pakai Upload."); setCamMode(null); });
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [camMode]);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/nasabah?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => setList(d.nasabah || []))
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function runScan(data: string, mime: string) {
    setScanning(true); setErr(""); setScanMsg("");
    try {
      const r = await fetch("/api/ktp/scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: data, mimeType: mime }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Gagal membaca KTP"); return; }
      setForm((f) => ({
        ...f,
        nama: d.nama || f.nama,
        no_ktp: d.nik || f.no_ktp,
        alamat: d.alamat || f.alamat,
        catatan: [d.ttl && `TTL: ${d.ttl}`, d.jenis_kelamin && `JK: ${d.jenis_kelamin}`].filter(Boolean).join(" · ") || f.catatan,
      }));
      setScanMsg("Data KTP terbaca — periksa & lengkapi bila perlu.");
    } catch {
      setErr("Gagal memproses gambar");
    } finally {
      setScanning(false);
    }
  }

  async function scanKtp(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) { setErr("Foto KTP maksimal 6MB"); return; }
    const { data, mime } = await toBase64(file);
    runScan(data, mime);
  }

  function ambilFoto() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    if (camMode === "wajah") {
      setForm((f) => ({ ...f, foto: frameToDataUrl(v, 320, 0.7) }));
      setCamMode(null);
    } else {
      const data = frameToDataUrl(v, undefined, 0.9).split(",")[1];
      setCamMode(null); // effect cleanup menghentikan stream
      runScan(data, "image/jpeg");
    }
  }

  async function uploadWajah(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const foto = await compressImage(file, 320, 0.7);
    setForm((f) => ({ ...f, foto }));
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nama.trim()) { setErr("Nama wajib diisi"); return; }
    setSaving(true); setErr("");
    const r = await fetch("/api/nasabah", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    setSaving(false);
    if (r.ok) {
      setShowForm(false);
      setForm({ nama: "", no_ktp: "", no_hp: "", alamat: "", catatan: "", foto: "", email: "" });
      setScanMsg("");
      load();
    } else {
      const d = await r.json();
      setErr(d.error || "Gagal menyimpan");
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Nasabah</h1>
          <p className="text-slate-500 text-sm">{list.length} nasabah terdaftar</p>
        </div>
        <button onClick={() => { setShowForm(true); setErr(""); setScanMsg(""); }} className="btn-primary"><i className="bi bi-person-plus" /> Tambah</button>
      </div>

      <div className="relative mb-4">
        <i className="bi bi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pl-10" placeholder="Cari nama, no. HP, atau KTP…"
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Memuat…</div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Belum ada nasabah.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((n) => (
              <li key={n.id}>
                <Link href={`/nasabah/${n.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
                  <div className="w-9 h-9 rounded-full bg-navy-100 text-navy-700 grid place-items-center font-semibold shrink-0 overflow-hidden">
                    {n.foto ? <img src={n.foto} alt="" className="w-full h-full object-cover" /> : n.nama.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-navy-900 truncate">{n.nama}</div>
                    <div className="text-xs text-slate-500 truncate tnum">
                      {n.no_hp || "—"}{n.no_ktp ? ` · KTP ${n.no_ktp}` : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {n.gadai_aktif > 0 && (
                      <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">{n.gadai_aktif} aktif</span>
                    )}
                    <div className="text-[11px] text-slate-400 mt-0.5">{tanggalID(n.created_at)}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 grid place-items-center p-4" onClick={() => setShowForm(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={simpan}
            className="card p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-navy-900">Tambah Nasabah</h2>

            {/* Scan KTP → auto-isi (Gemini): upload/foto atau webcam */}
            <div className="border-2 border-dashed border-navy-200 rounded-xl p-3 bg-navy-50/60">
              <div className="flex items-center gap-3">
                <i className="bi bi-person-vcard text-navy-600 text-xl" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-navy-800">{scanning ? "Membaca KTP…" : "Scan KTP → auto-isi"}</div>
                  <div className="text-[11px] text-slate-500">Nama, NIK & alamat dari foto KTP</div>
                </div>
                {scanning && <span className="w-4 h-4 border-2 border-navy-300 border-t-navy-700 rounded-full animate-spin" />}
              </div>
              <div className="flex gap-2 mt-3">
                <label className="btn-ghost flex-1 cursor-pointer text-xs py-2">
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={scanKtp} disabled={scanning} />
                  <i className="bi bi-upload" /> Upload / Foto
                </label>
                <button type="button" className="btn-ghost flex-1 text-xs py-2"
                  onClick={() => { setErr(""); setScanMsg(""); setCamMode("ktp"); }} disabled={scanning}>
                  <i className="bi bi-camera-video" /> Webcam
                </button>
              </div>
            </div>
            {scanMsg && <p className="text-xs text-emerald-600 -mt-1"><i className="bi bi-check-circle me-1" />{scanMsg}</p>}

            {/* Foto wajah nasabah */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-navy-50 border border-slate-200 overflow-hidden grid place-items-center shrink-0">
                {form.foto ? <img src={form.foto} alt="Foto nasabah" className="w-full h-full object-cover" />
                  : <i className="bi bi-person text-3xl text-slate-300" />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-navy-800">Foto Wajah Nasabah</div>
                <div className="flex gap-2 mt-2">
                  <button type="button" className="btn-ghost text-xs py-1.5" onClick={() => { setErr(""); setCamMode("wajah"); }}>
                    <i className="bi bi-camera" /> Foto
                  </button>
                  <label className="btn-ghost text-xs py-1.5 cursor-pointer">
                    <input type="file" accept="image/*" capture="user" className="hidden" onChange={uploadWajah} />
                    <i className="bi bi-upload" /> Upload
                  </label>
                  {form.foto && (
                    <button type="button" className="btn-ghost text-xs py-1.5" onClick={() => setForm((f) => ({ ...f, foto: "" }))}>
                      <i className="bi bi-trash3 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="label">Nama Lengkap *</label>
              <input className="input" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">No. HP</label>
                <input className="input" value={form.no_hp} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} />
              </div>
              <div>
                <label className="label">No. KTP</label>
                <input className="input" value={form.no_ktp} onChange={(e) => setForm({ ...form, no_ktp: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Alamat</label>
              <input className="input" value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} />
            </div>
            <div>
              <label className="label">Email <span className="font-normal text-slate-400">(agar nasabah bisa cek pinjaman via Z One)</span></label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@nasabah.com" />
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Batal</button>
              <button className="btn-primary" disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal webcam (KTP / wajah) */}
      {camMode && (
        <div className="fixed inset-0 z-[60] bg-black/85 grid place-items-center p-4">
          <div className="w-full max-w-md bg-navy-950 rounded-2xl overflow-hidden">
            <div className="relative bg-black aspect-[4/3]">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {camMode === "wajah" ? (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-52 border-2 border-white/70 rounded-[50%] pointer-events-none" />
              ) : (
                <div className="absolute inset-x-6 inset-y-10 border-2 border-white/70 rounded-lg pointer-events-none" />
              )}
              <div className="absolute bottom-2 inset-x-0 text-center text-white/80 text-xs">
                {camMode === "wajah" ? "Posisikan wajah di dalam oval" : "Posisikan KTP di dalam kotak"}
              </div>
            </div>
            <div className="flex gap-2 p-3">
              <button type="button" className="btn-ghost flex-1" onClick={() => setCamMode(null)}>Tutup</button>
              <button type="button" className="btn-gold flex-1" onClick={ambilFoto}><i className="bi bi-camera" /> Ambil Foto</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
