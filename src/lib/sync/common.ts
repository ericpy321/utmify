import "server-only";
import { admin } from "../supabase/admin";

/** Inserta o actualiza en tandas de 500 filas (límite cómodo para la API de Supabase). */
export async function upsertChunks(table: string, rows: Record<string, unknown>[], onConflict: string) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin().from(table).upsert(rows.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

/** Registra cada sincronización en `sync_runs` para mostrar la última hora y los errores. */
export async function logRun<T>(source: string, fn: () => Promise<T>): Promise<{ ok: boolean; detail: string; result?: T }> {
  const db = admin();
  const { data } = await db.from("sync_runs").insert({ source }).select("id").single();
  try {
    const result = await fn();
    const detail = typeof result === "string" ? result : JSON.stringify(result);
    await db.from("sync_runs").update({ finished_at: new Date().toISOString(), ok: true, detail: detail.slice(0, 2000) }).eq("id", data?.id);
    return { ok: true, detail, result };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await db.from("sync_runs").update({ finished_at: new Date().toISOString(), ok: false, detail: detail.slice(0, 2000) }).eq("id", data?.id);
    return { ok: false, detail };
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Reemplaza el gasto de esos anuncios en la ventana [desde, hasta): borra y vuelve a escribir. */
export async function replaceSpendWindow(adIds: string[], fromUtcMs: number, toUtcMs: number, rows: Record<string, unknown>[]) {
  const db = admin();
  const from = new Date(fromUtcMs).toISOString();
  const to = new Date(toUtcMs).toISOString();
  for (let i = 0; i < adIds.length; i += 100) {
    const { error } = await db.from("ad_spend_hourly").delete().in("ad_id", adIds.slice(i, i + 100)).gte("hour_utc", from).lt("hour_utc", to);
    if (error) throw new Error(`ad_spend_hourly: ${error.message}`);
  }
  await upsertChunks("ad_spend_hourly", rows, "ad_id,hour_utc");
}
