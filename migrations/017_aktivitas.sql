-- =============================================================
-- MIGRATION 017: Riwayat Aktivitas (audit log) — siapa melakukan apa.
-- =============================================================
create table if not exists aktivitas (
  id          bigserial primary key,
  tenant_id   bigint not null references tenants(id) on delete cascade,
  user_id     bigint references users(id) on delete set null,
  user_nama   text,                    -- snapshot nama pelaku (tahan walau user dihapus)
  aksi        text not null,           -- kode: gadai.buat, gadai.tebus, kas.entri, dst
  entitas     text,                    -- gadai | nasabah | kas | barang | promo | staf | settings
  ref_id      bigint,                  -- id entitas terkait (utk link)
  ringkasan   text not null,           -- teks siap tampil
  created_at  timestamptz not null default now()
);
create index if not exists idx_aktivitas_tenant on aktivitas (tenant_id, created_at desc);
