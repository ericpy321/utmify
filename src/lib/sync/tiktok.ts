import "server-only";
import { tiktokAppId, tiktokSecret } from "../env";
import { admin } from "../supabase/admin";
import { addDays, isValidTimeZone, todayIn, zonedToUtc } from "../time";
import { parseCreativeCode } from "../creative";
import { replaceSpendWindow, upsertChunks } from "./common";

// TikTok API for Business v1.3, solo lectura. El token de largo plazo vive en `integration_secrets`
// (tabla sin políticas RLS: solo el servidor la lee).
const API = "https://business-api.tiktok.com/open_api/v1.3";
const TOKEN_KEY = "tiktok_access_token";

type Json = Record<string, unknown>;

export function tiktokAuthUrl(redirectUri: string, state: string) {
  const u = new URL("https://business-api.tiktok.com/portal/auth");
  u.searchParams.set("app_id", tiktokAppId);
  u.searchParams.set("state", state);
  u.searchParams.set("redirect_uri", redirectUri);
  return u.toString();
}

/** Cambia el auth_code (vale una vez y expira en una hora) por el token de largo plazo. */
export async function exchangeTikTokCode(authCode: string) {
  const res = await fetch(`${API}/oauth2/access_token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: tiktokAppId, secret: tiktokSecret, auth_code: authCode }),
    cache: "no-store",
  });
  const json = (await res.json()) as { code: number; message: string; data?: { access_token?: string; advertiser_ids?: string[] } };
  if (json.code !== 0 || !json.data?.access_token) throw new Error(`TikTok: ${json.message}`);
  await admin().from("integration_secrets").upsert({ key: TOKEN_KEY, value: json.data.access_token, updated_at: new Date().toISOString() });
  return json.data.advertiser_ids ?? [];
}

async function token() {
  const { data } = await admin().from("integration_secrets").select("value").eq("key", TOKEN_KEY).maybeSingle();
  return (data?.value as string) ?? null;
}
export async function tiktokConnected() {
  return Boolean(await token());
}

async function get(path: string, params: Record<string, unknown>, tk: string): Promise<Json> {
  const u = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
  const res = await fetch(u, { headers: { "Access-Token": tk }, cache: "no-store" });
  const json = (await res.json()) as { code: number; message: string; data: Json };
  if (json.code !== 0) throw new Error(`TikTok ${path}: ${json.message} (código ${json.code})`);
  return json.data;
}

async function getAll(path: string, params: Record<string, unknown>, tk: string): Promise<Json[]> {
  const out: Json[] = [];
  for (let page = 1; ; page++) {
    const d = await get(path, { ...params, page, page_size: 1000 }, tk);
    out.push(...((d.list as Json[]) ?? []));
    const info = d.page_info as { total_page?: number } | undefined;
    if (!info?.total_page || page >= info.total_page) break;
  }
  return out;
}

/** Guarda las cuentas autorizadas (sin seguir). Tú eliges en Conectar cuáles seguir. */
export async function discoverTikTokAccounts(advertiserIds?: string[]) {
  const tk = await token();
  if (!tk) throw new Error("TikTok no está conectado");
  let ids = advertiserIds;
  if (!ids?.length) {
    const d = await get("oauth2/advertiser/get/", { app_id: tiktokAppId, secret: tiktokSecret }, tk);
    ids = ((d.list as Json[]) ?? []).map((a) => String(a.advertiser_id));
  }
  if (!ids.length) return 0;
  const info = await get("advertiser/info/", { advertiser_ids: ids, fields: ["advertiser_id", "name", "currency", "timezone", "display_timezone", "status"] }, tk);
  const db = admin();
  const { data: existing } = await db.from("ad_accounts").select("id,tracked").eq("platform", "tiktok");
  const tracked = new Map((existing ?? []).map((a) => [a.id, a.tracked]));
  const rows = ((info.list as Json[]) ?? []).map((a) => {
    const tz = [a.display_timezone, a.timezone].map(String).find((z) => isValidTimeZone(z)) ?? "UTC";
    const id = String(a.advertiser_id);
    return { id, platform: "tiktok", name: String(a.name), currency: String(a.currency), timezone: tz, status: String(a.status ?? ""), tracked: tracked.get(id) ?? false };
  });
  await upsertChunks("ad_accounts", rows, "id");
  return rows.length;
}

const statusOf = (s: unknown) => (s === "ENABLE" ? "active" : "paused");

/** Gasto por anuncio y por hora (en el huso de la cuenta) de los últimos `days` días. Un día por llamada. */
export async function syncTikTokAccount(acc: { id: string; currency: string; timezone: string }, days: number) {
  const tk = await token();
  if (!tk) throw new Error("TikTok no está conectado");
  const until = todayIn(acc.timezone);
  const since = addDays(until, -(days - 1));
  const camps = new Map<string, Json>(), sets = new Map<string, Json>(), ads = new Map<string, Json>();
  const spend: Json[] = [];

  for (let d = since; d <= until; d = addDays(d, 1)) {
    const rows = await getAll("report/integrated/get/", {
      advertiser_id: acc.id, report_type: "BASIC", data_level: "AUCTION_AD",
      dimensions: ["ad_id", "stat_time_hour"],
      metrics: ["spend", "impressions", "clicks", "ad_name", "adgroup_id", "adgroup_name", "campaign_id", "campaign_name"],
      start_date: d, end_date: d,
    }, tk);
    for (const r of rows) {
      const dim = r.dimensions as Json, m = r.metrics as Json;
      const aid = String(dim.ad_id), sid = String(m.adgroup_id), cid = String(m.campaign_id);
      const name = String(m.ad_name ?? aid);
      camps.set(cid, { id: cid, account_id: acc.id, platform: "tiktok", name: String(m.campaign_name ?? cid) });
      sets.set(sid, { id: sid, campaign_id: cid, account_id: acc.id, name: String(m.adgroup_name ?? sid) });
      ads.set(aid, { id: aid, adset_id: sid, campaign_id: cid, account_id: acc.id, platform: "tiktok", name, creative_code: parseCreativeCode(name)?.code ?? null });
      const stamp = String(dim.stat_time_hour); // "YYYY-MM-DD HH:00:00" en el huso de la cuenta
      const value = Number(m.spend ?? 0);
      if (!value && !Number(m.impressions ?? 0)) continue;
      spend.push({
        ad_id: aid, hour_utc: new Date(zonedToUtc(stamp.slice(0, 10), Number(stamp.slice(11, 13)), acc.timezone)).toISOString(),
        spend: value, currency: acc.currency, impressions: Number(m.impressions ?? 0), clicks: Number(m.clicks ?? 0),
        synced_at: new Date().toISOString(),
      });
    }
  }

  // Estado y presupuesto (solo lectura).
  const [cs, ss, as] = await Promise.all([
    getAll("campaign/get/", { advertiser_id: acc.id, fields: ["campaign_id", "campaign_name", "operation_status", "budget", "budget_mode"] }, tk),
    getAll("adgroup/get/", { advertiser_id: acc.id, fields: ["adgroup_id", "adgroup_name", "campaign_id", "operation_status", "budget", "budget_mode"] }, tk),
    getAll("ad/get/", { advertiser_id: acc.id, fields: ["ad_id", "ad_name", "adgroup_id", "campaign_id", "operation_status"] }, tk),
  ]);
  const daily = (x: Json) => (String(x.budget_mode ?? "").includes("DAY") ? Number(x.budget) : null);
  for (const c of cs) camps.set(String(c.campaign_id), { id: String(c.campaign_id), account_id: acc.id, platform: "tiktok", name: String(c.campaign_name), status: statusOf(c.operation_status), daily_budget: daily(c) });
  for (const s of ss) sets.set(String(s.adgroup_id), { id: String(s.adgroup_id), campaign_id: String(s.campaign_id), account_id: acc.id, name: String(s.adgroup_name), status: statusOf(s.operation_status), daily_budget: daily(s) });
  for (const a of as) {
    const name = String(a.ad_name);
    ads.set(String(a.ad_id), { id: String(a.ad_id), adset_id: String(a.adgroup_id), campaign_id: String(a.campaign_id), account_id: acc.id, platform: "tiktok", name, status: statusOf(a.operation_status), creative_code: parseCreativeCode(name)?.code ?? null });
  }
  for (const s of sets.values()) if (!camps.has(String(s.campaign_id))) camps.set(String(s.campaign_id), { id: s.campaign_id, account_id: acc.id, platform: "tiktok", name: String(s.campaign_id) });
  for (const a of ads.values()) if (!sets.has(String(a.adset_id))) sets.set(String(a.adset_id), { id: a.adset_id, campaign_id: a.campaign_id, account_id: acc.id, name: String(a.adset_id) });

  const now = new Date().toISOString();
  await upsertChunks("campaigns", [...camps.values()].map((c) => ({ ...c, updated_at: now })), "id");
  await upsertChunks("adsets", [...sets.values()].map((s) => ({ ...s, updated_at: now })), "id");
  await upsertChunks("ads", [...ads.values()].map((a) => ({ ...a, updated_at: now })), "id");
  await replaceSpendWindow([...ads.keys()], zonedToUtc(since, 0, acc.timezone), zonedToUtc(addDays(until, 1), 0, acc.timezone), spend);
  await admin().from("ad_accounts").update({ last_synced_at: now }).eq("id", acc.id);
  return { account: acc.id, since, until, rows: spend.length };
}
