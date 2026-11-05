// Motor de métricas. Todo se convierte a la moneda del panel con la cotización del día local
// y se recorta por día en la zona horaria del panel.
//
// Definiciones (iguales a las del pedido):
//   Facturación = ventas aprobadas − reembolsos − contracargos  (= bruto de lo que sigue aprobado)
//   Lucro = líquido recibido − gasto − impuesto sobre gasto − impuesto sobre facturación − costo por venta
//   ROAS = facturación ÷ gasto · ROI = lucro ÷ gasto · CPA = gasto ÷ ventas del producto principal
import type { Ad, Dataset, Sale, Settings } from "./types";
import type { Filters } from "./filters";
import { FxTable } from "./currency";
import { localParts } from "./time";
import { offerCodeFromName, parseCreativeCode } from "./creative";

export interface Totals {
  revenue: number;
  net: number;
  netMissing: number; // ventas aprobadas sin valor líquido informado
  spend: number | null; // null = sin datos
  spendTax: number | null;
  revenueTax: number;
  fixedCosts: number;
  profit: number | null;
  roas: number | null;
  roi: number | null;
  cpa: number | null;
  aov: number | null;
  sales: number; // ventas aprobadas del producto principal
  orders: number; // todas las ventas aprobadas (incluye bumps y upsells)
  refunds: { count: number; amount: number };
  chargebacks: { count: number; amount: number };
  attributedPct: number | null;
  fxMissing: boolean;
}

interface Agg { spend: number; revenue: number; net: number; sales: number; netMissing: number }
const emptyAgg = (): Agg => ({ spend: 0, revenue: 0, net: 0, sales: 0, netMissing: 0 });

export class MetricsEngine {
  readonly fx: FxTable;
  private adById: Map<string, Ad>;
  private accById;
  private offerOfAd = new Map<string, string | null>();
  private offerByCode: Map<string, string>;

  constructor(readonly data: Dataset, readonly f: Filters, readonly s: Settings) {
    this.fx = new FxTable(data.fx);
    this.adById = new Map(data.ads.map((a) => [a.id, a]));
    this.accById = new Map(data.accounts.map((a) => [a.id, a]));
    this.offerByCode = new Map(data.offers.map((o) => [o.code, o.id]));
    const campName = new Map(data.campaigns.map((c) => [c.id, c.name]));
    for (const ad of data.ads) {
      const code = offerCodeFromName(ad.name) ?? offerCodeFromName(campName.get(ad.campaignId) ?? "");
      this.offerOfAd.set(ad.id, code ? this.offerByCode.get(code) ?? null : null);
    }
  }

  // --- filtros ---
  private adPasses(adId: string): boolean {
    const ad = this.adById.get(adId);
    if (!ad) return false;
    if (this.f.platform !== "all" && ad.platform !== this.f.platform) return false;
    if (this.f.account !== "all" && ad.accountId !== this.f.account) return false;
    if (this.f.offer !== "all" && this.offerOfAd.get(adId) !== this.f.offer) return false;
    return true;
  }
  private salePasses(s: Sale): boolean {
    if (this.f.offer !== "all" && s.offerId !== this.f.offer) return false;
    // Una venta sin origen no se puede asignar a una plataforma ni a una cuenta.
    if (this.f.platform !== "all" || this.f.account !== "all") {
      if (!s.adId) return false;
      return this.adPasses(s.adId);
    }
    return true;
  }
  /** ¿Hay gasto sincronizado para lo que se está mirando? Si no, el gasto es "sin datos", nunca cero. */
  get hasSpendSource(): boolean {
    if (this.f.platform === "all") return this.data.spendSources.length > 0;
    return this.data.spendSources.includes(this.f.platform);
  }
  get attributionFilterActive() {
    return this.f.platform !== "all" || this.f.account !== "all";
  }

  /** Monto convertido a la moneda del panel; null si falta la cotización. */
  conv(amount: number, cur: string, date: string): number | null {
    return this.fx.convert(amount, cur, this.f.currency, date);
  }

  // --- recorridos base ---
  *spendRows(from: string, to: string, all = false) {
    for (const r of this.data.spend) {
      const lp = localParts(r.hourUtc, this.f.tz);
      if (!all && (lp.date < from || lp.date > to)) continue;
      if (!this.adPasses(r.adId)) continue;
      const ad = this.adById.get(r.adId)!;
      const acc = this.accById.get(ad.accountId)!;
      yield { row: r, ad, local: lp, value: this.conv(r.spend, acc.currency, lp.date) };
    }
  }
  *saleRows(from: string, to: string, all = false) {
    for (const s of this.data.sales) {
      const lp = localParts(s.createdAtUtc, this.f.tz);
      if (!all && (lp.date < from || lp.date > to)) continue;
      if (!this.salePasses(s)) continue;
      yield {
        sale: s,
        local: lp,
        gross: this.conv(s.gross, s.currency, lp.date),
        net: s.net == null ? null : this.conv(s.net, s.currency, lp.date),
      };
    }
  }

