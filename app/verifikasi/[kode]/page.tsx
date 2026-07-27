"use client";
import { useEffect, useState } from "react";
import { tanggalID } from "@/lib/gadai";

const STATUS: Record<string, { label: string; cls: string; icon: string }> = {
  aktif: { label: "Aktif (sedang digadaikan)", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "bi-safe2" },
  lunas: { label: "Sudah Ditebus (Lunas)", cls: "bg-slate-100 text-slate-600 border-slate-200", icon: "bi-bag-check" },
  lelang: { label: "Sudah Dilelang", cls: "bg-red-50 text-red-700 border-red-200", icon: "bi-hammer" },
};

export default function VerifikasiPage({ params }: { params: { kode: string } }) {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/verifikasi/${params.kode}`)
      .then((r) => r.json())
      .then(setD)
      .catch(() => setD({ found: false }))
      .finally(() => setLoading(false));
  }, [params.kode]);

  const st = d?.status ? STATUS[d.status] : null;

  return (
    <div className="min-h-dvh bg-slate-50 grid place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-4">
          <span className="font-bold text-navy-900 text-lg flex items-center justify-center gap-2">
            <i className="bi bi-safe2-fill text-gold-500" /> {d?.usaha || "ZGadai"}
          </span>
          <p className="text-xs text-slate-500">Verifikasi Surat Bukti Gadai</p>
        </div>

        {loading ? (
          <div className="card p-10 text-center text-slate-400">Memeriksa…</div>
        ) : !d?.found ? (
          <div className="card p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-50 grid place-items-center text-red-500 text-3xl mb-3"><i className="bi bi-x-circle" /></div>
            <h1 className="text-lg font-bold text-navy-900">SBG Tidak Ditemukan</h1>
            <p className="text-sm text-slate-500 mt-1">Kode verifikasi tidak dikenali. Surat bukti gadai ini kemungkinan tidak asli. Hubungi tempat gadai untuk memastikan.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="bg-emerald-600 text-white text-center py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-white/20 grid place-items-center text-3xl mb-1"><i className="bi bi-patch-check-fill" /></div>
              <div className="font-bold text-lg">SBG ASLI & TERVERIFIKASI</div>
              <div className="text-emerald-100 text-xs">Terdaftar resmi di {d.usaha}</div>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-center">
                <div className="text-2xl font-black text-navy-900 tnum">{d.no_sbg}</div>
                {st && <span className={`inline-flex items-center gap-1.5 mt-2 text-xs font-semibold border rounded-full px-3 py-1 ${st.cls}`}><i className={`bi ${st.icon}`} />{st.label}</span>}
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2 text-sm">
                <Row k="Atas nama" v={d.nasabah} />
                <Row k="Tgl gadai" v={tanggalID(d.tgl_gadai)} />
                <Row k="Jatuh tempo" v={tanggalID(d.tgl_jatuh_tempo)} />
                {d.status === "lunas" && d.tgl_lunas && <Row k="Ditebus" v={tanggalID(d.tgl_lunas)} />}
                {d.status === "lelang" && d.tgl_lelang && <Row k="Dilelang" v={tanggalID(d.tgl_lelang)} />}
              </div>

              {d.barang?.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <div className="text-xs font-semibold text-slate-500 mb-1.5">Barang jaminan</div>
                  <ul className="space-y-1">
                    {d.barang.map((b: any, i: number) => (
                      <li key={i} className="text-sm text-navy-800 capitalize"><i className="bi bi-box-seam text-slate-400 me-2" />{b.nama} <span className="text-slate-400">· {b.jenis}</span></li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[11px] text-slate-400 text-center border-t border-slate-100 pt-3">
                Data pribadi & nominal sengaja disembunyikan demi privasi. Untuk detail, hubungi tempat gadai langsung.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{k}</span>
      <span className="font-medium text-navy-800 text-right">{v}</span>
    </div>
  );
}
