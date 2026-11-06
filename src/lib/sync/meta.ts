import "server-only";
import { metaApiVersion, metaToken } from "../env";
import { admin } from "../supabase/admin";
import { addDays, todayIn, zonedToUtc } from "../time";
import { minorFactor } from "../currency";
import { parseCreativeCode } from "../creative";
import { replaceSpendWindow, sleep, upsertChunks } from "./common";

// Meta Marketing API, solo lectura (permiso ads_read) con el token del usuario del sistema.
const BASE = () => `https://graph.facebook.com/${metaApiVersion}`;

type Json = Record<string, unknown>;

async function graph(pathOrUrl: string, params: Record<string, string> = {}, method: "GET" | "POST" = "GET"): Promise<Json> {
  const url = pathOrUrl.startsWith("http") ? new URL(pathOrUrl) : new URL(`${BASE()}/${pathOrUrl.replace(/^\//, "")}`);
  let body: URLSearchParams | undefined;
  if (method === "GET") for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  else body = new URLSearchParams(params);
  // El token viaja en la cabecera, nunca en la URL (así no queda en logs).
  url.searchParams.delete("access_token");
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { method, body, headers: { Authorization: `Bearer ${metaToken}` }, cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as Json;
    const err = json.error as { message?: string; code?: number } | undefined;
    if (!err) return json;
    // 4, 17, 80004: límite de llamadas. Espera y reintenta pocas veces.
    if ([4, 17, 32, 613, 80000, 80004].includes(Number(err.code)) && attempt < 3) {
      await sleep(5000 * (attempt + 1));
      continue;
    }
    throw new Error(`Meta: ${err.message ?? "error"} (código ${err.code})`);
  }
}

async function graphAll(path: string, params: Record<string, string>): Promise<Json[]> {
  const out: Json[] = [];
  let page = await graph(path, params);
  for (;;) {
    out.push(...((page.data as Json[]) ?? []));
    const next = (page.paging as { next?: string } | undefined)?.next;
    if (!next) break;
    page = await graph(next);
  }
  return out;
}

/** Cuentas de anuncio que el token enxerga. Se guardan sin seguir; tú eliges en Conectar cuáles seguir. */
export async function discoverMetaAccounts() {
  if (!metaToken) throw new Error("Falta META_ACCESS_TOKEN");
  const list = await graphAll("me/adaccounts", { fields: "id,name,currency,timezone_name,account_status", limit: "200" });
  const db = admin();
  const { data: existing } = await db.from("ad_accounts").select("id,tracked").eq("platform", "meta");
  const tracked = new Map((existing ?? []).map((a) => [a.id, a.tracked]));
  await upsertChunks("ad_accounts", list.map((a) => ({
    id: String(a.id), platform: "meta", name: String(a.name), currency: String(a.currency),
    timezone: String(a.timezone_name), status: String(a.account_status), tracked: tracked.get(String(a.id)) ?? false,
  })), "id");
  return list.length;
}

const statusOf = (s: unknown) => (s === "ACTIVE" ? "active" : "paused");

