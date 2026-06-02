-- Voyager — initial schema (CLAUDE.md §6)
-- Transaction-ledger model: store immutable transactions, reconstruct holdings on demand.
-- RLS is enabled on every user-scoped table. No exceptions.

-- ─── portfolios ──────────────────────────────────────────────────────────────
create table if not exists portfolios (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  name               text not null,
  currency           text not null default 'EUR',
  target_allocations jsonb,
  created_at         timestamptz not null default now()
);

-- ─── transactions (the immutable ledger) ─────────────────────────────────────
create table if not exists transactions (
  id                 uuid primary key default gen_random_uuid(),
  portfolio_id       uuid not null references portfolios (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,

  type               text not null,        -- buy|sell|dividend|deposit|withdrawal|fee|reward|tax_refund|interest
  asset_class        text,                 -- stock|etf|bond|crypto|cash|null

  isin               text,                 -- from broker import, e.g. 'US5949181045'
  ticker             text,                 -- resolved lazily via OpenFIGI

  quantity           numeric,
  price              numeric,
  amount             numeric,
  fee                numeric,
  tax                numeric,

  currency           text not null,
  original_amount    numeric,
  original_currency  text,
  fx_rate            numeric,

  date               date not null,
  datetime           timestamptz not null,

  broker             text,                 -- trade_republic|scalable|ing|dkb|manual|null
  external_id        text,                 -- broker's own transaction id — dedup key
  notes              text,
  created_at         timestamptz not null default now()
);

-- Idempotent re-import: unique per (user, broker, external_id) (CLAUDE.md §8.5)
alter table transactions
  add constraint transactions_external_id_unique
  unique (user_id, broker, external_id);

create index if not exists transactions_portfolio_idx on transactions (portfolio_id);
create index if not exists transactions_isin_idx on transactions (isin);

-- ─── isin_ticker_map (market data, no PII — shared across users) ──────────────
create table if not exists isin_ticker_map (
  isin        text primary key,
  ticker      text not null,
  exchange    text,
  resolved_at timestamptz not null default now(),
  source      text not null default 'openfigi'  -- openfigi|manual
);

-- ─── price_cache ─────────────────────────────────────────────────────────────
create table if not exists price_cache (
  ticker     text not null,
  date       date not null,
  open       numeric,
  high       numeric,
  low        numeric,
  close      numeric,
  volume     numeric,
  currency   text,
  source     text,
  fetched_at timestamptz not null default now(),
  primary key (ticker, date)
);

-- ─── alerts ──────────────────────────────────────────────────────────────────
create table if not exists alerts (
  id                uuid primary key default gen_random_uuid(),
  portfolio_id      uuid not null references portfolios (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  type              text not null,   -- drift|performance|volatility|news
  config            jsonb not null,
  last_triggered_at timestamptz,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

-- ─── widget_instances + dashboard_layouts ────────────────────────────────────
create table if not exists widget_instances (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null,         -- must match a key in WIDGET_REGISTRY (app-level validation)
  config     jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists dashboard_layouts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  widget_instance_id uuid not null references widget_instances (id) on delete cascade,
  x                  integer not null,
  y                  integer not null,
  w                  integer not null,
  h                  integer not null,
  breakpoint         text not null default 'lg',  -- lg|md|sm
  updated_at         timestamptz not null default now()
);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Every user-scoped table: users can only access their own rows (CLAUDE.md §6).
alter table portfolios        enable row level security;
alter table transactions      enable row level security;
alter table alerts            enable row level security;
alter table widget_instances  enable row level security;
alter table dashboard_layouts enable row level security;

create policy "own portfolios"        on portfolios        for all using (auth.uid() = user_id);
create policy "own transactions"      on transactions      for all using (auth.uid() = user_id);
create policy "own alerts"            on alerts            for all using (auth.uid() = user_id);
create policy "own widget_instances"  on widget_instances  for all using (auth.uid() = user_id);
create policy "own dashboard_layouts" on dashboard_layouts for all using (auth.uid() = user_id);

-- isin_ticker_map and price_cache hold only public market data (no PII) and are
-- intentionally readable by all authenticated users; writes happen server-side.
