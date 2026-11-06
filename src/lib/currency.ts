// Conversión y formato multimoneda. Todas las cotizaciones tienen base USD.
import type { CurrencyCode, FxDay } from "./types";

export const SUPPORTED_CURRENCIES: CurrencyCode[] = [
  "USD", "BRL", "PYG", "EUR", "MXN", "COP", "ARS", "CLP", "PEN", "UYU", "BOB", "GBP",
];

/** Monedas sin centavos: los montos en unidades mínimas (Stripe, Meta) no se dividen por 100. */
export const ZERO_DECIMAL = new Set(["PYG", "CLP", "JPY", "KRW", "VND", "ISK", "UGX", "XAF", "XOF", "BIF", "DJF", "GNF", "KMF", "MGA", "RWF", "VUV", "XPF"]);
export const minorFactor = (cur: string) => (ZERO_DECIMAL.has(cur.toUpperCase()) ? 1 : 100);

export class FxTable {
  private byDate = new Map<string, FxDay>();
  private sortedDates: string[];

  constructor(days: FxDay[]) {
    for (const d of days) this.byDate.set(d.date, d);
    this.sortedDates = [...this.byDate.keys()].sort();
  }

  /** Cotización del día; si ese día no existe usa la última anterior conocida. Null si no hay ninguna. */
  dayFor(date: string): FxDay | null {
    const exact = this.byDate.get(date);
    if (exact) return exact;
    let found: string | null = null;
    for (const d of this.sortedDates) {
      if (d <= date) found = d;
      else break;
    }
    return found ? this.byDate.get(found)! : null;
  }

  /** Cuántas unidades de `to` vale 1 unidad de `from` en la fecha dada. Null si falta la cotización. */
  rate(from: CurrencyCode, to: CurrencyCode, date: string): number | null {
    if (from === to) return 1;
    const day = this.dayFor(date);
    if (!day) return null;
    const rf = from === "USD" ? 1 : day.rates[from];
    const rt = to === "USD" ? 1 : day.rates[to];
    if (!rf || !rt) return null;
    return rt / rf;
  }

  convert(amount: number, from: CurrencyCode, to: CurrencyCode, date: string): number | null {
    const r = this.rate(from, to, date);
    return r == null ? null : amount * r;
  }
}

const LOCALES: Record<string, string> = { en: "en-US", es: "es-419", pt: "pt-BR" };
export const localeFor = (lang: string) => LOCALES[lang] ?? "en-US";

// Cada moneda usa sus decimales propios (el guaraní no tiene centavos). En modo compacto, sin decimales.
const moneyFormatters = new Map<string, Intl.NumberFormat>();
export function formatMoney(value: number, currency: CurrencyCode, lang: string, compact = false) {
  const key = `${lang}|${currency}|${compact}`;
  let f = moneyFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(localeFor(lang), compact
      ? { style: "currency", currency, maximumFractionDigits: 0, minimumFractionDigits: 0 }
      : { style: "currency", currency });
    moneyFormatters.set(key, f);
  }
  return f.format(value);
}

export function formatNumber(value: number, lang: string, digits = 0) {
  return new Intl.NumberFormat(localeFor(lang), {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatPct(value: number, lang: string, digits = 1) {
  return new Intl.NumberFormat(localeFor(lang), {
    style: "percent",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}
