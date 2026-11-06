import "server-only";
import { admin } from "../supabase/admin";
import { metaToken } from "../env";
import { logRun } from "./common";
import { syncFx } from "./fx";
import { syncMetaAccount } from "./meta";
import { syncTikTokAccount } from "./tiktok";
import { syncGoogleAccount } from "./google";

/**
 * Sincronización completa: cotización del día y gasto de cada cuenta seguida (Meta, TikTok y Google Ads).
 * Repite los últimos 3 días porque Meta (y TikTok) siguen ajustando el gasto reciente.
 * La primera vez que se sincroniza una cuenta trae 14 días.
 */
export async function runSync() {
  const results: { source: string; ok: boolean; detail: string }[] = [];
  const fx = await logRun("fx", syncFx);
  results.push({ source: "fx", ...fx });

  const { data: accounts } = await admin().from("ad_accounts").select("id,platform,currency,timezone,last_synced_at,login_customer_id").eq("tracked", true);
  for (const acc of accounts ?? []) {
    const days = acc.last_synced_at ? 3 : 14;
    if (acc.platform === "meta") {
      if (!metaToken) { results.push({ source: `meta ${acc.id}`, ok: false, detail: "Falta META_ACCESS_TOKEN" }); continue; }
      const r = await logRun("meta", () => syncMetaAccount(acc, days));
      results.push({ source: `meta ${acc.id}`, ok: r.ok, detail: r.detail });
    } else if (acc.platform === "google") {
      const r = await logRun("google", () => syncGoogleAccount(acc, days));
      results.push({ source: `google ${acc.id}`, ok: r.ok, detail: r.detail });
    } else {
      const r = await logRun("tiktok", () => syncTikTokAccount(acc, days));
      results.push({ source: `tiktok ${acc.id}`, ok: r.ok, detail: r.detail });
    }
  }
  return results;
}
