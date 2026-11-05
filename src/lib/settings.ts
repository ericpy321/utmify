import "server-only";
import { cookies } from "next/headers";
import type { Settings } from "./types";
import { isValidTimeZone } from "./time";
import { SUPPORTED_CURRENCIES } from "./currency";

// Valores por defecto (editables en Configuración). La regla de creativos es la sugerida en el pedido.
export const DEFAULT_SETTINGS: Settings = {
  timezone: "America/Sao_Paulo",
  currency: "USD",
  revenueTaxPct: 0,
  adSpendTaxPct: 0,
  costPerSale: 0,
  rules: { validated: { sales: 10, roas: 1.4 }, champion: { sales: 30, roas: 1.4 } },
};

const num = (v: unknown, def: number, min = 0, max = 1e9) => {
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

// Mientras no hay base de datos, la configuración vive en una cookie. En la etapa 3 pasa a la tabla `settings`.
export async function getSettings(): Promise<Settings> {
  const raw = (await cookies()).get("settings")?.value;
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}
