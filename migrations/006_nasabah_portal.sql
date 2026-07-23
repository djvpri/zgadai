-- =============================================================
-- MIGRATION 006: Portal nasabah lewat SSO Z One
-- - email nasabah (identitas SSO)
-- - sesi bisa milik nasabah (bukan hanya staff/users)
-- =============================================================
alter table nasabah add column if not exists email text;
create index if not exists idx_nasabah_email on nasabah (lower(email));

alter table sessions add column if not exists nasabah_id bigint references nasabah(id) on delete cascade;
alter table sessions alter column user_id drop not null;
create index if not exists idx_sessions_nasabah on sessions (nasabah_id);