/** Sincroniza una cuenta: gasto por anuncio y por hora de los últimos `days` días (en el huso de la cuenta). */
export async function syncMetaAccount(acc: { id: string; currency: string; timezone: string }, days: number) {
  const until = todayIn(acc.timezone);
  const since = addDays(until, -(days - 1));
  const factor = minorFactor(acc.currency);

  // 1) Informe asíncrono: nivel anuncio, un día por fila y la quiebra por hora en el huso de la cuenta.
  const run = await graph(`${acc.id}/insights`, {
    level: "ad",
    fields: "ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks",
    breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone",
    time_range: JSON.stringify({ since, until }),
    time_increment: "1",
    limit: "500",
  }, "POST");
  const runId = String(run.report_run_id ?? "");
  if (!runId) throw new Error("Meta: no devolvió report_run_id");
  for (let i = 0; ; i++) {
    const st = await graph(runId, { fields: "async_status,async_percent_completion" });
    if (st.async_status === "Job Completed") break;
    if (st.async_status === "Job Failed" || st.async_status === "Job Skipped") throw new Error(`Meta: informe ${st.async_status}`);
    if (i > 60) throw new Error("Meta: el informe tardó demasiado");
    await sleep(3000);
  }
  const rows = await graphAll(`${runId}/insights`, { limit: "500" });

  // 2) Entidades vistas en el informe (nombres al día), luego estado y presupuesto.
  const camps = new Map<string, Json>(), sets = new Map<string, Json>(), ads = new Map<string, Json>();
  const spend: Json[] = [];
  for (const r of rows) {
    const cid = String(r.campaign_id), sid = String(r.adset_id), aid = String(r.ad_id);
    camps.set(cid, { id: cid, account_id: acc.id, platform: "meta", name: String(r.campaign_name) });
    sets.set(sid, { id: sid, campaign_id: cid, account_id: acc.id, name: String(r.adset_name) });
    const name = String(r.ad_name);
    ads.set(aid, { id: aid, adset_id: sid, campaign_id: cid, account_id: acc.id, platform: "meta", name, creative_code: parseCreativeCode(name)?.code ?? null });
    const slot = String(r.hourly_stats_aggregated_by_advertiser_time_zone ?? "");
    const hour = Number(slot.slice(0, 2));
    if (!Number.isFinite(hour)) continue;
    spend.push({
      ad_id: aid, hour_utc: new Date(zonedToUtc(String(r.date_start), hour, acc.timezone)).toISOString(),
      spend: Number(r.spend ?? 0), currency: acc.currency,
      impressions: Number(r.impressions ?? 0), clicks: Number(r.clicks ?? 0), synced_at: new Date().toISOString(),
    });
  }

  const [cs, ss, as] = await Promise.all([
    graphAll(`${acc.id}/campaigns`, { fields: "id,name,effective_status,daily_budget", limit: "500" }),
    graphAll(`${acc.id}/adsets`, { fields: "id,name,campaign_id,effective_status,daily_budget", limit: "500" }),
    graphAll(`${acc.id}/ads`, { fields: "id,name,adset_id,campaign_id,effective_status", limit: "500" }),
  ]);
  const budget = (v: unknown) => (v == null || v === "" ? null : Number(v) / factor);
  for (const c of cs) camps.set(String(c.id), { id: String(c.id), account_id: acc.id, platform: "meta", name: String(c.name), status: statusOf(c.effective_status), daily_budget: budget(c.daily_budget) });
  for (const s of ss) sets.set(String(s.id), { id: String(s.id), campaign_id: String(s.campaign_id), account_id: acc.id, name: String(s.name), status: statusOf(s.effective_status), daily_budget: budget(s.daily_budget) });
  for (const a of as) {
    const name = String(a.name);
    ads.set(String(a.id), { id: String(a.id), adset_id: String(a.adset_id), campaign_id: String(a.campaign_id), account_id: acc.id, platform: "meta", name, status: statusOf(a.effective_status), creative_code: parseCreativeCode(name)?.code ?? null });
  }
  // Un conjunto o anuncio puede mencionar una campaña que no vino en la lista (borrada): se crea con su id.
  for (const s of sets.values()) if (!camps.has(String(s.campaign_id))) camps.set(String(s.campaign_id), { id: s.campaign_id, account_id: acc.id, platform: "meta", name: String(s.campaign_id) });
  for (const a of ads.values()) if (!sets.has(String(a.adset_id))) sets.set(String(a.adset_id), { id: a.adset_id, campaign_id: a.campaign_id, account_id: acc.id, name: String(a.adset_id) });

  const now = new Date().toISOString();
  await upsertChunks("campaigns", [...camps.values()].map((c) => ({ ...c, updated_at: now })), "id");
  await upsertChunks("adsets", [...sets.values()].map((s) => ({ ...s, updated_at: now })), "id");
  await upsertChunks("ads", [...ads.values()].map((a) => ({ ...a, updated_at: now })), "id");
  await replaceSpendWindow([...ads.keys()], zonedToUtc(since, 0, acc.timezone), zonedToUtc(addDays(until, 1), 0, acc.timezone), spend);
  await admin().from("ad_accounts").update({ last_synced_at: now }).eq("id", acc.id);
  return { account: acc.id, since, until, rows: spend.length };
}
