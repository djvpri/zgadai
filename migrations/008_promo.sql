-- =============================================================
-- MIGRATION 008: Promo diskon bunga untuk GADAI BARU di periode tertentu
-- =============================================================
create table if not exists promo (
  id                   bigserial primary key,
  tenant_id            bigint not null references tenants(id) on delete cascade,
  nama                 text not null,
  tgl_mulai            date not null,
  tgl_selesai          date not null,
  diskon_bunga_persen  numeric(6,3) not null default 0,  -- % potongan dari bunga normal
  aktif                boolean not null default true,
  created_at           timestamptz not null default now()
);
create index if not exists idx_promo_tenant on promo (tenant_id);

-- Catatan promo yang dipakai saat gadai dibuat (untuk bukti/SBG/laporan).
alter table gadai add column if not exists promo_nama text;
