-- =============================================================
-- MIGRATION 014: Rekening bank nasabah (untuk transfer:
-- pencairan pinjaman & pengembalian kelebihan hasil lelang).
-- =============================================================
alter table nasabah add column if not exists bank_nama          text;
alter table nasabah add column if not exists no_rekening         text;
alter table nasabah add column if not exists rekening_atas_nama  text;
