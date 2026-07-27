-- =============================================================
-- MIGRATION 016: Buku Kas — arus kas (tunai/transfer) + tutup kas harian.
-- =============================================================
create table if not exists kas (
  id                bigserial primary key,
  tenant_id         bigint not null references tenants(id) on delete cascade,
  tgl               date not null default current_date,
  arah              text not null,                       -- masuk | keluar
  kategori          text not null default 'lainnya',     -- pencairan|pembayaran|operasional|modal|prive|lelang|lainnya
  metode            text not null default 'tunai',       -- tunai | transfer
  jumlah            bigint not null default 0,
  keterangan        text,
  ref_gadai_id      bigint references gadai(id) on delete set null,
  ref_pembayaran_id bigint references pembayaran(id) on delete set null,
  created_by        bigint references users(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists idx_kas_tenant_tgl on kas (tenant_id, tgl);

create table if not exists kas_tutup (
  id            bigserial primary key,
  tenant_id     bigint not null references tenants(id) on delete cascade,
  tgl           date not null,
  saldo_sistem  bigint not null default 0,  -- saldo tunai menurut sistem saat tutup
  saldo_fisik   bigint not null default 0,  -- hitungan fisik laci
  selisih       bigint not null default 0,  -- fisik - sistem
  catatan       text,
  created_by    bigint references users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (tenant_id, tgl)
);
