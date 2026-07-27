"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";

const DATASET = [
  { jenis: "nasabah", label: "Data Nasabah", icon: "bi-people", desc: "Identitas, kontak, alamat, rekening." },
  { jenis: "gadai", label: "Data Gadai (SBG)", icon: "bi-safe2", desc: "Semua pinjaman: pokok, status, jatuh tempo, lelang." },
  { jenis: "pembayaran", label: "Riwayat Pembayaran", icon: "bi-receipt", desc: "Tebus, perpanjang, cicil — bunga/denda/pokok." },
  { jenis: "kas", label: "Buku Kas", icon: "bi-wallet2", desc: "Semua arus kas masuk & keluar." },
];
const today = () => new Date().toISOString().slice(0, 10);

export default function EksporPage() {
  const router = useRouter();
  const [busy, setBusy] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (d.kind !== "staff" || d.user?.access !== "admin") router.replace("/dashboard");
    }).catch(() => {});
  }, [router]);

  async function unduh(jenis: string) {
    setBusy(jenis);
    try {
      const r = await fetch(`/api/ekspor?jenis=${jenis}`);
      if (!r.ok) { alert("Gagal mengekspor data."); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `zgadai-${jenis}-${today()}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy("");
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-navy-900 mb-1">Backup / Ekspor Data</h1>
      <p className="text-slate-500 text-sm mb-5">Unduh data ke file CSV (bisa dibuka di Excel / Google Sheets) sebagai cadangan.</p>

      <div className="grid sm:grid-cols-2 gap-4">
        {DATASET.map((d) => (
          <div key={d.jenis} className="card p-5 flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-navy-50 text-navy-600 grid place-items-center text-xl shrink-0"><i className={`bi ${d.icon}`} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-navy-900">{d.label}</div>
              <div className="text-xs text-slate-500 mb-3">{d.desc}</div>
              <button className="btn-primary text-sm py-2" onClick={() => unduh(d.jenis)} disabled={busy === d.jenis}>
                <i className="bi bi-download" /> {busy === d.jenis ? "Menyiapkan…" : "Unduh CSV"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-4 mt-5 text-sm text-slate-600 bg-amber-50/50 border border-amber-200">
        <i className="bi bi-shield-lock text-amber-500 me-1" />
        <b>Saran:</b> unduh keempat file ini secara berkala (mis. tiap akhir bulan) dan simpan di tempat aman (Google Drive/flashdisk).
        File CSV memuat data pribadi nasabah — jaga kerahasiaannya.
      </div>
    </AppShell>
  );
}
