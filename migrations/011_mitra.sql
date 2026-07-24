-- =============================================================
-- MIGRATION 011: Role MITRA (agen berkomisi) + fee dari bunga
-- =============================================================

-- Izinkan role 'mitra' pada users.
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('admin','kasir','mitra'));

-- Persentase fee mitra (dari bunga yang terkumpul).
alter table users add column if not exists fee_persen numeric(6,3) not null default 0;

-- Ledger fee mitra: satu baris tiap pembayaran berbunga pada gadai yang
-- dibuat oleh mitra.
create table if not exists mitra_fee (
  id            bigserial primary key,
  tenant_id     bigint not null references tenants(id) on delete cascade,
  mitra_id      bigint not null references users(id) on delete cascade,
  gadai_id      bigint references gadai(id) on delete set null,
  no_sbg        text,
  nasabah       text,
  bunga_dibayar bigint not null default 0,
  fee           bigint not null default 0,
  paid          boolean not null default false,
  tgl           date not null default current_date,
  created_at    timestamptz not null default now()
);
create index if not exists idx_mitra_fee on mitra_fee (tenant_id, mitra_id);
create index if not exists idx_mitra_fee_paid on mitra_fee (tenant_id, mitra_id, paid);
