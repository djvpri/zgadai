-- =============================================================
-- MIGRATION 015: Manajemen barang jaminan (gudang) — biar tidak hilang.
-- lokasi fisik + status custody + jejak stok opname.
-- =============================================================
alter table barang add column if not exists lokasi          text;
alter table barang add column if not exists status_fisik    text not null default 'disimpan'; -- disimpan | dikembalikan | dilelang | hilang
alter table barang add column if not exists terakhir_opname timestamptz;

-- Barang lama: samakan status fisik dengan status gadai induknya.
update barang b SET status_fisik = 'dikembalikan'
  FROM gadai g WHERE g.id = b.gadai_id AND g.status = 'lunas' AND b.status_fisik = 'disimpan';
update barang b SET status_fisik = 'dilelang'
  FROM gadai g WHERE g.id = b.gadai_id AND g.status = 'lelang' AND b.status_fisik = 'disimpan';

create index if not exists idx_barang_status_fisik on barang (status_fisik);