  // --- totales ---
  totals(from: string, to: string): Totals {
    let fxMissing = false;
    let spend = 0;
    for (const r of this.spendRows(from, to)) {
      if (r.value == null) fxMissing = true;
      else spend += r.value;
    }
    let revenue = 0, net = 0, netMissing = 0, sales = 0, orders = 0, mainAll = 0, attributed = 0;
    const refunds = { count: 0, amount: 0 };
    const chargebacks = { count: 0, amount: 0 };
    for (const r of this.saleRows(from, to)) {
      if (r.gross == null) { fxMissing = true; continue; }
      const s = r.sale;
      if (s.status === "approved") {
        revenue += r.gross;
        orders++;
        if (r.net == null) { netMissing++; net += r.gross; } else net += r.net;
        if (s.productKind === "main") {
          sales++;
          if (s.adId) attributed++;
        }
      } else if (s.status === "refunded") {
        refunds.count++;
        refunds.amount += r.gross;
      } else {
        chargebacks.count++;
        chargebacks.amount += r.gross;
      }
      if (s.productKind === "main") mainAll++;
    }
    const spendV = this.hasSpendSource && !fxMissing ? spend : null;
    const spendTax = spendV == null ? null : spendV * (this.s.adSpendTaxPct / 100);
    const revenueTax = revenue * (this.s.revenueTaxPct / 100);
    const fixedCosts = sales * this.s.costPerSale;
    const profit = spendV == null || spendTax == null ? null : net - spendV - spendTax - revenueTax - fixedCosts;
    return {
      revenue, net, netMissing, spend: spendV, spendTax, revenueTax, fixedCosts, profit,
      roas: spendV ? revenue / spendV : null,
      roi: spendV && profit != null ? profit / spendV : null,
      cpa: spendV != null && sales > 0 ? spendV / sales : null,
      aov: sales > 0 ? revenue / sales : null,
      sales, orders, refunds, chargebacks,
      attributedPct: mainAll > 0 && !this.attributionFilterActive ? attributed / Math.max(1, sales) : null,
      fxMissing,
    };
  }

  /** Lucro de un grupo (anuncio, conjunto, campaña o creativo) con los mismos impuestos y costos. */
  profitOf(a: Agg): number {
    return a.net - a.spend - a.spend * (this.s.adSpendTaxPct / 100) - a.revenue * (this.s.revenueTaxPct / 100) - a.sales * this.s.costPerSale;
  }

  hourly(from: string, to: string) {
    const out = Array.from({ length: 24 }, (_, hour) => ({ hour, sales: 0, revenue: 0 }));
    for (const r of this.saleRows(from, to)) {
      if (r.sale.status !== "approved" || r.gross == null) continue;
      if (r.sale.productKind === "main") out[r.local.hour].sales++;
      out[r.local.hour].revenue += r.gross;
    }
    return out;
  }

  funnel(from: string, to: string) {
    let checkout: number | null = null;
    if (!this.attributionFilterActive && this.data.checkouts.length > 0) {
      checkout = 0;
      for (const c of this.data.checkouts) {
        if (this.f.offer !== "all" && c.offerId !== this.f.offer) continue;
        const d = localParts(c.createdAtUtc, this.f.tz).date;
        if (d >= from && d <= to) checkout++;
      }
    }
    let purchase = 0, upsell1 = 0, upsell2 = 0;
    for (const r of this.saleRows(from, to)) {
      const k = r.sale.productKind;
      if (k === "main") purchase++;
      if (k === "upsell1") upsell1++;
      if (k === "upsell2") upsell2++;
    }
    return { checkout, purchase, upsell1, upsell2 };
  }

  /** Agregado por anuncio en el período, listo para subir a conjunto y campaña. */
  byAd(from: string, to: string, all = false): Map<string, Agg> {
    const m = new Map<string, Agg>();
    const get = (id: string) => {
      let a = m.get(id);
      if (!a) m.set(id, (a = emptyAgg()));
      return a;
    };
    for (const r of this.spendRows(from, to, all)) if (r.value != null) get(r.ad.id).spend += r.value;
    for (const r of this.saleRows(from, to, all)) {
      const s = r.sale;
      if (!s.adId || s.status !== "approved" || r.gross == null) continue;
      const a = get(s.adId);
      a.revenue += r.gross;
      if (r.net == null) { a.net += r.gross; a.netMissing++; } else a.net += r.net;
      if (s.productKind === "main") a.sales++;
    }
    return m;
  }

