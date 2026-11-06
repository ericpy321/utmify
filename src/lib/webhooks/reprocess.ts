import "server-only";
import { admin } from "../supabase/admin";
import type { GatewayId } from "../env";
import { adapters } from "./gateways";
import { processEvent } from "./process";

/** Vuelve a procesar eventos guardados (los que tuvieron error, o todos los de un gateway). */
export async function reprocessEvents(opts: { onlyErrors?: boolean; gateway?: GatewayId; limit?: number } = {}) {
  const db = admin();
  let q = db.from("webhook_events").select("id,gateway,transaction_id,payload").eq("signature_valid", true).order("id").limit(opts.limit ?? 500);
  if (opts.onlyErrors !== false) q = q.not("error", "is", null);
  if (opts.gateway) q = q.eq("gateway", opts.gateway);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let ok = 0, failed = 0;
  for (const row of data ?? []) {
    const adapter = adapters[row.gateway as GatewayId];
    if (!adapter) continue;
    const events = adapter.parse(row.payload as Record<string, unknown>);
    const ev = events.find((e) => e.transactionId === row.transaction_id) ?? events[0];
    try {
      await processEvent(row.gateway, ev, row.id);
      await db.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("id", row.id);
      ok++;
    } catch (e) {
      await db.from("webhook_events").update({ error: e instanceof Error ? e.message : String(e) }).eq("id", row.id);
      failed++;
    }
  }
  return { ok, failed };
}
