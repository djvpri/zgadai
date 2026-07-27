import { NextRequest, NextResponse } from "next/server";
import { dbAll } from "@/lib/db";
import { currentSession } from "@/lib/auth";
import { logAktivitas } from "@/lib/log";

// Bungkus 1 nilai jadi sel CSV yang aman.
function cell(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(cols: string[], rows: any[][]): string {
  const lines = [cols.join(","), ...rows.map((r) => r.map(cell).join(","))];
  return "﻿" + lines.join("\r\n"); // BOM agar Excel baca UTF-8 (huruf Indonesia)
}

// GET /api/ekspor?jenis=nasabah|gadai|pembayaran|kas — unduh CSV (admin).
export async function GET(req: NextRequest) {
  const s = await currentSession();
  if (!s || s.access !== "admin") return NextResponse.json({ error: "Hanya admin" }, { status: 403 });
  const jenis = req.nextUrl.searchParams.get("jenis") || "";
  const t = s.tenant_id;
  let cols: string[] = [];
  let rows: any[][] = [];

  if (jenis === "nasabah") {
    cols = ["id", "nama", "no_ktp", "no_hp", "email", "alamat", "bank", "no_rekening", "atas_nama", "terdaftar"];
    const d = await dbAll<any>(
      `SELECT id, nama, no_ktp, no_hp, email, alamat, bank_nama, no_rekening, rekening_atas_nama, to_char(created_at,'YYYY-MM-DD') AS tgl
         FROM nasabah WHERE tenant_id=$1 ORDER BY id`, [t]);
    rows = d.map((r) => [r.id, r.nama, r.no_ktp, r.no_hp, r.email, r.alamat, r.bank_nama, r.no_rekening, r.rekening_atas_nama, r.tgl]);
  } else if (jenis === "gadai") {
    cols = ["id", "no_sbg", "nasabah", "status", "tgl_gadai", "jatuh_tempo", "taksiran", "pokok", "pokok_sisa", "biaya_admin", "bunga_persen", "tgl_lunas", "tgl_lelang", "harga_lelang"];
    const d = await dbAll<any>(
      `SELECT g.id, g.no_sbg, n.nama AS nasabah, g.status,
              to_char(g.tgl_gadai,'YYYY-MM-DD') AS tgl_gadai, to_char(g.tgl_jatuh_tempo,'YYYY-MM-DD') AS jt,
              g.taksiran, g.pokok, g.pokok_sisa, g.biaya_admin, g.bunga_persen,
              to_char(g.tgl_lunas,'YYYY-MM-DD') AS lunas, to_char(g.tgl_lelang,'YYYY-MM-DD') AS lelang, g.harga_lelang
         FROM gadai g JOIN nasabah n ON n.id=g.nasabah_id WHERE g.tenant_id=$1 ORDER BY g.id`, [t]);
    rows = d.map((r) => [r.id, r.no_sbg, r.nasabah, r.status, r.tgl_gadai, r.jt, r.taksiran, r.pokok, r.pokok_sisa, r.biaya_admin, r.bunga_persen, r.lunas, r.lelang, r.harga_lelang]);
  } else if (jenis === "pembayaran") {
    cols = ["id", "no_sbg", "nasabah", "jenis", "tgl", "bunga", "denda", "pokok_dibayar", "total"];
    const d = await dbAll<any>(
      `SELECT p.id, g.no_sbg, n.nama AS nasabah, p.jenis, to_char(p.tgl,'YYYY-MM-DD') AS tgl,
              p.bunga_dibayar, p.denda_dibayar, p.pokok_dibayar, p.total
         FROM pembayaran p JOIN gadai g ON g.id=p.gadai_id JOIN nasabah n ON n.id=g.nasabah_id
        WHERE p.tenant_id=$1 ORDER BY p.id`, [t]);
    rows = d.map((r) => [r.id, r.no_sbg, r.nasabah, r.jenis, r.tgl, r.bunga_dibayar, r.denda_dibayar, r.pokok_dibayar, r.total]);
  } else if (jenis === "kas") {
    cols = ["id", "tgl", "arah", "kategori", "metode", "jumlah", "keterangan", "oleh"];
    const d = await dbAll<any>(
      `SELECT k.id, to_char(k.tgl,'YYYY-MM-DD') AS tgl, k.arah, k.kategori, k.metode, k.jumlah, k.keterangan, u.nama AS oleh
         FROM kas k LEFT JOIN users u ON u.id=k.created_by WHERE k.tenant_id=$1 ORDER BY k.id`, [t]);
    rows = d.map((r) => [r.id, r.tgl, r.arah, r.kategori, r.metode, r.jumlah, r.keterangan, r.oleh]);
  } else {
    return NextResponse.json({ error: "Jenis tidak dikenal" }, { status: 400 });
  }

  await logAktivitas(s, "data.ekspor", `Ekspor CSV ${jenis} (${rows.length} baris)`, null);
  const csv = toCsv(cols, rows);
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="zgadai-${jenis}-${today}.csv"`,
    },
  });
}