  campaignTree(from: string, to: string) {
    const ads = this.byAd(from, to);
    const add = (t: Agg, a: Agg) => {
      t.spend += a.spend; t.revenue += a.revenue; t.net += a.net; t.sales += a.sales; t.netMissing += a.netMissing;
    };
    const camps = new Map<string, { agg: Agg; sets: Map<string, { agg: Agg; ads: { id: string; agg: Agg }[] }> }>();
    for (const [adId, agg] of ads) {
      const ad = this.adById.get(adId)!;
      let c = camps.get(ad.campaignId);
      if (!c) camps.set(ad.campaignId, (c = { agg: emptyAgg(), sets: new Map() }));
      let st = c.sets.get(ad.adsetId);
      if (!st) c.sets.set(ad.adsetId, (st = { agg: emptyAgg(), ads: [] }));
      st.ads.push({ id: adId, agg });
      add(st.agg, agg);
      add(c.agg, agg);
    }
    const metrics = (a: Agg) => ({
      ...a,
      profit: this.profitOf(a),
      roas: a.spend > 0 ? a.revenue / a.spend : null,
      roi: a.spend > 0 ? this.profitOf(a) / a.spend : null,
      cpa: a.sales > 0 ? a.spend / a.sales : null,
    });
    const campById = new Map(this.data.campaigns.map((c) => [c.id, c]));
    const setById = new Map(this.data.adsets.map((s) => [s.id, s]));
    return [...camps.entries()]
      .map(([id, c]) => {
        const camp = campById.get(id)!;
        return {
          id, name: camp.name, status: camp.status, platform: camp.platform,
          budget: camp.dailyBudget, currency: this.accById.get(camp.accountId)!.currency,
          account: this.accById.get(camp.accountId)!.name,
          m: metrics(c.agg),
          sets: [...c.sets.entries()].map(([sid, sv]) => {
            const set = setById.get(sid)!;
            return {
              id: sid, name: set.name, status: set.status, budget: set.dailyBudget,
              m: metrics(sv.agg),
              ads: sv.ads
                .map((a) => ({ id: a.id, name: this.adById.get(a.id)!.name, status: this.adById.get(a.id)!.status, m: metrics(a.agg) }))
                .sort((x, y) => y.m.spend - x.m.spend),
            };
          }).sort((x, y) => y.m.spend - x.m.spend),
        };
      })
      .sort((x, y) => y.m.spend - x.m.spend);
  }

  /** Números de toda la vida por código de creativo (el mismo creativo en varias cuentas cuenta una vez). */
  creativeStats() {
    const ads = this.byAd("", "", true);
    const out = new Map<string, { code: string; offerCode: string; batch: string; spend: number; revenue: number; net: number; sales: number; platforms: Set<string>; ads: number }>();
    for (const [adId, a] of ads) {
      const ad = this.adById.get(adId)!;
      const cc = parseCreativeCode(ad.name);
      if (!cc) continue;
      let c = out.get(cc.code);
      if (!c) out.set(cc.code, (c = { code: cc.code, offerCode: cc.offerCode, batch: cc.batch, spend: 0, revenue: 0, net: 0, sales: 0, platforms: new Set(), ads: 0 }));
      c.spend += a.spend; c.revenue += a.revenue; c.net += a.net; c.sales += a.sales; c.ads++;
      c.platforms.add(ad.platform);
    }
    return [...out.values()].map((c) => {
      const agg: Agg = { spend: c.spend, revenue: c.revenue, net: c.net, sales: c.sales, netMissing: 0 };
      return {
        code: c.code, offerCode: c.offerCode, batch: c.batch, ads: c.ads,
        platforms: [...c.platforms], spend: c.spend, revenue: c.revenue, sales: c.sales,
        profit: this.profitOf(agg),
        roas: c.spend > 0 ? c.revenue / c.spend : null,
        cpa: c.sales > 0 ? c.spend / c.sales : null,
      };
    });
  }

  /** Cotizaciones usadas en la fecha final del rango, para mostrarlas en pantalla. */
  fxUsed(date: string) {
    const curs = new Set<string>();
    for (const a of this.data.accounts) curs.add(a.currency);
    for (const p of this.data.products) curs.add(p.currency);
    curs.delete(this.f.currency);
    const day = this.fx.dayFor(date);
    return {
      date: day?.date ?? null,
      source: day?.source ?? null,
      pairs: [...curs].map((c) => ({ from: c, to: this.f.currency, rate: this.fx.rate(c, this.f.currency, date) })),
    };
  }

  unattributedBreakdown(from: string, to: string) {
    const m = new Map<string, number>();
    let total = 0;
    for (const r of this.saleRows(from, to)) {
      const s = r.sale;
      if (s.adId || s.productKind !== "main" || s.status !== "approved") continue;
      total++;
      const k = s.sourcePage ?? "?";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return { total, pages: [...m.entries()].map(([page, count]) => ({ page, count })).sort((a, b) => b.count - a.count) };
  }
}

export function pctChange(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return (cur - prev) / Math.abs(prev);
}
