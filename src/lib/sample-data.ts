// Generador de datos de EJEMPLO. Determinista: la misma hora siempre produce los mismos números,
// así la pantalla no "baila" entre recargas. Nada de esto es real y la UI lo marca como "ejemplo".
import type {
  Ad, AdAccount, AdSet, Batch, Campaign, CheckoutEvent, CreativeMeta, Dataset, FxDay,
  Offer, Product, ProductKind, Sale, SaleStatus, SpendRow,
} from "./types";
import { DAY, HOUR, localParts } from "./time";

// --- PRNG determinista ---------------------------------------------------------------
function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 0x9e3779b9;
  }
  return h >>> 0;
}
function rngFrom(seed: number) {
  let a = seed || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function poisson(lambda: number, r: () => number) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > L && k < 50);
  return k - 1;
}

// --- Catálogo fijo de ejemplo ----------------------------------------------------------
const offers: Offer[] = [
  { id: "off_at", code: "AT", name: "Atlas" },
  { id: "off_nv", code: "NV", name: "Nova" },
];

const products: Product[] = [
  { id: "p_at_main", offerId: "off_at", name: "Atlas · Principal", kind: "main", price: 47, currency: "USD" },
  { id: "p_at_bump", offerId: "off_at", name: "Atlas · Order bump", kind: "bump", price: 17, currency: "USD" },
  { id: "p_at_up1", offerId: "off_at", name: "Atlas · Upsell 1", kind: "upsell1", price: 97, currency: "USD" },
  { id: "p_at_up2", offerId: "off_at", name: "Atlas · Upsell 2", kind: "upsell2", price: 67, currency: "USD" },
  { id: "p_at_down", offerId: "off_at", name: "Atlas · Downsell", kind: "downsell", price: 37, currency: "USD" },
  { id: "p_nv_main", offerId: "off_nv", name: "Nova · Principal", kind: "main", price: 197, currency: "BRL" },
  { id: "p_nv_bump", offerId: "off_nv", name: "Nova · Order bump", kind: "bump", price: 37, currency: "BRL" },
  { id: "p_nv_up1", offerId: "off_nv", name: "Nova · Upsell 1", kind: "upsell1", price: 297, currency: "BRL" },
  { id: "p_nv_up2", offerId: "off_nv", name: "Nova · Upsell 2", kind: "upsell2", price: 147, currency: "BRL" },
  { id: "p_nv_down", offerId: "off_nv", name: "Nova · Downsell", kind: "downsell", price: 97, currency: "BRL" },
];

const accounts: AdAccount[] = [
  { id: "act_1001", platform: "meta", name: "BM Principal · USD", currency: "USD", timezone: "America/New_York" },
  { id: "act_2002", platform: "meta", name: "BM Brasil · BRL", currency: "BRL", timezone: "America/Sao_Paulo" },
  { id: "tt_7003", platform: "tiktok", name: "TikTok Ads · USD", currency: "USD", timezone: "America/Mexico_City" },
];

// Tandas: [oferta, código, hace cuántos días se subió]
const batchPlan: [string, string, number][] = [
  ["off_at", "05", 56], ["off_at", "06", 46], ["off_at", "07", 36],
  ["off_at", "08", 26], ["off_at", "09", 16], ["off_at", "10", 5],
  ["off_nv", "03", 50], ["off_nv", "04", 30], ["off_nv", "05", 9],
];

const COPYWRITERS = ["Ana", "Bruno", "Carla", "Diego"];
const EDITORS = ["Equipo A", "Equipo B", "Freelancer", "Lucas"];
const SOURCE_PAGES = ["quiz/paso-3", "vsl/sin-boton", "advertorial/v2"];

const BASE_FX: Record<string, number> = {
  BRL: 5.45, PYG: 7900, UYU: 40.2, BOB: 6.91, EUR: 0.93, MXN: 18.6, COP: 4050, ARS: 1080, CLP: 945, PEN: 3.76, GBP: 0.79,
};

let cache: { builtAtHour: number; data: Dataset } | null = null;

