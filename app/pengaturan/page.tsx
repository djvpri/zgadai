"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { rupiah } from "@/lib/gadai";

export default function PengaturanPage() {
  const [harga, setHarga] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      setHarga(d.settings?.harga_emas_per_gram ? String(d.settings.harga_emas_per_gram) : "");
    }).finally(() => setLoading(false));
  }, []);

  async function simpan() {
    setSaving(true); setMsg(""); setErr("");
    const r = await fetch("/api/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ harga_emas_per_gram: Number(harga || 0) }),
    });
    setSaving(false);
    const d = await r.json();
    if (r.ok) setMsg("Pengaturan disimpan.");
    else setErr(d.error || "Gagal menyimpan");
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-navy-900 mb-1">Pengaturan</h1>
      <p className="text-slate-500 text-sm mb-6">Konfigurasi usaha gadai</p>

      <div className="card p-5 max-w-lg space-y-4">
        <h2 className="font-bold text-navy-900"><i className="bi bi-coin me-2 text-gold-500" />Harga Taksir Emas</h2>
        <div>
          <label className="label">Harga per gram (emas murni / 24K)</label>
          <input className="input tnum" inputMode="numeric" placeholder="0" disabled={loading}
            value={harga} onChange={(e) => setHarga(e.target.value.replace(/\D/g, ""))} />
          <p className="text-[11px] text-slate-400 mt-1.5">
            Dipakai menghitung taksiran emas: <b>berat × kadar × harga</b>.
            Contoh 22K 5gr = 5 × 0,917 × {rupiah(harga || 0)} = {rupiah(5 * 0.9167 * Number(harga || 0))}.
          </p>
        </div>
        {msg && <p className="text-sm text-emerald-600"><i className="bi bi-check-circle me-1" />{msg}</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary" onClick={simpan} disabled={saving || loading}>
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </AppShell>
  );
}
