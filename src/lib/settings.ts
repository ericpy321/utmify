import "server-only";
import { cookies } from "next/headers";
import type { Settings } from "./types";
import { isValidTimeZone } from "./time";
import { SUPPORTED_CURRENCIES } from "./currency";
import { serviceConfigured } from "./env";
import { admin } from "./supabase/admin";

// Valores por defecto (editables en Configuración). La regla de creativos es la sugerida en el pedido.
export const DEFAULT_SETTINGS: Settings = {
  timezone: "America/Asuncion",
  currency: "USD",
  revenueTaxPct: 0,
  adSpendTaxPct: 0,
  costPerSale: 0,
  rules: { validated: { sales: 10, roas: 1.4 }, champion: { sales: 30, roas: 1.4 } },
};

const num = (v: unknown, def: number, min = 0, max = 1e12) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
};

/** Normaliza cualquier objeto recibido para que nunca entre un valor inválido. */
export function sanitizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const d = DEFAULT_SETTINGS;
  const r = raw ?? {};
  return {
    timezone: typeof r.timezone === "string" && isValidTimeZone(r.timezone) ? r.timezone : d.timezone,
    currency: typeof r.currency === "string" && SUPPORTED_CURRENCIES.includes(r.currency) ? r.currency : d.currency,
    revenueTaxPct: num(r.revenueTaxPct, d.revenueTaxPct, 0, 100),
    adSpendTaxPct: num(r.adSpendTaxPct, d.adSpendTaxPct, 0, 100),
    costPerSale: num(r.costPerSale, d.costPerSale),
    rules: {
      validated: {
        sales: num(r.rules?.validated?.sales, d.rules.validated.sales, 0, 100000),
        roas: num(r.rules?.validated?.roas, d.rules.validated.roas, 0, 100),
      },
      champion: {
        sales: num(r.rules?.champion?.sales, d.rules.champion.sales, 0, 100000),
        roas: num(r.rules?.champion?.roas, d.rules.champion.roas, 0, 100),
      },
    },
  };
}

/** Configuración desde la tabla `settings` (o desde una cookie si la base aún no está conectada). */
export async function getSettings(): Promise<Settings> {
  if (serviceConfigured) {
    const { data } = await admin().from("settings").select("*").eq("id", 1).maybeSingle();
    if (data) {
      return sanitizeSettings({
        timezone: data.timezone, currency: data.currency, revenueTaxPct: data.revenue_tax_pct,
        adSpendTaxPct: data.ad_spend_tax_pct, costPerSale: data.cost_per_sale, rules: data.rules,
      });
    }
  }
  const raw = (await cookies()).get("settings")?.value;
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function persistSettings(s: Settings) {
  if (!serviceConfigured) return false;
  const { error } = await admin().from("settings").upsert({
    id: 1, timezone: s.timezone, currency: s.currency, revenue_tax_pct: s.revenueTaxPct,
    ad_spend_tax_pct: s.adSpendTaxPct, cost_per_sale: s.costPerSale, rules: s.rules, updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return true;
}
