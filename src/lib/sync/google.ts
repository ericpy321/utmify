import "server-only";
import { googleApiVersion, googleClientId, googleClientSecret, googleDevToken, googleLoginCustomerId } from "../env";
import { admin } from "../supabase/admin";
import { addDays, isValidTimeZone, todayIn, zonedToUtc } from "../time";
import { parseCreativeCode } from "../creative";
import { replaceSpendWindow, upsertChunks } from "./common";

// Google Ads API (REST), solo lectura. El refresh token de la autorización vive en `integration_secrets`.
const TOKEN_KEY = "google_refresh_token";
const API = () => `https://googleads.googleapis.com/${googleApiVersion}`;
type Json = Record<string, unknown>;

export function googleAuthUrl(redirectUri: string, state: string) {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", googleClientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "https://www.googleapis.com/auth/adwords");
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent"); // asegura que Google entregue el refresh token
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: googleClientId, client_secret: googleClientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    cache: "no-store",
  });
  const json = (await res.json()) as { refresh_token?: string; error?: string; error_description?: string };
  if (!json.refresh_token) throw new Error(`Google: ${json.error_description ?? json.error ?? "sin refresh token"}`);
  await admin().from("integration_secrets").upsert({ key: TOKEN_KEY, value: json.refresh_token, updated_at: new Date().toISOString() });
}

export async function googleConnected() {
  const { data } = await admin().from("integration_secrets").select("key").eq("key", TOKEN_KEY).maybeSingle();
  return Boolean(data);
}

let cached: { token: string; exp: number } | null = null;
async function accessToken() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const { data } = await admin().from("integration_secrets").select("value").eq("key", TOKEN_KEY).maybeSingle();
  if (!data?.value) throw new Error("Google Ads no está conectado");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: String(data.value), client_id: googleClientId, client_secret: googleClientSecret, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!json.access_token) throw new Error(`Google: ${json.error_description ?? "no se pudo renovar el acceso"}`);
  cached = { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

async function headers(loginCustomerId?: string | null) {
  const h: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
    "developer-token": googleDevToken,
    "Content-Type": "application/json",
  };
  const login = loginCustomerId || googleLoginCustomerId;
  if (login) h["login-customer-id"] = login;
  return h;
}

function apiError(json: Json) {
  const e = json.error as { message?: string; details?: { errors?: { message?: string }[] }[] } | undefined;
  return e?.details?.[0]?.errors?.[0]?.message ?? e?.message ?? "error";
}

/** Consulta GAQL con paginación. */
async function search(customerId: string, query: string, login?: string | null): Promise<Json[]> {
  const out: Json[] = [];
  let pageToken: string | undefined;
  do {
    const res = await fetch(`${API()}/customers/${customerId}/googleAds:search`, {
      method: "POST", headers: await headers(login), body: JSON.stringify({ query, ...(pageToken ? { pageToken } : {}) }), cache: "no-store",
    });
    const json = (await res.json()) as Json;
    if (!res.ok) throw new Error(`Google Ads ${customerId}: ${apiError(json)}`);
    out.push(...((json.results as Json[]) ?? []));
    pageToken = json.nextPageToken as string | undefined;
  } while (pageToken);
  return out;
}

const g = (o: unknown, path: string): unknown => path.split(".").reduce<unknown>((c, k) => (c && typeof c === "object" ? (c as Json)[k] : undefined), o);

/** Cuentas accesibles: las directas y, si alguna es administradora (MCC), sus cuentas hijas. Se guardan sin seguir. */
export async function discoverGoogleAccounts() {
  const res = await fetch(`${API()}/customers:listAccessibleCustomers`, { headers: await headers(null), cache: "no-store" });
  const json = (await res.json()) as Json;
  if (!res.ok) throw new Error(`Google Ads: ${apiError(json)}`);
  const ids = ((json.resourceNames as string[]) ?? []).map((r) => r.split("/")[1]);
  const found = new Map<string, Json>();
  for (const id of ids) {
    try {
      const rows = await search(id, "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.manager, customer_client.status FROM customer_client WHERE customer_client.level <= 1", id);
      for (const r of rows) {
        const c = r.customerClient as Json;
        if (c.manager) continue; // las MCC no tienen gasto propio
        const cid = String(c.id);
        if (!found.has(cid)) found.set(cid, { ...c, login: cid === id ? null : id });
      }
    } catch {
      // Cuenta sin permiso o cancelada: se omite.
    }
  }
  const db = admin();
  const { data: existing } = await db.from("ad_accounts").select("id,tracked").eq("platform", "google");
  const tracked = new Map((existing ?? []).map((a) => [a.id, a.tracked]));
  const rows = [...found.entries()].map(([id, c]) => ({
    id, platform: "google", name: String(c.descriptiveName ?? id), currency: String(c.currencyCode ?? "USD"),
    timezone: isValidTimeZone(String(c.timeZone)) ? String(c.timeZone) : "UTC", status: String(c.status ?? ""),
    login_customer_id: (c.login as string) ?? null, tracked: tracked.get(id) ?? false,
  }));
  await upsertChunks("ad_accounts", rows, "id");
  return rows.length;
}

