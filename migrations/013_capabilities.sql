-- =============================================================
-- MIGRATION 013: Kapabilitas bertumpuk — satu user bisa banyak "topi"
-- access (operasional) + flag is_mitra + is_investor, terpisah dari role lama.
-- =============================================================
alter table users add column if not exists access      text    not null default 'marketing'; -- admin | marketing | none
alter table users add column if not exists is_mitra     boolean not null default false;
alter table users add column if not exists is_investor  boolean not null default false;

-- Migrasi dari kolom role lama.
update users set access = case
  when role = 'admin' then 'admin'
  when role = 'investor' then 'none'
  else 'marketing' end;
update users set is_mitra = (role = 'mitra');
update users set is_investor = (role = 'investor');

-- role kini legacy (dipertahankan tapi boleh null).
alter table users alter column role drop not null;
