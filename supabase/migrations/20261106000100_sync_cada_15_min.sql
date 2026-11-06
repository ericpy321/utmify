-- Sincronización cada 15 minutos (gasto de Meta/TikTok y cotización del día).
-- pg_cron agenda y pg_net llama a /api/sync del panel con el secreto guardado en el Vault.
-- El secreto se crea aparte (no se versiona):  select vault.create_secret('<valor de SYNC_SECRET>', 'sync_secret');
-- y la URL del panel también:                select vault.create_secret('https://TU-DOMINIO', 'panel_url');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'tracker-sync';
select cron.schedule(
  'tracker-sync',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'panel_url') || '/api/sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'sync_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);
