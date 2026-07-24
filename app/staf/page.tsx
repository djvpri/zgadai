"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";

export default function StafPage() {
  const router = useRouter();
  const [staf, setStaf] = useState<any[]>([]);
  const [meId, setMeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  function load() {
    fetch("/api/staf").then(async (r) => {
      if (r.status === 403) { router.replace("/dashboard"); return; }
      const d = await r.json();
      setStaf((d.staf || []).map((u: any) => ({ ...u, fee_persen: Number(u.fee_persen), modal: Number(u.modal || 0), bagi_hasil_persen: Number(u.bagi_hasil_persen || 0) })));
      setMeId(d.me ?? null);
    }).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  function setRow(id: number, patch: any) {
    setStaf((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  async function simpan(u: any) {
    setSavingId(u.id); setMsg("");
    const r = await fetch("/api/staf", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, role: u.role, fee_persen: u.fee_persen, modal: u.modal, bagi_hasil_persen: u.bagi_hasil_persen }),
    });
    setSavingId(null);
    if (r.ok) setMsg(`Tersimpan: ${u.nama}`);
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-navy-900 mb-1">Kelola Staf</h1>
      <p className="text-slate-500 text-sm mb-5">Atur peran & fee mitra. Staf ditambahkan lewat Z One /manage.</p>

      {msg && <p className="text-sm text-emerald-600 mb-3"><i className="bi bi-check-circle me-1" />{msg}</p>}

      {loading ? (
        <div className="card p-8 text-center text-slate-400 text-sm">Memuat…</div>
      ) : (
        <div className="space-y-3">
          {staf.map((u) => (
            <div key={u.id} className="card p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="font-medium text-navy-900 truncate">{u.nama} {u.id === meId && <span className="text-[11px] text-slate-400">(Anda)</span>}</div>
                  <div className="text-xs text-slate-500 truncate">{u.email}</div>
                </div>
                {!u.is_active && <span className="badge bg-slate-100 text-slate-500 border border-slate-200">Nonaktif</span>}
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="label">Peran</label>
                  <select className="input" value={u.role} onChange={(e) => setRow(u.id, { role: e.target.value })}>
                    <option value="kasir">Marketing</option>
                    <option value="mitra">Mitra</option>
                    <option value="investor">Investor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {u.role === "mitra" && (
                  <div>
                    <label className="label">Fee % (dari bunga)</label>
                    <input className="input tnum max-w-[120px]" inputMode="decimal" value={u.fee_persen}
                      onChange={(e) => setRow(u.id, { fee_persen: e.target.value.replace(/[^\d.]/g, "") })} />
                  </div>
                )}
                {u.role === "investor" && (
                  <>
                    <div>
                      <label className="label">Modal (Rp)</label>
                      <input className="input tnum max-w-[160px]" inputMode="numeric" value={u.modal}
                        onChange={(e) => setRow(u.id, { modal: e.target.value.replace(/\D/g, "") })} />
                    </div>
                    <div>
                      <label className="label">Bagi hasil % (dari laba)</label>
                      <input className="input tnum max-w-[120px]" inputMode="decimal" value={u.bagi_hasil_persen}
                        onChange={(e) => setRow(u.id, { bagi_hasil_persen: e.target.value.replace(/[^\d.]/g, "") })} />
                    </div>
                  </>
                )}
                <button className="btn-primary" onClick={() => simpan(u)} disabled={savingId === u.id}>
                  {savingId === u.id ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
              {u.role === "mitra" && (
                <p className="text-[11px] text-slate-400 mt-2">Mitra dapat {Number(u.fee_persen) || 0}% dari bunga yang terkumpul dari gadai yang dia buat.</p>
              )}
              {u.role === "investor" && (
                <p className="text-[11px] text-slate-400 mt-2">Investor pantau bisnis (read-only) & dapat {Number(u.bagi_hasil_persen) || 0}% bagi hasil dari laba.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
