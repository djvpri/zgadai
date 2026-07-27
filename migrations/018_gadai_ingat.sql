-- =============================================================
-- MIGRATION 018: Penanda pengingat jatuh tempo (manual, tanpa WA API).
-- =============================================================
alter table gadai add column if not exists terakhir_diingatkan timestamptz;
