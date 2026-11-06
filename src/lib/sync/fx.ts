import "server-only";
import { SUPPORTED_CURRENCIES } from "../currency";
import { upsertChunks } from "./common";

// Fuente pública y gratuita, sin clave: ExchangeRate-API (open access). Incluye el guaraní (PYG).
// Se guarda una cotización por día: el histórico no cambia después.
const SOURCE_URL = "https://open.er-api.com/v6/latest/USD";

export async function syncFx() {
  const res = await fetch(SOURCE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Cotizaciones: HTTP ${res.status}`);
  const body = (await res.json()) as { result: string; time_last_update_unix: number; rates: Record<string, number> };
  if (body.result !== "success") throw new Error("Cotizaciones: respuesta inválida");
  const date = new Date(body.time_last_update_unix * 1000).toISOString().slice(0, 10);
  const rows = SUPPORTED_CURRENCIES.filter((c) => c !== "USD" && body.rates[c] > 0).map((c) => ({
    date, base: "USD", quote: c, rate: body.rates[c], source: "open.er-api.com",
  }));
  await upsertChunks("fx_rates", rows, "date,base,quote");
  return `${rows.length} cotizaciones del ${date}`;
}
