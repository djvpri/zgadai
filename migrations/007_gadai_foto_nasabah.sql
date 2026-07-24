-- =============================================================
-- MIGRATION 007: Foto nasabah saat transaksi (dokumentasi per-gadai)
-- Berbeda dari nasabah.foto (profil) — ini bukti kehadiran per transaksi.
-- =============================================================
alter table gadai add column if not exists foto_nasabah text;
