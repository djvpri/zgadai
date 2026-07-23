// lib/gadai.ts — logika bisnis gadai (murni, tanpa DB).
// Dipakai server (saat proses bayar) & client (preview kalkulasi).

export function rupiah(n: number | string | null | undefined): string {
  const v = Math.round(Number(n || 0));
  return "Rp " + v.toLocaleString("id-ID");
}

const MS_DAY = 24 * 60 * 60 * 1000;

/** Selisih hari (dibulatkan ke bawah) antara dua tanggal (string ISO / Date). */
export function selisihHari(dari: string | Date, sampai: string | Date): number {
  const a = new Date(dari); a.setHours(0, 0, 0, 0);
  const b = new Date(sampai); b.setHours(0, 0, 0, 0);
  return Math.floor((b.getTime() - a.getTime()) / MS_DAY);
}

/** Jumlah periode bunga berjalan. Periode berjalan dihitung PENUH (min 1). */
export function periodeBerjalan(tglGadai: string | Date, sampai: string | Date, periodeHari: number): number {
  const hari = Math.max(0, selisihHari(tglGadai, sampai));
  const p = Math.ceil(hari / Math.max(1, periodeHari));
  return Math.max(1, p);
}

/** Bunga = pokokSisa × (bunga%/periode) × jumlahPeriode. */
export function hitungBunga(pokokSisa: number, bungaPersen: number, periode: number): number {
  return Math.round((pokokSisa * (bungaPersen / 100)) * periode);
}

export interface GadaiCore {
  tgl_gadai: string;
  periode_hari: number;
  bunga_persen: number;
  pokok_sisa: number;
}

export interface HitungTebus {
  periode: number;
  bunga: number;
  pokok: number;
  total: number;
}

/** Rincian tebus (pelunasan) per tanggal tertentu (default hari ini). */
export function hitungTebus(g: GadaiCore, sampai: string | Date = new Date()): HitungTebus {
  const periode = periodeBerjalan(g.tgl_gadai, sampai, g.periode_hari);
  const bunga = hitungBunga(g.pokok_sisa, g.bunga_persen, periode);
  return { periode, bunga, pokok: g.pokok_sisa, total: g.pokok_sisa + bunga };
}

/** Bunga satu periode ke depan (untuk perpanjang). */
export function bungaPerpanjang(g: GadaiCore, sampai: string | Date = new Date()): { periode: number; bunga: number } {
  const periode = periodeBerjalan(g.tgl_gadai, sampai, g.periode_hari);
  return { periode, bunga: hitungBunga(g.pokok_sisa, g.bunga_persen, periode) };
}

/** Tambah N hari ke sebuah tanggal, return string YYYY-MM-DD. */
export function tambahHari(tgl: string | Date, hari: number): string {
  const d = new Date(tgl);
  d.setDate(d.getDate() + hari);
  return d.toISOString().slice(0, 10);
}

/** Plafon pinjaman default = persen × taksiran (dibulatkan ke ribuan). */
export function plafon(taksiran: number, persen = 90): number {
  return Math.floor((taksiran * persen) / 100 / 1000) * 1000;
}

export type StatusJatuhTempo = "aktif" | "dekat" | "lewat";

/** Klasifikasi jatuh tempo relatif hari ini (dekat = ≤ ambang hari). */
export function statusJatuhTempo(jatuhTempo: string | Date, ambangHari = 7): StatusJatuhTempo {
  const sisa = selisihHari(new Date(), jatuhTempo);
  if (sisa < 0) return "lewat";
  if (sisa <= ambangHari) return "dekat";
  return "aktif";
}

export const STATUS_BADGE: Record<string, { label: string; cls: string; icon: string }> = {
  aktif:  { label: "Aktif",       cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: "bi-check-circle" },
  lunas:  { label: "Ditebus",     cls: "bg-slate-100 text-slate-600 border border-slate-200",       icon: "bi-bag-check" },
  lelang: { label: "Lelang",      cls: "bg-red-50 text-red-700 border border-red-200",              icon: "bi-hammer" },
  dekat:  { label: "Jatuh Tempo", cls: "bg-amber-50 text-amber-700 border border-amber-200",        icon: "bi-clock-history" },
  lewat:  { label: "Lewat Tempo", cls: "bg-red-50 text-red-700 border border-red-200",              icon: "bi-exclamation-triangle" },
};

export function tanggalID(tgl: string | Date | null | undefined): string {
  if (!tgl) return "-";
  return new Date(tgl).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
