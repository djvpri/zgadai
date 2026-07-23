-- =============================================================
-- MIGRATION 001: Auth & Multi-Tenancy (tenants / users / sessions)
-- =============================================================

create table if not exists tenants (
  id            bigserial primary key,
  nama_usaha    text not null,
  slug          text unique not null,
  owner_name    text,
  owner_email   text unique not null,
  owner_phone   text,
  alamat        text,
  is_active     boolean not null default true,
  settings      jsonb default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists users (
  id            bigserial primary key,
  tenant_id     bigint references tenants(id) on delete cascade,
  email         text unique not null,
  password_hash text,
  nama          text not null,
  role          text not null default 'kasir' check (role in ('admin','kasir')),
  is_active     boolean not null default true,
  last_login    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_users_email on users (email);
create index if not exists idx_users_tenant on users (tenant_id);

create table if not exists sessions (
  id            text primary key,
  user_id       bigint not null references users(id) on delete cascade,
  tenant_id     bigint not null references tenants(id) on delete cascade,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_sessions_expires on sessions (expires_at);
