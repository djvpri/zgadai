-- =============================================================
-- MIGRATION 019: Kode verifikasi SBG (QR publik anti-pemalsuan).
-- =============================================================
alter table gadai add column if not exists verif_kode text;

-- Backfill kode acak untuk gadai lama.
update gadai SET verif_kode = substr(md5(random()::text || id::text || clock_timestamp()::text), 1, 12)
 where verif_kode is null;

create unique index if not exists idx_gadai_verif on gadai (verif_kode);