export function getSampleDataset(nowMs = Date.now()): Dataset {
  const nowHour = Math.floor(nowMs / HOUR) * HOUR;
  if (cache && cache.builtAtHour === nowHour) return cache.data;
  const data = build(nowMs);
  cache = { builtAtHour: nowHour, data };
  return data;
}

function build(nowMs: number): Dataset {
  const todayUtc = Math.floor(nowMs / DAY) * DAY;
  const windowStart = todayUtc - 62 * DAY;
  const offerById = new Map(offers.map((o) => [o.id, o]));
  const fxDays: FxDay[] = [];
  for (let t = windowStart - 3 * DAY; t <= todayUtc; t += DAY) {
    const date = new Date(t).toISOString().slice(0, 10);
    const dayN = t / DAY;
    const rates: Record<string, number> = {};
    for (const [cur, base] of Object.entries(BASE_FX)) {
      const drift = 1 + 0.02 * Math.sin(dayN / 9 + hash(cur) % 7) + 0.004 * Math.sin(dayN * 1.7);
      rates[cur] = Number((base * drift).toPrecision(6));
    }
    fxDays.push({ date, source: "ejemplo", rates });
  }
  const usdRate = (cur: string, t: number) => {
    if (cur === "USD") return 1;
    const date = new Date(Math.floor(t / DAY) * DAY).toISOString().slice(0, 10);
    const d = fxDays.find((f) => f.date === date) ?? fxDays[fxDays.length - 1];
    return d.rates[cur];
  };

  const batches: Batch[] = [];
  const creatives: CreativeMeta[] = [];
  const campaigns: Campaign[] = [];
  const adsets: AdSet[] = [];
  const ads: Ad[] = [];
  const spend: SpendRow[] = [];
  const sales: Sale[] = [];
  const checkouts: CheckoutEvent[] = [];

  // Calidad de cada creativo: multiplica la tasa de conversión. >1 = rentable.
  const quality = new Map<string, number>();
  // Creativos que pasan a campañas de escala, con la fecha desde la que escalan.
  const scaleCandidates: { offerId: string; code: string; from: number }[] = [];

  for (const [offerId, code, daysAgo] of batchPlan) {
    const offer = offerById.get(offerId)!;
    const startT = todayUtc - daysAgo * DAY;
    batches.push({
      offerId,
      code,
      createdAt: new Date(startT).toISOString().slice(0, 10),
      status: daysAgo > 12 ? "finished" : "testing",
    });
    const r = rngFrom(hash("batch", offerId, code));
    const n = 6 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const g = 1 + Math.floor(r() * 4);
      const c = 1 + Math.floor(r() * 3);
      const f = 1 + (i % 3);
      const ccode = `${offer.code}${code}.G${g}.C${c}.F${f}`;
      if (creatives.some((x) => x.code === ccode)) continue;
      const roll = r();
      const q = roll > 0.86 ? 1.25 + r() * 0.5 : roll > 0.62 ? 0.95 + r() * 0.3 : 0.35 + r() * 0.5;
      quality.set(ccode, q);
      creatives.push({
        code: ccode,
        copywriter: COPYWRITERS[Math.floor(r() * COPYWRITERS.length)],
        editor: r() > 0.1 ? EDITORS[Math.floor(r() * EDITORS.length)] : null,
      });
      if (q > 1.2 && daysAgo > 12) scaleCandidates.push({ offerId, code: ccode, from: startT + 10 * DAY });
    }
  }

  // Dónde corre cada oferta.
  const placements: Record<string, { accountId: string; fromBatch?: string }[]> = {
    off_at: [{ accountId: "act_1001" }, { accountId: "tt_7003", fromBatch: "07" }],
    off_nv: [{ accountId: "act_2002" }, { accountId: "tt_7003", fromBatch: "05" }],
  };

  interface AdPlan { ad: Ad; code: string; offerId: string; from: number; to: number; budgetUsd: number }
  const plans: AdPlan[] = [];
  const accById = new Map(accounts.map((a) => [a.id, a]));

  for (const b of batches) {
    const offer = offerById.get(b.offerId)!;
    const startT = Date.parse(b.createdAt + "T00:00:00Z");
    for (const pl of placements[b.offerId]) {
      if (pl.fromBatch && b.code < pl.fromBatch) continue;
      const acc = accById.get(pl.accountId)!;
      const short = acc.platform === "meta" ? "fb" : "tt";
      const campId = `${short}_c_${offer.code}${b.code}_${acc.id}`;
      const finished = b.status === "finished";
      campaigns.push({
        id: campId, accountId: acc.id, platform: acc.platform,
        name: `${offer.code}${b.code} | TESTE | ABO`, status: finished ? "paused" : "active", dailyBudget: null,
      });
      const sets = ["Broad", "Intereses"].map((nm, k) => {
        const s: AdSet = {
          id: `${campId}_s${k}`, campaignId: campId, accountId: acc.id, name: `${offer.code}${b.code} · ${nm}`,
          status: finished ? "paused" : "active",
          dailyBudget: acc.currency === "BRL" ? 250 : 50,
        };
        adsets.push(s);
        return s;
      });
      const batchCreatives = creatives.filter((c) => c.code.startsWith(`${offer.code}${b.code}.`));
      batchCreatives.forEach((cr, k) => {
        const set = sets[k % 2];
        const q = quality.get(cr.code)!;
        const runDays = q < 0.6 ? 3 : q < 0.95 ? 6 : 999;
        const to = Math.min(nowMs, startT + runDays * DAY);
        const ad: Ad = {
          id: `${set.id}_a${k}`, adsetId: set.id, campaignId: campId, accountId: acc.id, platform: acc.platform,
          name: `${cr.code} | ${acc.platform === "meta" ? "Reels" : "InFeed"}`,
          status: to >= nowMs && !finished ? "active" : "paused",
        };
        ads.push(ad);
        plans.push({ ad, code: cr.code, offerId: b.offerId, from: startT, to: finished ? Math.min(to, startT + 12 * DAY) : to, budgetUsd: 22 });
      });
    }
  }

  // Campañas de escala con los mejores creativos (el mismo código en otra campaña: el Creative Hub lo suma).
  for (const offer of offers) {
    for (const pl of placements[offer.id]) {
      if (pl.fromBatch) continue;
      const acc = accById.get(pl.accountId)!;
      const short = acc.platform === "meta" ? "fb" : "tt";
      const campId = `${short}_c_${offer.code}_scale_${acc.id}`;
      const cands = scaleCandidates.filter((s) => s.offerId === offer.id);
      if (!cands.length) continue;
      campaigns.push({
        id: campId, accountId: acc.id, platform: acc.platform, name: `${offer.code} | ESCALA | CBO`,
        status: "active", dailyBudget: acc.currency === "BRL" ? 1500 : 300,
      });
      const set: AdSet = {
        id: `${campId}_s0`, campaignId: campId, accountId: acc.id, name: `${offer.code} · Escala Broad`,
        status: "active", dailyBudget: null,
      };
      adsets.push(set);
      cands.forEach((c, k) => {
        const ad: Ad = {
          id: `${set.id}_a${k}`, adsetId: set.id, campaignId: campId, accountId: acc.id, platform: acc.platform,
          name: `${c.code} | Escala`, status: "active",
        };
        ads.push(ad);
        plans.push({ ad, code: c.code, offerId: offer.id, from: c.from, to: nowMs, budgetUsd: 110 / cands.length + 40 });
      });
    }
  }

  // Gasto por hora y ventas que salen de ese gasto.
  let orderSeq = 0;
  let emailSeq = 0;
  const productsOf = (offerId: string, kind: ProductKind) => products.find((p) => p.offerId === offerId && p.kind === kind)!;

  for (const plan of plans) {
    const acc = accById.get(plan.ad.accountId)!;
    const q = quality.get(plan.code)!;
    const main = productsOf(plan.offerId, "main");
    const from = Math.max(plan.from, windowStart);
    for (let h = Math.floor(from / HOUR) * HOUR; h < plan.to && h <= nowMs; h += HOUR) {
      const r = rngFrom(hash("h", plan.ad.id, h));
      const lh = localParts(h, acc.timezone).hour;
      const curve = 0.35 + 0.65 * Math.max(0, Math.sin(((lh - 5) / 24) * Math.PI * 1.15));
      const partial = h + HOUR > nowMs ? (nowMs - h) / HOUR : 1;
      const spendUsd = (plan.budgetUsd / 14) * curve * (0.7 + r() * 0.6) * partial;
      const rate = usdRate(acc.currency, h);
      const spendLocal = Math.round(spendUsd * rate * 100) / 100;
      if (spendLocal <= 0) continue;
      const impressions = Math.round(spendUsd * (55 + r() * 30));
      spend.push({ adId: plan.ad.id, hourUtc: h, spend: spendLocal, impressions, clicks: Math.round(impressions * (0.009 + r() * 0.01)) });

      const mainUsd = main.price / usdRate(main.currency, h);
      const cpaUsd = (mainUsd * 1.05) / q;
      const nSales = poisson(spendUsd / cpaUsd, r);
      const nCheckouts = poisson((spendUsd / cpaUsd) * 1.7, r);
      for (let i = 0; i < nCheckouts; i++) checkouts.push({ createdAtUtc: h + Math.floor(r() * HOUR), offerId: plan.offerId });

      for (let i = 0; i < nSales; i++) {
        const t = Math.min(nowMs - 60_000, h + Math.floor(r() * HOUR));
        if (t < h) continue;
        checkouts.push({ createdAtUtc: t - 120_000, offerId: plan.offerId });
        const orderId = `ord_${++orderSeq}`;
        const email = `cliente${++emailSeq}@ejemplo.com`;
        const lost = r() < 0.11; // la venta llegó sin rastreo
        const attr = lost
          ? { platform: null, campaignId: null, adsetId: null, adId: null, sourcePage: r() < 0.7 ? SOURCE_PAGES[Math.floor(r() * SOURCE_PAGES.length)] : null }
          : { platform: acc.platform, campaignId: plan.ad.campaignId, adsetId: plan.ad.adsetId, adId: plan.ad.id, sourcePage: null };
        const statusRoll = r();
        const status: SaleStatus = statusRoll < 0.008 ? "chargeback" : statusRoll < 0.05 ? "refunded" : "approved";
        const push = (kind: ProductKind, at: number, parent: string | null, st: SaleStatus) => {
          const p = productsOf(plan.offerId, kind);
          const gateway = plan.offerId === "off_at" ? "digistore24" : "kiwify";
          const fee = gateway === "digistore24" ? p.price * 0.079 + 1 : p.price * 0.0899 + 2.49;
          sales.push({
            id: `sale_${sales.length + 1}`, orderId: parent ? `${parent}_${kind}` : orderId, parentOrderId: parent,
            createdAtUtc: at, offerId: plan.offerId, productId: p.id, productKind: kind, gateway,
            currency: p.currency, gross: p.price, fee: round2(fee), net: round2(p.price - fee), status: st,
            buyerEmail: email, ...attr,
          });
        };
        push("main", t, null, status);
        const after = (min: number) => Math.min(nowMs - 1000, t + min * 60_000);
        if (r() < 0.33) push("bump", t, orderId, status);
        if (r() < 0.22) {
          push("upsell1", after(3), orderId, r() < 0.03 ? "refunded" : "approved");
          if (r() < 0.4) push("upsell2", after(6), orderId, "approved");
        } else if (r() < 0.3) {
          push("downsell", after(4), orderId, "approved");
        }
      }
    }
  }

  sales.sort((a, b) => b.createdAtUtc - a.createdAtUtc);
  return {
    isSample: true,
    lastSyncUtc: Math.floor(nowMs / (15 * 60_000)) * 15 * 60_000,
    accounts, campaigns, adsets, ads, spend, offers, products, sales, checkouts, fx: fxDays, batches, creatives,
    spendSources: ["meta", "tiktok"],
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
