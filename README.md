# ZGadai — Manajemen Usaha Gadai

Spoke ekosistem **Zomet** untuk mengelola usaha gadai: nasabah, barang jaminan,
pinjaman (SBG), tebus, perpanjang, dan cicil.

## Stack
- Next.js 14 (App Router) + React 18 + Tailwind 3
- PostgreSQL (`pg`) — migrasi otomatis saat `start` (`scripts/migrate.js`)
- SSO via **Z One** (`CROSS_APP_SECRET`, klaim `app: "zgadai"`)
- Deploy: Railway

## Fitur (MVP)
- **Dashboard**: uang beredar, gadai aktif, jatuh tempo ≤7 hari, lewat tempo, bunga bulan ini.
- **Nasabah**: daftar + cari + tambah.
- **Gadai Baru**: pilih/tambah nasabah, barang jaminan (multi), parameter pinjaman
  (bunga %/periode, tempo, biaya admin), saran plafon 90% taksiran, **cetak SBG**.
- **Transaksi**: filter status; detail dengan **Tebus / Perpanjang / Cicil**
  (bunga per periode dihitung otomatis) + riwayat pembayaran.

## Env (lihat `.env.local.example`)
- `DATABASE_URL`, `DATABASE_SSL=true`
- `CROSS_APP_SECRET` (samakan dengan Z One)
- `NEXT_PUBLIC_ZONE_URL`

## Setup Z One (agar SSO jalan)
1. Tambah slug `zgadai` ke `SSO_ENABLED_SLUGS` di dashboard Z One.
2. Provision user lewat Z One `/manage` (endpoint `POST /api/admin/cross-app`).

## Perhitungan bunga
Bunga = `sisa_pokok × (bunga%/periode) × jumlah_periode`. Periode berjalan
dihitung penuh (mis. per 15 hari). Perpanjang/cicil mereset siklus bunga.
