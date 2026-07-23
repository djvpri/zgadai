"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import AppShell from "@/components/AppShell";
import { tanggalID } from "@/lib/gadai";

interface Nasabah {
  id: number; nama: string; no_ktp: string | null; no_hp: string | null;
  alamat: string | null; created_at: string; gadai_aktif: number;
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

export default function NasabahPage() {
  const [list, setList] = useState<Nasabah[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nama: "", no_ktp: "", no_hp: "", alamat: "", catatan: "" });
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [err, setErr] = useState("");
  const [camOpen, setCamOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Hidupkan/matikan webcam mengikuti camOpen.
  useEffect(() => {
    if (!camOpen) return;
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
      })
      .catch(() => { setErr("Tidak bisa mengakses kamera. Izinkan akses atau pakai Upload."); setCamOpen(false); });
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [camOpen]);

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

  function ambilFotoWebcam() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    const data = canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
    setCamOpen(false); // effect cleanup menghentikan stream
    runScan(data, "image/jpeg");
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
      setForm({ nama: "", no_ktp: "", no_hp: "", alamat: "", catatan: "" });
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
              <li key={n.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-9 h-9 rounded-full bg-navy-100 text-navy-700 grid place-items-center font-semibold shrink-0">
                  {n.nama.charAt(0).toUpperCase()}
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
                  onClick={() => { setErr(""); setScanMsg(""); setCamOpen(true); }} disabled={scanning}>
                  <i className="bi bi-camera-video" /> Webcam
                </button>
              </div>
            </div>
            {scanMsg && <p className="text-xs text-emerald-600 -mt-1"><i className="bi bi-check-circle me-1" />{scanMsg}</p>}

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
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Batal</button>
              <button className="btn-primary" disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal webcam */}
      {camOpen && (
        <div className="fixed inset-0 z-[60] bg-black/85 grid place-items-center p-4">
          <div className="w-full max-w-md bg-navy-950 rounded-2xl overflow-hidden">
            <div className="relative bg-black aspect-[4/3]">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-x-6 inset-y-10 border-2 border-white/70 rounded-lg pointer-events-none" />
              <div className="absolute bottom-2 inset-x-0 text-center text-white/80 text-xs">Posisikan KTP di dalam kotak</div>
            </div>
            <div className="flex gap-2 p-3">
              <button type="button" className="btn-ghost flex-1" onClick={() => setCamOpen(false)}>Tutup</button>
              <button type="button" className="btn-gold flex-1" onClick={ambilFotoWebcam}><i className="bi bi-camera" /> Ambil Foto</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
