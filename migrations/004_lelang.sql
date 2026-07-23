-- =============================================================
-- MIGRATION 004: Data lelang pada gadai
-- =============================================================
alter table gadai add column if not exists harga_lelang           bigint;
alter table gadai add column if not exists nilai_kewajiban_lelang bigint; -- pokok+bunga+denda saat lelang
alter table gadai add column if not exists tgl_lelang             date;
