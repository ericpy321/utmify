-- Esquema inicial del tracker de ventas.
-- Regla general: RLS encendida en TODAS las tablas. Solo los correos de `app_admins` leen y escriben
-- desde el panel. Los webhooks y la sincronización usan la service role en el servidor (salta RLS).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Acceso
-- ---------------------------------------------------------------------------
create table public.app_admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_admins a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Configuración (una sola fila)
-- ---------------------------------------------------------------------------
create table public.settings (
  id smallint primary key default 1 check (id = 1),
  timezone text not null default 'America/Sao_Paulo',
  currency text not null default 'USD',
  language text not null default 'es' check (language in ('es','en','pt')),
  revenue_tax_pct numeric(6,3) not null default 0 check (revenue_tax_pct between 0 and 100),
  ad_spend_tax_pct numeric(6,3) not null default 0 check (ad_spend_tax_pct between 0 and 100),
  cost_per_sale numeric(14,2) not null default 0 check (cost_per_sale >= 0),
  rules jsonb not null default '{"validated":{"sales":10,"roas":1.4},"champion":{"sales":30,"roas":1.4}}',
  naming_pattern text not null default '^([A-Z]{2,4})(\d{2,3})\.G(\d+)\.C(\d+)\.F(\d+)',
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

-- ---------------------------------------------------------------------------
-- Plataformas de anuncios
-- ---------------------------------------------------------------------------
create table public.ad_accounts (
  id text primary key,                         -- id nativo: act_123 (Meta) o advertiser_id (TikTok)
  platform text not null check (platform in ('meta','tiktok')),
  name text not null,
  currency text not null,                      -- moneda de la cuenta (ISO 4217)
  timezone text not null,                      -- zona IANA de la cuenta
  tracked boolean not null default false,      -- la marcas en la pantalla para que el panel la siga
  status text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.campaigns (
  id text primary key,
  account_id text not null references public.ad_accounts(id) on delete cascade,
  platform text not null check (platform in ('meta','tiktok')),
  name text not null,
  status text,
  daily_budget numeric(14,2),
  updated_at timestamptz not null default now()
);
create index on public.campaigns (account_id);

create table public.adsets (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  account_id text not null references public.ad_accounts(id) on delete cascade,
  name text not null,
  status text,
  daily_budget numeric(14,2),
  updated_at timestamptz not null default now()
);
create index on public.adsets (campaign_id);

create table public.ads (
  id text primary key,
  adset_id text not null references public.adsets(id) on delete cascade,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  account_id text not null references public.ad_accounts(id) on delete cascade,
  platform text not null check (platform in ('meta','tiktok')),
  name text not null,
  status text,
  creative_code text,                          -- leído del nombre con settings.naming_pattern
  updated_at timestamptz not null default now()
);
create index on public.ads (adset_id);
create index on public.ads (creative_code);

-- Gasto por anuncio y por hora. La hora se guarda en UTC: se convierte desde el huso de la cuenta al guardar.
create table public.ad_spend_hourly (
  ad_id text not null references public.ads(id) on delete cascade,
  hour_utc timestamptz not null,
  spend numeric(14,4) not null,
  currency text not null,
  impressions bigint,
  clicks bigint,
  synced_at timestamptz not null default now(),
  primary key (ad_id, hour_utc)
);
create index on public.ad_spend_hourly (hour_utc);

-- ---------------------------------------------------------------------------
-- Ofertas y productos
-- ---------------------------------------------------------------------------
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                   -- prefijo en el nombre de anuncios, ej: AT
  name text not null,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('main','bump','upsell1','upsell2','downsell')),
  price numeric(14,2) not null,
  currency text not null,
  gateway text,
  gateway_product_id text,                     -- id del producto en el gateway, para reconocerlo en el webhook
  unique (gateway, gateway_product_id)
);

-- ---------------------------------------------------------------------------
-- Ventas
-- ---------------------------------------------------------------------------
-- Evento bruto del webhook, guardado ANTES de procesar, para poder reprocesar.
create table public.webhook_events (
  id bigint generated always as identity primary key,
  gateway text not null,
  event_type text,
  transaction_id text,
  dedupe_key text not null unique,             -- id de transacción + tipo de evento: evita contar dos veces
  signature_valid boolean not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);
