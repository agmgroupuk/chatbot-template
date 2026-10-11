create schema if not exists ofs_store;

create table if not exists ofs_store.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (length(email) between 3 and 254),
  password_hash text not null,
  accepted_terms_at timestamptz not null,
  terms_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ofs_store.sessions (
  token_hash char(64) primary key,
  user_id uuid not null references ofs_store.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists ofs_store_sessions_user_expiry_idx on ofs_store.sessions(user_id, expires_at);

create table if not exists ofs_store.password_reset_tokens (
  token_hash char(64) primary key,
  user_id uuid not null references ofs_store.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists ofs_store_password_reset_user_idx on ofs_store.password_reset_tokens(user_id, expires_at);

create table if not exists ofs_store.auth_rate_limits (
  key_hash char(64) primary key,
  attempts integer not null check (attempts > 0),
  expires_at timestamptz not null
);
