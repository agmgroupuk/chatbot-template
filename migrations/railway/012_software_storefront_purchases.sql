create table software_billing_customers (
  user_id uuid primary key references app_users(id) on delete cascade,
  customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table software_billing_profiles (
  user_id uuid primary key references app_users(id) on delete cascade,
  full_name text,
  phone text,
  company_name text,
  billing_name text,
  billing_line1 text,
  billing_line2 text,
  billing_city text,
  billing_state text,
  billing_postal text,
  billing_country text,
  shipping_name text,
  shipping_line1 text,
  shipping_line2 text,
  shipping_city text,
  shipping_state text,
  shipping_postal text,
  shipping_country text,
  shipping_same_as_billing boolean not null default true,
  updated_at timestamptz not null default now()
);

create table software_storefront_purchases (
  id uuid primary key,
  user_id uuid not null references app_users(id) on delete restrict,
  stripe_payment_intent_id text unique,
  item_kind text not null check (item_kind in ('template', 'software')),
  item_id text not null,
  item_name text not null,
  customer_email text not null,
  amount_paid_cents integer not null check (amount_paid_cents >= 500),
  total_price_cents integer not null check (total_price_cents >= amount_paid_cents),
  currency char(3) not null check (currency = 'usd'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  team_notified_at timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index software_storefront_purchases_user_created_idx
  on software_storefront_purchases (user_id, created_at desc);