create index on public.webhook_events (gateway, received_at desc);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  gateway text not null,
  transaction_id text not null,
  order_id text not null,
  parent_order_id text,                        -- pedido principal (bumps y upsells)
  offer_id uuid references public.offers(id),
  product_id uuid references public.products(id),
  product_kind text not null default 'main' check (product_kind in ('main','bump','upsell1','upsell2','downsell')),
  status text not null check (status in ('approved','refunded','chargeback')),
  currency text not null,
  gross numeric(14,2) not null,                -- valor bruto
  fee numeric(14,2),                           -- comisión del gateway (null si no la manda)
  net numeric(14,2),                           -- valor líquido recibido (null si no lo manda)
  buyer_email text,
  created_at_utc timestamptz not null,         -- hora de la aprobación del pago
  refunded_at timestamptz,
  platform text check (platform in ('meta','tiktok')),
  campaign_id text,
  adset_id text,
  ad_id text,
  tracking jsonb,                              -- utm, fbclid, ttclid tal como llegaron
  source_page text,
  raw_event_id bigint references public.webhook_events(id),
  updated_at timestamptz not null default now(),
  unique (gateway, transaction_id)
);
create index on public.sales (created_at_utc desc);
create index on public.sales (ad_id);
create index on public.sales (buyer_email, created_at_utc);

create table public.checkout_events (
  id bigint generated always as identity primary key,
  gateway text not null,
  offer_id uuid references public.offers(id),
  created_at_utc timestamptz not null,
  raw_event_id bigint references public.webhook_events(id)
);
create index on public.checkout_events (created_at_utc);

-- ---------------------------------------------------------------------------
-- Cotizaciones por día (se guardan para que el histórico no cambie)
-- ---------------------------------------------------------------------------
create table public.fx_rates (
  date date not null,
  base text not null default 'USD',
  quote text not null,
  rate numeric(18,8) not null check (rate > 0),
  source text not null,
  fetched_at timestamptz not null default now(),
  primary key (date, base, quote)
);

-- ---------------------------------------------------------------------------
-- Creative Hub
-- ---------------------------------------------------------------------------
create table public.batches (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  code text not null,                          -- ej: 08
  created_at date not null default current_date,
  status text not null default 'testing' check (status in ('testing','finished')),
  unique (offer_id, code)
);

create table public.creatives (
  code text primary key,                       -- ej: AT08.G2.C1.F1
  offer_id uuid references public.offers(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  hook int, copy_no int, format int,
  copywriter text,
  editor text,
  notes text
);

-- ---------------------------------------------------------------------------
-- Solo servidor: secretos de integraciones (tokens de TikTok, etc.) y bitácora de sincronización
-- ---------------------------------------------------------------------------
create table public.integration_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table public.sync_runs (
  id bigint generated always as identity primary key,
  source text not null,                        -- meta | tiktok | fx
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  detail text
);

-- ---------------------------------------------------------------------------
-- RLS en todas las tablas
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'app_admins','settings','ad_accounts','campaigns','adsets','ads','ad_spend_hourly','offers','products',
    'webhook_events','sales','checkout_events','fx_rates','batches','creatives','integration_secrets','sync_runs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;

  -- Tablas que el panel lee y edita (solo administradores).
  foreach t in array array[
    'settings','ad_accounts','offers','products','batches','creatives'
  ] loop
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;

  -- Tablas que el panel solo lee (las escribe el servidor).
  foreach t in array array[
    'campaigns','adsets','ads','ad_spend_hourly','webhook_events','sales','checkout_events','fx_rates','sync_runs'
  ] loop
    execute format('create policy admin_read on public.%I for select to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- app_admins: cada admin puede ver que es admin; altas solo desde el SQL Editor.
create policy self_read on public.app_admins for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- integration_secrets: sin políticas => nadie con la clave pública la lee. Solo la service role.
