// lib/cetak.ts — cetak Surat Bukti Gadai (SBG) via iframe tersembunyi (tanpa dependency).
import { rupiah, tanggalID } from "./gadai";

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface SBGBarang { jenis: string; nama: string; berat_gram?: any; kadar?: string | null; taksiran: number; foto_url?: string | null; foto_urls?: string[] | null }
interface SBGGadai {
  no_sbg: string; tgl_gadai: string; tgl_jatuh_tempo: string;
  bunga_persen: number | string; periode_hari: number; taksiran: number; pokok: number; biaya_admin: number;
  nasabah_nama: string; nasabah_hp?: string | null; nasabah_ktp?: string | null; nasabah_alamat?: string | null;
  promo_nama?: string | null; promo_diskon?: number | string | null;
}

export function cetakSBG(
  g: SBGGadai,
  barang: SBGBarang[],
  shop: { nama: string; alamat?: string | null; wa?: string | null; petugas?: string | null },
) {
  const rows = barang.map((b) => {
    const fotos = Array.isArray(b.foto_urls) && b.foto_urls.length ? b.foto_urls : (b.foto_url ? [b.foto_url] : []);
    const thumbs = fotos.slice(0, 4).map((f) => `<img src="${esc(f)}" class="thumb">`).join("");
    return `
    <tr>
      <td>
        <div><span class="bnama">${esc(b.nama)}</span> <span class="muted">(${esc(b.jenis)}${b.kadar ? ", " + esc(b.kadar) : ""}${b.berat_gram ? ", " + esc(b.berat_gram) + "gr" : ""})</span></div>
        ${thumbs ? `<div class="thumbs">${thumbs}</div>` : ""}
      </td>
      <td class="r tnum">${rupiah(b.taksiran)}</td>
    </tr>`;
  }).join("");

  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>SBG ${esc(g.no_sbg)}</title>
<style>
  @page { size: A5; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color:#0b1a3a; font-size:11px; margin:0; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0b1a3a; padding-bottom:8px; }
  .brand { font-size:15px; font-weight:800; }
  .doc { text-align:right; }
  .doc .t { font-weight:700; letter-spacing:.5px; }
  h2 { text-align:center; font-size:13px; margin:10px 0; letter-spacing:1px; }
  table { width:100%; border-collapse:collapse; margin:6px 0; }
  td, th { padding:4px 6px; border-bottom:1px solid #e2e8f0; text-align:left; vertical-align:top; }
  .r { text-align:right; }
  .muted { color:#64748b; font-size:10px; }
  .tnum { font-variant-numeric: tabular-nums; }
  .thumb { width:34px; height:34px; object-fit:cover; border-radius:4px; border:1px solid #cbd5e1; margin-right:4px; }
  .thumbs { margin-top:4px; }
  .bnama { font-weight:600; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 16px; margin:8px 0; }
  .row { display:flex; justify-content:space-between; border-bottom:1px dotted #cbd5e1; padding:2px 0; }
  .k { color:#64748b; }
  .v { font-weight:600; }
  .box { border:1px solid #cbd5e1; border-radius:6px; padding:8px 10px; margin-top:6px; }
  .ttd { display:flex; justify-content:space-between; margin-top:20px; }
  .ttd .col { width:46%; text-align:center; }
  .ttd .role { margin-bottom:50px; color:#334155; }
  .ttd .sign { border-top:1px solid #0b1a3a; padding-top:3px; font-weight:600; }
  .note { font-size:9px; color:#64748b; margin-top:16px; text-align:center; }
  .promo { background:#ecfdf5; border:1.5px solid #10b981; color:#065f46; border-radius:8px; padding:7px 10px; text-align:center; font-weight:700; margin:10px 0 4px; }
  .promo small { display:block; font-weight:500; color:#047857; font-size:10px; margin-top:2px; }
</style></head><body>
  <div class="head">
    <div>
      <div class="brand">${esc(shop.nama)}</div>
      <div class="muted">Layanan Gadai${shop.alamat ? " &middot; " + esc(shop.alamat) : ""}${shop.wa ? " &middot; WA " + esc(shop.wa) : ""}</div>
    </div>
    <div class="doc"><div class="t">SURAT BUKTI GADAI</div><div class="tnum">${esc(g.no_sbg)}</div></div>
  </div>

  ${g.promo_nama ? `<div class="promo">&#127881; PROMO: ${esc(g.promo_nama)}${g.promo_diskon ? ` &mdash; Diskon Bunga ${Number(g.promo_diskon)}%` : ""}<small>Selamat! Anda mendapat bunga spesial ${esc(g.bunga_persen)}% per ${esc(g.periode_hari)} hari</small></div>` : ""}

  <div class="grid" style="margin-top:8px">
    <div class="row"><span class="k">Nama</span><span class="v">${esc(g.nasabah_nama)}</span></div>
    <div class="row"><span class="k">No. HP</span><span class="v tnum">${esc(g.nasabah_hp || "-")}</span></div>
    <div class="row"><span class="k">No. KTP</span><span class="v tnum">${esc(g.nasabah_ktp || "-")}</span></div>
    <div class="row"><span class="k">Tgl Gadai</span><span class="v tnum">${tanggalID(g.tgl_gadai)}</span></div>
  </div>

  <table>
    <thead><tr><th>Barang Jaminan</th><th class="r">Taksiran</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="box">
    <div class="row"><span class="k">Total Taksiran</span><span class="v tnum">${rupiah(g.taksiran)}</span></div>
    <div class="row"><span class="k">Uang Pinjaman</span><span class="v tnum">${rupiah(g.pokok)}</span></div>
    <div class="row"><span class="k">Biaya Admin</span><span class="v tnum">${rupiah(g.biaya_admin)}</span></div>
    <div class="row"><span class="k">Sewa Modal / Bunga</span><span class="v tnum">${esc(g.bunga_persen)}% per ${esc(g.periode_hari)} hari</span></div>
    <div class="row"><span class="k">Jatuh Tempo</span><span class="v tnum">${tanggalID(g.tgl_jatuh_tempo)}</span></div>
  </div>

  <div class="ttd">
    <div class="col"><div class="role">Nasabah,</div><div class="sign">${esc(g.nasabah_nama)}</div></div>
    <div class="col"><div class="role">Petugas,</div><div class="sign">${esc(shop.petugas || shop.nama)}</div></div>
  </div>
  <div class="note">Barang dapat ditebus/diperpanjang sebelum jatuh tempo. Lewat tempo dapat dilelang sesuai ketentuan.</div>
</body></html>`;

  printViaIframe(html);
}

// ---- Cetak Nota pembayaran (thermal 80mm) ----
export interface NotaData {
  no_sbg: string;
  nasabah: string;
  jenis: "tebus" | "perpanjang" | "cicil";
  tgl: string;
  bunga: number;
  denda: number;
  pokok_dibayar: number;
  total: number;
  sisa_pokok: number;
  jatuh_tempo_baru?: string | null;
  lunas: boolean;
}

const JENIS_NOTA: Record<string, string> = {
  tebus: "Tebus / Pelunasan",
  perpanjang: "Perpanjang",
  cicil: "Cicil Pokok",
};

export function cetakNota(n: NotaData, shop: { nama: string; alamat?: string | null; wa?: string | null }) {
  const line = (k: string, v: string, strong = false) =>
    `<div class="row${strong ? " s" : ""}"><span>${esc(k)}</span><span class="tnum">${v}</span></div>`;

  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>Nota ${esc(n.no_sbg)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Consolas','Courier New',monospace; color:#000; font-size:12px; margin:0; width:72mm; }
  .c { text-align:center; }
  .b { font-weight:700; }
  .brand { font-size:15px; font-weight:700; }
  .muted { color:#333; font-size:10px; }
  .hr { border-top:1px dashed #000; margin:6px 0; }
  .row { display:flex; justify-content:space-between; gap:8px; padding:1px 0; }
  .row.s { font-weight:700; font-size:13px; }
  .tnum { font-variant-numeric: tabular-nums; }
  .badge { text-align:center; font-weight:700; border:1px solid #000; border-radius:4px; padding:3px; margin:6px 0; }
  .foot { text-align:center; font-size:10px; margin-top:8px; }
</style></head><body>
  <div class="c">
    <div class="brand">${esc(shop.nama)}</div>
    ${shop.alamat ? `<div class="muted">${esc(shop.alamat)}</div>` : ""}
    ${shop.wa ? `<div class="muted">WA ${esc(shop.wa)}</div>` : ""}
  </div>
  <div class="hr"></div>
  <div class="c b">BUKTI PEMBAYARAN</div>
  <div class="c muted">${esc(JENIS_NOTA[n.jenis] || n.jenis)}</div>
  <div class="hr"></div>
  ${line("No. SBG", esc(n.no_sbg))}
  ${line("Tanggal", tanggalID(n.tgl))}
  ${line("Nasabah", esc(n.nasabah))}
  <div class="hr"></div>
  ${n.bunga > 0 ? line("Bunga", rupiah(n.bunga)) : ""}
  ${n.denda > 0 ? line("Denda", rupiah(n.denda)) : ""}
  ${n.pokok_dibayar > 0 ? line("Pokok dibayar", rupiah(n.pokok_dibayar)) : ""}
  ${line("TOTAL BAYAR", rupiah(n.total), true)}
  <div class="hr"></div>
  ${n.lunas
    ? `<div class="badge">LUNAS — Barang dapat diambil</div>`
    : `${line("Sisa pokok", rupiah(n.sisa_pokok))}${n.jatuh_tempo_baru ? line("Jatuh tempo", tanggalID(n.jatuh_tempo_baru)) : ""}`}
  <div class="foot">Terima kasih.<br>Simpan nota ini sebagai bukti.</div>
</body></html>`;

  printViaIframe(html);
}

function printViaIframe(html: string) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) { iframe.remove(); return; }
  doc.open(); doc.write(html); doc.close();
  const win = iframe.contentWindow!;
  win.onafterprint = () => setTimeout(() => iframe.remove(), 300);
  setTimeout(() => { win.focus(); win.print(); setTimeout(() => iframe.remove(), 1500); }, 350);
}

// ---- Cetak Laporan (A4) ----
export function cetakLaporan(d: any, usaha: string) {
  const rowKV = (k: string, v: string, strong = false) =>
    `<div class="kv"><span>${esc(k)}</span><span class="${strong ? "s" : ""} tnum">${v}</span></div>`;

  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>Laporan ${esc(usaha)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color:#0b1a3a; font-size:12px; margin:0; }
  .head { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #0b1a3a; padding-bottom:8px; margin-bottom:14px; }
  .brand { font-size:17px; font-weight:800; }
  .muted { color:#64748b; }
  h2 { font-size:12px; text-transform:uppercase; letter-spacing:.5px; color:#334155; margin:16px 0 6px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 24px; }
  .kv { display:flex; justify-content:space-between; border-bottom:1px dotted #cbd5e1; padding:3px 0; }
  .kv .s { font-weight:700; }
  .tnum { font-variant-numeric: tabular-nums; }
  .cards { display:flex; gap:10px; margin-bottom:6px; }
  .card { flex:1; border:1px solid #cbd5e1; border-radius:6px; padding:8px 10px; }
  .card .l { font-size:10px; color:#64748b; }
  .card .v { font-size:14px; font-weight:800; margin-top:2px; }
  .foot { margin-top:20px; padding-top:8px; border-top:1px solid #e2e8f0; text-align:center; font-size:9px; color:#94a3b8; }
</style></head><body>
  <div class="head">
    <div><div class="brand">${esc(usaha)}</div><div class="muted">Laporan Usaha Gadai</div></div>
    <div class="muted">Periode ${tanggalID(d.periode.from)} – ${tanggalID(d.periode.to)}</div>
  </div>

  <div class="cards">
    <div class="card"><div class="l">Kas Masuk</div><div class="v tnum">${rupiah(d.kas.masuk)}</div></div>
    <div class="card"><div class="l">Kas Keluar</div><div class="v tnum">${rupiah(d.kas.keluar)}</div></div>
    <div class="card"><div class="l">Kas Bersih</div><div class="v tnum">${rupiah(d.kas.net)}</div></div>
    <div class="card"><div class="l">Laba</div><div class="v tnum">${rupiah(d.pendapatan.laba)}</div></div>
  </div>

  <h2>Pendapatan</h2>
  <div class="grid">
    ${rowKV("Bunga", rupiah(d.pendapatan.bunga))}
    ${rowKV("Denda", rupiah(d.pendapatan.denda))}
    ${rowKV("Biaya Admin", rupiah(d.pendapatan.admin))}
    ${rowKV("Total Laba", rupiah(d.pendapatan.laba), true)}
  </div>

  <h2>Rekap Transaksi</h2>
  <div class="grid">
    ${rowKV(`Gadai baru (${d.pencairan.jumlah})`, rupiah(d.pencairan.pokok))}
    ${rowKV(`Tebus (${d.pembayaran.n_tebus})`, rupiah(d.pembayaran.total))}
    ${rowKV(`Perpanjang (${d.pembayaran.n_perpanjang})`, "-")}
    ${rowKV(`Cicil (${d.pembayaran.n_cicil})`, rupiah(d.pembayaran.pokok))}
    ${rowKV(`Lelang (${d.lelang.jumlah})`, rupiah(d.lelang.harga))}
    ${rowKV("Selisih lelang", rupiah(d.lelang.selisih))}
  </div>

  <h2>Umur Pinjaman Aktif (saat cetak)</h2>
  <div class="grid">
    ${rowKV(`Belum jatuh tempo (${d.aging.belum.n})`, rupiah(d.aging.belum.pokok))}
    ${rowKV(`≤ 7 hari (${d.aging.dekat.n})`, rupiah(d.aging.dekat.pokok))}
    ${rowKV(`Lewat tempo (${d.aging.lewat.n})`, rupiah(d.aging.lewat.pokok))}
  </div>

  <div class="foot">Dicetak ${tanggalID(new Date())} · ZGadai · Zomet</div>
</body></html>`;

  printViaIframe(html);
}
