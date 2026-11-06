import "server-only";
import type { Ad, AdAccount, AdSet, Batch, Campaign, CheckoutEvent, CreativeMeta, Dataset, FxDay, Offer, Platform, Product, ProductKind, Sale, SpendRow } from "./types";
import type { Filters } from "./filters";
import { getSampleDataset } from "./sample-data";
import { serviceConfigured } from "./env";
import { admin, selectAll } from "./supabase/admin";
import { addDays } from "./time";
import { parseCreativeCode } from "./creative";

const num = (v: unknown) => (v == null ? null : Number(v));

/**
 * ¿Ya hay datos reales? Mientras no haya ninguna cuenta seguida ni ninguna venta,
 * el panel muestra el conjunto de EJEMPLO (marcado en pantalla).
 */
export async function isRealMode(): Promise<boolean> {
  if (!serviceConfigured) return false;
  const db = admin();
  const [acc, sales] = await Promise.all([
    db.from("ad_accounts").select("id", { count: "exact", head: true }).eq("tracked", true),
    db.from("sales").select("id", { count: "exact", head: true }),
  ]);
  return (acc.count ?? 0) > 0 || (sales.count ?? 0) > 0;
}

/** Datos para la pantalla. Lee del rango pedido (más el período anterior) para no traer todo el historial. */
export async function getDataset(f: Filters): Promise<Dataset> {
  if (!(await isRealMode())) return getSampleDataset();
  const db = admin();
  // Margen de un día a cada lado: cubre cualquier diferencia de zona horaria con UTC.
  const fromUtc = `${addDays(f.prevFrom, -1)}T00:00:00Z`;
  const toUtc = `${addDays(f.to, 2)}T00:00:00Z`;

  const [accounts, campaigns, adsets, ads, spend, offers, products, sales, checkouts, fx, batches, creatives, runs, lifetime] = await Promise.all([
    selectAll<Record<string, unknown>>((a, b) => db.from("ad_accounts").select("*").eq("tracked", true).range(a, b)),
    selectAll<Record<string, unknown>>((a, b) => db.from("campaigns").select("*").range(a, b)),
    selectAll<Record<string, unknown>>((a, b) => db.from("adsets").select("*").range(a, b)),
    selectAll<Record<string, unknown>>((a, b) => db.from("ads").select("*").range(a, b)),
    selectAll<Record<string, unknown>>((a, b) => db.from("ad_spend_hourly").select("ad_id,hour_utc,spend,impressions,clicks").gte("hour_utc", fromUtc).lt("hour_utc", toUtc).order("hour_utc").range(a, b)),
    selectAll<Record<string, unknown>>((a, b) => db.from("offers").select("*").order("code").range(a, b)),
    selectAll<Record<string, unknown>>((a, b) => db.from("products").select("*").range(a, b)),
    selectAll<Record<string, unknown>>((a, b) => db.from("sales").select("*").gte("created_at_utc", fromUtc).lt("created_at_utc", toUtc).order("created_at_utc", { ascending: false }).range(a, b)),
    selectAll<Record<string, unknown>>((a, b) => db.from("checkout_events").select("created_at_utc,offer_id").gte("created_at_utc", fromUtc).lt("created_at_utc", toUtc).range(a, b)),
    selectAll<Record<string, unknown>>((a, b) => db.from("fx_rates").select("date,quote,rate,source").eq("base", "USD").order("date").range(a, b)),
    selectAll<Record<string, unknown>>((a, b) => db.from("batches").select("*").range(a, b)),
    selectAll<Record<string, unknown>>((a, b) => db.from("creatives").select("*").range(a, b)),
    db.from("sync_runs").select("source,finished_at,ok").eq("ok", true).order("finished_at", { ascending: false }).limit(50),
    db.rpc("ad_lifetime_totals", { p_currency: f.currency }),
  ]);

  const trackedIds = new Set(accounts.map((a) => String(a.id)));
  const accs: AdAccount[] = accounts.map((a) => ({
    id: String(a.id), platform: a.platform as Platform, name: String(a.name), currency: String(a.currency), timezone: String(a.timezone),
  }));
  const camps: Campaign[] = campaigns.filter((c) => trackedIds.has(String(c.account_id))).map((c) => ({
    id: String(c.id), accountId: String(c.account_id), platform: c.platform as Platform, name: String(c.name),
    status: c.status === "active" ? "active" : "paused", dailyBudget: num(c.daily_budget),
  }));
  const sets: AdSet[] = adsets.filter((s) => trackedIds.has(String(s.account_id))).map((s) => ({
    id: String(s.id), campaignId: String(s.campaign_id), accountId: String(s.account_id), name: String(s.name),
    status: s.status === "active" ? "active" : "paused", dailyBudget: num(s.daily_budget),
  }));
  const adList: Ad[] = ads.filter((a) => trackedIds.has(String(a.account_id))).map((a) => ({
    id: String(a.id), adsetId: String(a.adset_id), campaignId: String(a.campaign_id), accountId: String(a.account_id),
    platform: a.platform as Platform, name: String(a.name), status: a.status === "active" ? "active" : "paused",
  }));
  const adById = new Map(adList.map((a) => [a.id, a]));

  const spendRows: SpendRow[] = spend.filter((r) => adById.has(String(r.ad_id))).map((r) => ({
    adId: String(r.ad_id), hourUtc: Date.parse(String(r.hour_utc)), spend: Number(r.spend),
    impressions: Number(r.impressions ?? 0), clicks: Number(r.clicks ?? 0),
  }));

  const offerList: Offer[] = offers.map((o) => ({ id: String(o.id), code: String(o.code), name: String(o.name) }));
  const productList: Product[] = products.map((p) => ({
    id: String(p.id), offerId: String(p.offer_id ?? ""), name: String(p.name), kind: p.kind as ProductKind,
    price: Number(p.price), currency: String(p.currency),
  }));

  const saleList: Sale[] = sales.map((s) => {
    // Si el anuncio ya se sincronizó, completa campaña y conjunto aunque la venta solo traiga el id del anuncio.
    const ad = s.ad_id ? adById.get(String(s.ad_id)) : undefined;
    return {
      id: String(s.id), orderId: String(s.order_id), parentOrderId: (s.parent_order_id as string) ?? null,
      createdAtUtc: Date.parse(String(s.created_at_utc)), offerId: String(s.offer_id ?? ""),
      productId: String(s.product_id ?? ""), productKind: s.product_kind as ProductKind, gateway: String(s.gateway),
      currency: String(s.currency), gross: Number(s.gross), fee: num(s.fee), net: num(s.net),
      status: s.status as Sale["status"], buyerEmail: String(s.buyer_email ?? ""),
      platform: (s.platform as Platform) ?? ad?.platform ?? null,
      campaignId: (s.campaign_id as string) ?? ad?.campaignId ?? null,
      adsetId: (s.adset_id as string) ?? ad?.adsetId ?? null,
      adId: (s.ad_id as string) ?? null,
      sourcePage: (s.source_page as string) ?? null,
      productName: (s.product_name as string) ?? undefined,
    } as Sale;
  });

  const fxByDate = new Map<string, FxDay>();
  for (const r of fx) {
    const d = String(r.date);
    let day = fxByDate.get(d);
    if (!day) fxByDate.set(d, (day = { date: d, source: String(r.source), rates: {} }));
    day.rates[String(r.quote)] = Number(r.rate);
  }

  // Tandas: las que creaste en la pantalla más las que aparecen en los nombres de los anuncios.
  const batchList: Batch[] = batches.map((b) => ({
    offerId: String(b.offer_id), code: String(b.code), createdAt: String(b.created_at), status: b.status === "finished" ? "finished" : "testing",
  }));
  const offerByCode = new Map(offerList.map((o) => [o.code, o.id]));
  const firstSeen = new Map<string, number>();
  for (const r of spendRows) {
    const cc = parseCreativeCode(adById.get(r.adId)!.name);
    if (!cc) continue;
    const k = `${cc.offerCode}|${cc.batch}`;
    firstSeen.set(k, Math.min(firstSeen.get(k) ?? Infinity, r.hourUtc));
  }
  for (const ad of adList) {
    const cc = parseCreativeCode(ad.name);
    const offerId = cc && offerByCode.get(cc.offerCode);
    if (!cc || !offerId || batchList.some((b) => b.offerId === offerId && b.code === cc.batch)) continue;
    const seen = firstSeen.get(`${cc.offerCode}|${cc.batch}`);
    batchList.push({ offerId, code: cc.batch, createdAt: seen ? new Date(seen).toISOString().slice(0, 10) : "—", status: "testing" });
  }

  const creativeList: CreativeMeta[] = creatives.map((c) => ({ code: String(c.code), copywriter: (c.copywriter as string) ?? null, editor: (c.editor as string) ?? null }));
  const checkoutList: CheckoutEvent[] = checkouts.map((c) => ({ createdAtUtc: Date.parse(String(c.created_at_utc)), offerId: String(c.offer_id ?? "") }));

  const okRuns = runs.data ?? [];
  const spendSources = new Set<Platform>();
  for (const a of accounts) if (a.last_synced_at) spendSources.add(a.platform as Platform);
  const lastSync = okRuns.find((r) => r.source === "meta" || r.source === "tiktok")?.finished_at;

  const adLifetime = new Map<string, { spend: number; revenue: number; net: number; sales: number }>();
  for (const r of (lifetime.data ?? []) as Record<string, unknown>[]) {
    if (!adById.has(String(r.ad_id))) continue;
    adLifetime.set(String(r.ad_id), { spend: Number(r.spend ?? 0), revenue: Number(r.revenue ?? 0), net: Number(r.net ?? 0), sales: Number(r.sales ?? 0) });
  }

  return {
    isSample: false,
    lastSyncUtc: lastSync ? Date.parse(lastSync) : null,
    accounts: accs, campaigns: camps, adsets: sets, ads: adList, spend: spendRows, offers: offerList, products: productList,
    sales: saleList, checkouts: checkoutList, fx: [...fxByDate.values()], batches: batchList, creatives: creativeList,
    spendSources: [...spendSources], adLifetime,
  };
}
