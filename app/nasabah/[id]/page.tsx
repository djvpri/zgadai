"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { rupiah, tanggalID, statusJatuhTempo, STATUS_BADGE } from "@/lib/gadai";

export default function NasabahDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ nama: "", no_ktp: "", no_hp: "", alamat: "", catatan: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [kap, setKap] = useState(false);
  const [kapForm, setKapForm] = useState({ is_mitra: false, fee_persen: "", is_investor: false, modal: "", bagi_hasil_persen: "" });
  const [savingKap, setSavingKap] = useState(false);
  const [kapMsg, setKapMsg] = useState("");

  const load = useCallback(() => {
    fetch(`/api/nasabah/${id}`).then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  function openEdit() {
    const n = data.nasabah;
    setForm({ nama: n.nama || "", no_ktp: n.no_ktp || "", no_hp: n.no_hp || "", alamat: n.alamat || "", catatan: n.catatan || "", email: n.email || "" });
    setEdit(true);
  }
  async function simpan() {
    setSaving(true);
    const r = await fetch(`/api/nasabah/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    setSaving(false);
    if (r.ok) { setEdit(false); load(); }
  }

  function openKap() {
    const k = data.kapabilitas || {};
    setKapForm({
      is_mitra: !!k.is_mitra, fee_persen: String(k.fee_persen || ""),
      is_investor: !!k.is_investor, modal: String(k.modal || ""), bagi_hasil_persen: String(k.bagi_hasil_persen || ""),
    });
    setKapMsg("");
    setKap(true);
  }
  async function simpanKap() {
    setSavingKap(true); setKapMsg("");
    const r = await fetch(`/api/nasabah/${id}/kapabilitas`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_mitra: kapForm.is_mitra, fee_persen: Number(kapForm.fee_persen) || 0,
        is_investor: kapForm.is_investor, modal: Number(kapForm.modal) || 0, bagi_hasil_persen: Number(kapForm.bagi_hasil_persen) || 0,
      }),
    });
    const d = await r.json().catch(() => ({}));
    setSavingKap(false);
    if (r.ok) { setKap(false); load(); }
    else setKapMsg(d.error || "Gagal menyimpan");
  }

  if (loading) return <AppShell><div className="p-8 text-center text-slate-400">Memuat…</div></AppShell>;
  if (!data?.nasabah) return <AppShell><div className="p-8 text-center text-slate-400">Nasabah tidak ditemukan.</div></AppShell>;

  const n = data.nasabah;
  const gadai = data.gadai || [];
  const kapt = data.kapabilitas || {};
  const aktif = gadai.filter((g: any) => g.status === "aktif");
  const uangBeredar = aktif.reduce((s: number, g: any) => s + Number(g.pokok_sisa || 0), 0);

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-5">
        <Link href="/nasabah" className="btn-ghost px-3"><i className="bi bi-arrow-left" /></Link>
        <h1 className="text-xl font-bold text-navy-900 flex-1">Detail Nasabah</h1>
        <button className="btn-ghost" onClick={openEdit}><i className="bi bi-pencil" /> Edit</button>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Profil */}
        <section className="card p-5 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-navy-50 border border-slate-200 overflow-hidden grid place-items-center mb-3">
              {n.foto ? <img src={n.foto} alt="" className="w-full h-full object-cover" /> : <i className="bi bi-person text-4xl text-slate-300" />}
            </div>
            <div className="text-lg font-bold text-navy-900">{n.nama}</div>
            <div className="text-sm text-slate-500 tnum">{n.no_hp || "—"}</div>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <Info k="No. KTP" v={n.no_ktp || "-"} />
            <Info k="Email" v={n.email || "-"} />
            <Info k="Alamat" v={n.alamat || "-"} />
            {n.catatan && <Info k="Catatan" v={n.catatan} />}
            <Info k="Terdaftar" v={tanggalID(n.created_at)} />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-navy-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-navy-900">{aktif.length}</div>
              <div className="text-[11px] text-slate-500">Gadai Aktif</div>
            </div>
            <div className="bg-navy-50 rounded-xl p-3 text-center">
              <div className="text-sm font-bold text-navy-900 tnum">{rupiah(uangBeredar)}</div>
              <div className="text-[11px] text-slate-500">Uang Beredar</div>
            </div>
          </div>

          {/* Kapabilitas (admin) — jadikan nasabah ini Mitra/Investor */}
          {data.admin && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Peran di Usaha</span>
                <button className="text-xs font-semibold text-navy-600 hover:underline" onClick={openKap}>
                  <i className="bi bi-sliders me-1" />Atur
                </button>
              </div>
              {kapt.is_mitra || kapt.is_investor ? (
                <div className="flex flex-wrap gap-1.5">
                  {kapt.is_mitra && <span className="badge bg-amber-50 text-amber-700 border border-amber-200"><i className="bi bi-percent" />Mitra {kapt.fee_persen}%</span>}
                  {kapt.is_investor && <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200"><i className="bi bi-graph-up-arrow" />Investor {kapt.bagi_hasil_persen}%</span>}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Hanya nasabah. Klik <b>Atur</b> untuk jadikan Mitra/Investor.</p>
              )}
            </div>
          )}
        </section>

        {/* Riwayat gadai */}
        <section className="card lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-bold text-navy-900"><i className="bi bi-safe2 me-2 text-navy-500" />Riwayat Gadai</h2>
            <Link href="/gadai/baru" className="text-sm text-navy-600 hover:underline"><i className="bi bi-plus-lg" /> Gadai baru</Link>
          </div>
          {gadai.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Belum ada transaksi gadai.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {gadai.map((g: any) => {
                const badge = g.status === "aktif"
                  ? STATUS_BADGE[statusJatuhTempo(g.tgl_jatuh_tempo)] || STATUS_BADGE.aktif
                  : STATUS_BADGE[g.status];
                return (
                  <li key={g.id}>
                    <Link href={`/transaksi/${g.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-navy-900 tnum">{g.no_sbg}</div>
                        <div className="text-xs text-slate-500 tnum">{tanggalID(g.tgl_gadai)} · JT {tanggalID(g.tgl_jatuh_tempo)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold text-navy-900 tnum">{rupiah(g.pokok_sisa)}</div>
                        <span className={`badge ${badge?.cls} mt-0.5`}><i className={`bi ${badge?.icon}`} />{badge?.label}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Kapabilitas modal */}
      {kap && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 grid place-items-center p-4" onClick={() => setKap(false)}>
          <div className="card p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-bold text-navy-900">Peran {n.nama}</h2>
              <p className="text-xs text-slate-500">Satu orang bisa jadi nasabah, mitra, dan investor sekaligus. Ia login lewat email <b>{n.email || "—"}</b> dan melihat portal pribadi <b>/saya</b>.</p>
            </div>

            {!kapt.has_email && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <i className="bi bi-exclamation-triangle me-1" />Nasabah belum punya email. Isi email dulu lewat <b>Edit</b> agar bisa dijadikan mitra/investor.
              </p>
            )}

            {/* Mitra */}
            <div className="rounded-xl border border-slate-200 p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-navy-700" checked={kapForm.is_mitra}
                  onChange={(e) => setKapForm({ ...kapForm, is_mitra: e.target.checked })} disabled={!kapt.has_email} />
                <span className="text-sm font-semibold text-navy-900">Mitra</span>
                <span className="text-xs text-slate-400">— fee % dari bunga gadai yang ia bawa</span>
              </label>
              {kapForm.is_mitra && (
                <div className="mt-2">
                  <label className="label">Fee % (dari bunga)</label>
                  <input className="input tnum max-w-[140px]" inputMode="decimal" value={kapForm.fee_persen}
                    onChange={(e) => setKapForm({ ...kapForm, fee_persen: e.target.value.replace(/[^\d.]/g, "") })} />
                </div>
              )}
            </div>

            {/* Investor */}
            <div className="rounded-xl border border-slate-200 p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-navy-700" checked={kapForm.is_investor}
                  onChange={(e) => setKapForm({ ...kapForm, is_investor: e.target.checked })} disabled={!kapt.has_email} />
                <span className="text-sm font-semibold text-navy-900">Investor</span>
                <span className="text-xs text-slate-400">— modal & bagi hasil dari laba</span>
              </label>
              {kapForm.is_investor && (
                <div className="mt-2 flex flex-wrap items-end gap-3">
                  <div><label className="label">Modal (Rp)</label>
                    <input className="input tnum max-w-[160px]" inputMode="numeric" value={kapForm.modal}
                      onChange={(e) => setKapForm({ ...kapForm, modal: e.target.value.replace(/\D/g, "") })} /></div>
                  <div><label className="label">Bagi hasil % (laba)</label>
                    <input className="input tnum max-w-[120px]" inputMode="decimal" value={kapForm.bagi_hasil_persen}
                      onChange={(e) => setKapForm({ ...kapForm, bagi_hasil_persen: e.target.value.replace(/[^\d.]/g, "") })} /></div>
                </div>
              )}
            </div>

            {kapMsg && <p className="text-sm text-red-600">{kapMsg}</p>}
            <div className="flex gap-2 justify-end">
              <button className="btn-ghost" onClick={() => setKap(false)}>Batal</button>
              <button className="btn-primary" onClick={simpanKap} disabled={savingKap || !kapt.has_email}>{savingKap ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {edit && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 grid place-items-center p-4" onClick={() => setEdit(false)}>
          <div className="card p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-navy-900">Edit Nasabah</h2>
            <div><label className="label">Nama Lengkap *</label><input className="input" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">No. HP</label><input className="input" value={form.no_hp} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} /></div>
              <div><label className="label">No. KTP</label><input className="input" value={form.no_ktp} onChange={(e) => setForm({ ...form, no_ktp: e.target.value })} /></div>
            </div>
            <div><label className="label">Email <span className="font-normal text-slate-400">(untuk cek pinjaman via Z One)</span></label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Alamat</label><input className="input" value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} /></div>
            <div><label className="label">Catatan</label><input className="input" value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} /></div>
            <div className="flex gap-2 justify-end">
              <button className="btn-ghost" onClick={() => setEdit(false)}>Batal</button>
              <button className="btn-primary" onClick={simpan} disabled={saving || !form.nama.trim()}>{saving ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-400 w-20 shrink-0">{k}</span>
      <span className="text-navy-800 flex-1">{v}</span>
    </div>
  );
}
