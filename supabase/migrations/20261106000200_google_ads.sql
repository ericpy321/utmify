-- Google Ads como tercera plataforma de anuncios.
alter table public.ad_accounts drop constraint if exists ad_accounts_platform_check;
alter table public.ad_accounts add constraint ad_accounts_platform_check check (platform in ('meta','tiktok','google'));
alter table public.campaigns drop constraint if exists campaigns_platform_check;
alter table public.campaigns add constraint campaigns_platform_check check (platform in ('meta','tiktok','google'));
alter table public.ads drop constraint if exists ads_platform_check;
alter table public.ads add constraint ads_platform_check check (platform in ('meta','tiktok','google'));
alter table public.sales drop constraint if exists sales_platform_check;
alter table public.sales add constraint sales_platform_check check (platform in ('meta','tiktok','google'));

-- Cuenta administradora (MCC) por la que se accede a la cuenta de Google Ads, si la hay.
alter table public.ad_accounts add column if not exists login_customer_id text;