const statusOf = (s: unknown) => (s === "ENABLED" ? "active" : "paused");

/** Gasto por anuncio y por hora (huso de la cuenta). Performance Max no tiene anuncios: se toma por campaña. */
export async function syncGoogleAccount(acc: { id: string; currency: string; timezone: string; login_customer_id?: string | null }, days: number) {
  const until = todayIn(acc.timezone);
  const since = addDays(until, -(days - 1));
  const login = acc.login_customer_id ?? null;
  const camps = new Map<string, Json>(), sets = new Map<string, Json>(), ads = new Map<string, Json>();
  const spend: Json[] = [];
  const pushSpend = (adId: string, r: Json) => {
    const cost = Number(g(r, "metrics.costMicros") ?? 0) / 1e6;
    const imp = Number(g(r, "metrics.impressions") ?? 0);
    if (!cost && !imp) return;
    spend.push({
      ad_id: adId, hour_utc: new Date(zonedToUtc(String(g(r, "segments.date")), Number(g(r, "segments.hour") ?? 0), acc.timezone)).toISOString(),
      spend: cost, currency: acc.currency, impressions: imp, clicks: Number(g(r, "metrics.clicks") ?? 0), synced_at: new Date().toISOString(),
    });
  };

  const adRows = await search(acc.id, `SELECT campaign.id, campaign.name, campaign.status, ad_group.id, ad_group.name, ad_group.status, ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status, segments.date, segments.hour, metrics.cost_micros, metrics.impressions, metrics.clicks FROM ad_group_ad WHERE segments.date BETWEEN '${since}' AND '${until}' AND metrics.impressions > 0`, login);
  for (const r of adRows) {
    const cid = String(g(r, "campaign.id")), sid = String(g(r, "adGroup.id")), aid = String(g(r, "adGroupAd.ad.id"));
    const setName = String(g(r, "adGroup.name") ?? sid);
    // Los anuncios responsivos suelen no tener nombre: se usa el del grupo + id.
    const name = String(g(r, "adGroupAd.ad.name") || `${setName} · ${aid}`);
    camps.set(cid, { id: cid, account_id: acc.id, platform: "google", name: String(g(r, "campaign.name")), status: statusOf(g(r, "campaign.status")) });
    sets.set(sid, { id: sid, campaign_id: cid, account_id: acc.id, name: setName, status: statusOf(g(r, "adGroup.status")) });
    ads.set(aid, { id: aid, adset_id: sid, campaign_id: cid, account_id: acc.id, platform: "google", name, status: statusOf(g(r, "adGroupAd.status")), creative_code: parseCreativeCode(name)?.code ?? null });
    pushSpend(aid, r);
  }

  const pmax = await search(acc.id, `SELECT campaign.id, campaign.name, campaign.status, segments.date, segments.hour, metrics.cost_micros, metrics.impressions, metrics.clicks FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}' AND campaign.advertising_channel_type = 'PERFORMANCE_MAX' AND metrics.impressions > 0`, login);
  for (const r of pmax) {
    const cid = String(g(r, "campaign.id")), name = String(g(r, "campaign.name"));
    const vid = `pmax-${cid}`; // conjunto y anuncio virtuales que representan a la campaña
    camps.set(cid, { id: cid, account_id: acc.id, platform: "google", name, status: statusOf(g(r, "campaign.status")) });
    sets.set(vid, { id: vid, campaign_id: cid, account_id: acc.id, name: `${name} (Performance Max)`, status: statusOf(g(r, "campaign.status")) });
    ads.set(vid, { id: vid, adset_id: vid, campaign_id: cid, account_id: acc.id, platform: "google", name: `${name} (Performance Max)`, status: statusOf(g(r, "campaign.status")), creative_code: parseCreativeCode(name)?.code ?? null });
    pushSpend(vid, r);
  }

  // Presupuesto diario de las campañas (solo lectura).
  const budgets = await search(acc.id, "SELECT campaign.id, campaign_budget.amount_micros FROM campaign WHERE campaign.status != 'REMOVED'", login);
  for (const r of budgets) {
    const c = camps.get(String(g(r, "campaign.id")));
    if (c) c.daily_budget = Number(g(r, "campaignBudget.amountMicros") ?? 0) / 1e6 || null;
  }

  const now = new Date().toISOString();
  await upsertChunks("campaigns", [...camps.values()].map((c) => ({ daily_budget: null, ...c, updated_at: now })), "id");
  await upsertChunks("adsets", [...sets.values()].map((s) => ({ ...s, updated_at: now })), "id");
  await upsertChunks("ads", [...ads.values()].map((a) => ({ ...a, updated_at: now })), "id");
  await replaceSpendWindow([...ads.keys()], zonedToUtc(since, 0, acc.timezone), zonedToUtc(addDays(until, 1), 0, acc.timezone), spend);
  await admin().from("ad_accounts").update({ last_synced_at: now }).eq("id", acc.id);
  return { account: acc.id, since, until, rows: spend.length };
}
