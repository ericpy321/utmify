// Tipos de dominio del tracker. Los montos siempre viajan con su moneda.

export type Platform = "meta" | "tiktok" | "google";
export type PlatformFilter = Platform | "all";

export type CurrencyCode = string; // ISO 4217, ej: "USD", "BRL", "EUR"

export interface AdAccount {
  id: string;
  platform: Platform;
  name: string;
  currency: CurrencyCode;
  timezone: string; // zona IANA de la cuenta, ej: "America/New_York"
}

export type EntityStatus = "active" | "paused";

export interface Campaign {
  id: string;
  accountId: string;
  platform: Platform;
  name: string;
  status: EntityStatus;
  dailyBudget: number | null; // en la moneda de la cuenta
}

export interface AdSet {
  id: string;
  campaignId: string;
  accountId: string;
  name: string;
  status: EntityStatus;
  dailyBudget: number | null;
}

export interface Ad {
  id: string;
  adsetId: string;
  campaignId: string;
  accountId: string;
  platform: Platform;
  name: string;
  status: EntityStatus;
}

/** Gasto de un anuncio en una hora. La hora se guarda en UTC (ya convertida desde el huso de la cuenta). */
export interface SpendRow {
  adId: string;
  hourUtc: number; // epoch ms del inicio de la hora en UTC
  spend: number; // en la moneda de la cuenta
  impressions: number;
  clicks: number;
}

export type ProductKind = "main" | "bump" | "upsell1" | "upsell2" | "downsell";

export interface Product {
  id: string;
  offerId: string;
  name: string;
  kind: ProductKind;
  price: number;
  currency: CurrencyCode;
}

export interface Offer {
  id: string;
  code: string; // prefijo usado en los nombres de anuncios, ej: "AT"
  name: string;
}

export type SaleStatus = "approved" | "refunded" | "chargeback";

export interface Sale {
  id: string;
  orderId: string;
  parentOrderId: string | null; // pedido principal, para bumps y upsells
  createdAtUtc: number; // epoch ms
  offerId: string;
  productId: string;
  productKind: ProductKind;
  gateway: string;
  currency: CurrencyCode;
  gross: number; // valor bruto pagado por el comprador
  fee: number | null; // comisión del gateway (null si el webhook no la manda)
  net: number | null; // valor líquido recibido (null si el webhook no lo manda)
  status: SaleStatus;
  buyerEmail: string;
  platform: Platform | null;
  campaignId: string | null;
  adsetId: string | null;
  adId: string | null;
  sourcePage: string | null; // página del embudo donde se generó el checkout, si se conoce
  productName?: string; // nombre que mandó el gateway (si el producto aún no está asignado)
}

export interface CheckoutEvent {
  createdAtUtc: number;
  offerId: string;
}

/** Cotizaciones del día con base USD: 1 USD = rates[X] unidades de X. */
export interface FxDay {
  date: string; // YYYY-MM-DD
  source: string;
  rates: Record<CurrencyCode, number>;
}

export interface Batch {
  offerId: string;
  code: string; // ej: "08"
  createdAt: string; // YYYY-MM-DD
  status: "testing" | "finished";
}

export interface CreativeMeta {
  code: string; // ej: "AT08.G2.C1.F1"
  copywriter: string | null;
  editor: string | null;
}

export interface CreativeRules {
  validated: { sales: number; roas: number };
  champion: { sales: number; roas: number };
}

export interface Settings {
  timezone: string;
  currency: CurrencyCode;
  revenueTaxPct: number; // % sobre la facturación
  adSpendTaxPct: number; // % sobre el gasto en anuncios (IOF, etc.)
  costPerSale: number; // costo fijo por venta principal, en la moneda del panel
  rules: CreativeRules;
}

export interface Dataset {
  isSample: boolean;
  lastSyncUtc: number | null;
  accounts: AdAccount[];
  campaigns: Campaign[];
  adsets: AdSet[];
  ads: Ad[];
  spend: SpendRow[];
  offers: Offer[];
  products: Product[];
  sales: Sale[];
  checkouts: CheckoutEvent[];
  fx: FxDay[];
  batches: Batch[];
  creatives: CreativeMeta[];
  /** Plataformas cuyo gasto ya se sincronizó al menos una vez. Sin esto, el gasto se muestra como "sin datos". */
  spendSources: Platform[];
  /** Totales de toda la vida por anuncio, ya en la moneda del panel (datos reales; el ejemplo los calcula). */
  adLifetime?: Map<string, { spend: number; revenue: number; net: number; sales: number }>;
}
