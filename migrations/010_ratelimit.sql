-- =============================================================
-- MIGRATION 010: Rate limit sederhana (per IP per hari)
-- Untuk endpoint AI publik (/api/simulasi/taksir).
-- =============================================================
create table if not exists ratelimit (
  ip     text not null,
  hari   date not null default current_date,
  jumlah int  not null default 0,
  primary key (ip, hari)
);
