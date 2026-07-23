-- =============================================================
-- MIGRATION 003: Foto wajah nasabah (data URL JPEG terkompresi)
-- =============================================================
alter table nasabah add column if not exists foto text;
