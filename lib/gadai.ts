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
  tgl_jatuh_tempo: string;
  periode_hari: number;
  bunga_persen: number;
  pokok_sisa: number;
}

export interface HitungTebus {
  periode: number;
  bunga: number;
  denda: number;
  hariTelat: number;
  pokok: number;
  total: number;
}

/** Jumlah hari telat dari jatuh tempo (0 kalau belum lewat). */
export function hariTelat(jatuhTempo: string | Date, sampai: string | Date = new Date()): number {
  return Math.max(0, selisihHari(jatuhTempo, sampai));
}

/** Denda = pokokSisa × (denda%/hari) × jumlah hari telat. */
export function hitungDenda(pokokSisa: number, dendaPersenPerHari: number, telat: number): number {
  if (!telat || !dendaPersenPerHari) return 0;
  return Math.round(pokokSisa * (dendaPersenPerHari / 100) * telat);
}

/** Rincian tebus (pelunasan) per tanggal tertentu (default hari ini). */
export function hitungTebus(g: GadaiCore, dendaPersenPerHari = 0, sampai: string | Date = new Date()): HitungTebus {
  const periode = periodeBerjalan(g.tgl_gadai, sampai, g.periode_hari);
  const bunga = hitungBunga(g.pokok_sisa, g.bunga_persen, periode);
  const telat = hariTelat(g.tgl_jatuh_tempo, sampai);
  const denda = hitungDenda(g.pokok_sisa, dendaPersenPerHari, telat);
  return { periode, bunga, denda, hariTelat: telat, pokok: g.pokok_sisa, total: g.pokok_sisa + bunga + denda };
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

/** Fraksi kemurnian dari label kadar ("22K" -> 0.9167, "750" -> 0.75). 0 = tak dikenali. */
export function kadarFraction(kadar: string | null | undefined): number {
  const s = String(kadar || "").toUpperCase().replace(/\s/g, "");
  const kMatch = s.match(/(\d{1,2})K/);
  if (kMatch) return Math.min(1, Number(kMatch[1]) / 24);
  const n = Number(s.replace(/[^\d]/g, ""));
  if (!isNaN(n) && n >= 300 && n <= 1000) return n / 1000; // per-seribu (999/916/750/...)
  return 0;
}

/** Taksiran emas = berat × fraksi kadar × harga per gram (emas murni). */
export function taksiranEmas(berat: number, kadar: string, hargaPerGram: number): number {
  const frac = kadarFraction(kadar);
  if (!berat || !frac || !hargaPerGram) return 0;
  return Math.round(berat * frac * hargaPerGram);
}

/** Normalisasi nomor HP Indonesia ke format wa.me (62...). */
export function normalizeWa(no: string | null | undefined): string {
  let d = String(no || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return d;
}

/** Bangun tautan WhatsApp dengan pesan otomatis. */
export function waLink(no: string | null | undefined, text: string): string {
  return `https://wa.me/${normalizeWa(no)}?text=${encodeURIComponent(text)}`;
}

export function tanggalID(tgl: string | Date | null | undefined): string {
  if (!tgl) return "-";
  return new Date(tgl).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
