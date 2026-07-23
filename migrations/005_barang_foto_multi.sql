-- =============================================================
-- MIGRATION 005: Banyak foto per barang jaminan (galeri)
-- foto_url (lama) tetap dipertahankan sebagai thumbnail (foto pertama).
-- =============================================================
alter table barang add column if not exists foto_urls jsonb not null default '[]'::jsonb;
