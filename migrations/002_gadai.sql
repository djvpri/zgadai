-- =============================================================
-- MIGRATION 002: Skema domain Gadai
-- nasabah -> gadai (SBG) -> barang (jaminan) + pembayaran
-- =============================================================

-- ---------- NASABAH ----------
create table if not exists nasabah (
  id          bigserial primary key,
  tenant_id   bigint not null references tenants(id) on delete cascade,
  nama        text not null,
  no_ktp      text,
  no_hp       text,
  alamat      text,
  catatan     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_nasabah_tenant on nasabah (tenant_id);
create index if not exists idx_nasabah_nama on nasabah (tenant_id, lower(nama));

-- ---------- GADAI (Surat Bukti Gadai / pinjaman) ----------
create table if not exists gadai (
  id                bigserial primary key,
  tenant_id         bigint not null references tenants(id) on delete cascade,
  no_sbg            text not null,
  nasabah_id        bigint not null references nasabah(id) on delete restrict,
  tgl_gadai         date not null default current_date,
  tgl_jatuh_tempo   date not null,
  periode_hari      int not null default 15,        -- bunga dihitung per-periode
  bunga_persen      numeric(6,3) not null default 0, -- % per periode
  taksiran          bigint not null default 0,       -- total taksiran barang
  pokok             bigint not null default 0,       -- uang pinjaman (pokok awal)
  pokok_sisa        bigint not null default 0,       -- sisa pokok (berkurang saat cicil)
  biaya_admin       bigint not null default 0,
  status            text not null default 'aktif' check (status in ('aktif','lunas','lelang')),
  keterangan        text,
  tgl_lunas         date,
  created_by        bigint references users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, no_sbg)
);
create index if not exists idx_gadai_tenant on gadai (tenant_id);
create index if not exists idx_gadai_status on gadai (tenant_id, status);
create index if not exists idx_gadai_jatuh_tempo on gadai (tenant_id, tgl_jatuh_tempo);
create index if not exists idx_gadai_nasabah on gadai (nasabah_id);

-- ---------- BARANG JAMINAN ----------
create table if not exists barang (
  id          bigserial primary key,
  gadai_id    bigint not null references gadai(id) on delete cascade,
  jenis       text not null default 'lainnya', -- emas/elektronik/kendaraan/lainnya
  nama        text not null,
  deskripsi   text,
  berat_gram  numeric(10,2),
  kadar       text,
  taksiran    bigint not null default 0,
  foto_url    text
);
create index if not exists idx_barang_gadai on barang (gadai_id);

-- ---------- PEMBAYARAN (perpanjang / cicil / tebus) ----------
create table if not exists pembayaran (
  id              bigserial primary key,
  tenant_id       bigint not null references tenants(id) on delete cascade,
  gadai_id        bigint not null references gadai(id) on delete cascade,
  tgl             date not null default current_date,
  jenis           text not null check (jenis in ('perpanjang','cicil','tebus')),
  bunga_dibayar   bigint not null default 0,
  pokok_dibayar   bigint not null default 0,
  denda_dibayar   bigint not null default 0,
  total           bigint not null default 0,
  jatuh_tempo_baru date,
  keterangan      text,
  created_by      bigint references users(id),
  created_at      timestamptz not null default now()
);
create index if not exists idx_pembayaran_gadai on pembayaran (gadai_id);
create index if not exists idx_pembayaran_tenant on pembayaran (tenant_id, tgl);
