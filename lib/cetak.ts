// lib/cetak.ts — cetak Surat Bukti Gadai (SBG) via iframe tersembunyi (tanpa dependency).
import { rupiah, tanggalID } from "./gadai";

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface SBGBarang { jenis: string; nama: string; berat_gram?: any; kadar?: string | null; taksiran: number }
interface SBGGadai {
  no_sbg: string; tgl_gadai: string; tgl_jatuh_tempo: string;
  bunga_persen: number | string; periode_hari: number; taksiran: number; pokok: number; biaya_admin: number;
  nasabah_nama: string; nasabah_hp?: string | null; nasabah_ktp?: string | null; nasabah_alamat?: string | null;
}

export function cetakSBG(g: SBGGadai, barang: SBGBarang[], usaha: string) {
  const rows = barang.map((b) => `
    <tr>
      <td>${esc(b.nama)} <span class="muted">(${esc(b.jenis)}${b.kadar ? ", " + esc(b.kadar) : ""}${b.berat_gram ? ", " + esc(b.berat_gram) + "gr" : ""})</span></td>
      <td class="r tnum">${rupiah(b.taksiran)}</td>
    </tr>`).join("");

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
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 16px; margin:8px 0; }
  .row { display:flex; justify-content:space-between; border-bottom:1px dotted #cbd5e1; padding:2px 0; }
  .k { color:#64748b; }
  .v { font-weight:600; }
  .box { border:1px solid #cbd5e1; border-radius:6px; padding:8px 10px; margin-top:6px; }
  .ttd { display:flex; justify-content:space-between; margin-top:24px; text-align:center; }
  .ttd div { width:45%; }
  .ttd .line { margin-top:40px; border-top:1px solid #0b1a3a; padding-top:2px; }
  .note { font-size:9px; color:#64748b; margin-top:10px; text-align:center; }
</style></head><body>
  <div class="head">
    <div><div class="brand">${esc(usaha)}</div><div class="muted">Layanan Gadai</div></div>
    <div class="doc"><div class="t">SURAT BUKTI GADAI</div><div class="tnum">${esc(g.no_sbg)}</div></div>
  </div>

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
    <div>Nasabah<div class="line">${esc(g.nasabah_nama)}</div></div>
    <div>Petugas<div class="line">${esc(usaha)}</div></div>
  </div>
  <div class="note">Barang dapat ditebus/diperpanjang sebelum jatuh tempo. Lewat tempo dapat dilelang sesuai ketentuan.</div>
</body></html>`;

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
