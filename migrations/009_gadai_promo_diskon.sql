-- =============================================================
-- MIGRATION 009: Simpan % diskon promo pada gadai (untuk badge SBG)
-- =============================================================
alter table gadai add column if not exists promo_diskon numeric(6,3);
