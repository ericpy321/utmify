-- Integraciones: productos sin oferta (llegan del webhook antes de que los asignes),
-- conversión de moneda en SQL y totales por anuncio para el Creative Hub.

-- Un producto nuevo que llega por webhook queda "sin asignar" hasta que elijas su oferta y su tipo.
alter table public.products alter column offer_id drop not null;
alter table public.products add column if not exists created_at timestamptz not null default now();

-- La venta guarda su producto aunque todavía no esté asignado a una oferta.
alter table public.sales add column if not exists product_name text;
alter table public.sales add column if not exists product_external_id text;

-- Ventas sin anuncio y con anuncio: búsquedas rápidas.
create index if not exists sales_status_idx on public.sales (status, created_at_utc desc);
create index if not exists sales_parent_idx on public.sales (gateway, parent_order_id);

-- Cotización de 1 unidad de `p_from` en `p_to` para una fecha. Usa el último día conocido;
-- si no hay ninguno anterior, el primero posterior. Null si no hay cotizaciones.
create or replace function public.fx_rate(p_from text, p_to text, p_date date)
returns numeric
language sql
stable
set search_path = public
as $$
  with r as (
    select
      case when p_from = 'USD' then 1 else coalesce(
        (select rate from fx_rates where base = 'USD' and quote = p_from and date <= p_date order by date desc limit 1),
        (select rate from fx_rates where base = 'USD' and quote = p_from and date > p_date order by date asc limit 1)
      ) end as rf,
      case when p_to = 'USD' then 1 else coalesce(
        (select rate from fx_rates where base = 'USD' and quote = p_to and date <= p_date order by date desc limit 1),
        (select rate from fx_rates where base = 'USD' and quote = p_to and date > p_date order by date asc limit 1)
      ) end as rt
  )
  select case when p_from = p_to then 1 when rf is null or rt is null then null else rt / rf end from r;
$$;

-- Totales de toda la vida por anuncio, convertidos a la moneda pedida (para el Creative Hub).
create or replace function public.ad_lifetime_totals(p_currency text)
returns table (ad_id text, spend numeric, revenue numeric, net numeric, sales bigint)
language sql
stable
set search_path = public
as $$
  with s as (
    select ad_id, (hour_utc at time zone 'UTC')::date as d, currency, sum(spend) as amount
    from ad_spend_hourly group by 1, 2, 3
  ), sc as (
    select ad_id, sum(amount * fx_rate(currency, p_currency, d)) as spend from s group by 1
  ), v as (
    select ad_id, (created_at_utc at time zone 'UTC')::date as d, currency,
           sum(gross) as gross, sum(coalesce(net, gross)) as net,
           count(*) filter (where product_kind = 'main') as sales
    from sales where status = 'approved' and ad_id is not null group by 1, 2, 3
  ), vc as (
    select ad_id, sum(gross * fx_rate(currency, p_currency, d)) as revenue,
           sum(net * fx_rate(currency, p_currency, d)) as net, sum(sales) as sales
    from v group by 1
  )
  select coalesce(sc.ad_id, vc.ad_id), coalesce(sc.spend, 0), coalesce(vc.revenue, 0), coalesce(vc.net, 0), coalesce(vc.sales, 0)::bigint
  from sc full join vc on vc.ad_id = sc.ad_id;
$$;

-- Solo el servidor (service role) llama estas funciones.
revoke all on function public.fx_rate(text, text, date) from public, anon, authenticated;
revoke all on function public.ad_lifetime_totals(text) from public, anon, authenticated;
