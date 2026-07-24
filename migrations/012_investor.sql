-- =============================================================
-- MIGRATION 012: Role INVESTOR (pantau + bagi hasil dari laba)
-- ('kasir' kini dilabeli "Marketing" di UI — nilai DB tetap 'kasir')
-- =============================================================
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('admin','kasir','mitra','investor'));

alter table users add column if not exists modal              bigint       not null default 0;
alter table users add column if not exists bagi_hasil_persen  numeric(6,3) not null default 0;
