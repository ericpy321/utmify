import "server-only";
import { getDict } from "./i18n/server";
import { getSettings } from "./settings";
import { getDataset } from "./data";
import { parseFilters } from "./filters";
import { MetricsEngine } from "./metrics";
import { formatMoney, formatNumber, formatPct } from "./currency";

type SP = Record<string, string | string[] | undefined>;

/** Todo lo que una pantalla necesita: idioma, configuración, datos, filtros y formateadores. */
export async function loadPage(spPromise: Promise<SP>) {
  const [sp, { lang, t }, settings] = await Promise.all([spPromise, getDict(), getSettings()]);
  const f = parseFilters(sp, settings);
  const data = await getDataset(f);
  const engine = new MetricsEngine(data, f, settings);
  const money = (v: number | null | undefined, compact = false) => (v == null ? t.common.noData : formatMoney(v, f.currency, lang, compact));
  const num = (v: number | null | undefined, d = 0) => (v == null ? t.common.noData : formatNumber(v, lang, d));
  const pct = (v: number | null | undefined, d = 1) => (v == null ? t.common.noData : formatPct(v, lang, d));
  const ratio = (v: number | null | undefined) => (v == null ? t.common.noData : formatNumber(v, lang, 2));
  const filterProps = {
    accounts: data.accounts.map((a) => ({ id: a.id, name: a.name, platform: a.platform })),
    offers: data.offers.map((o) => ({ id: o.id, name: o.name })),
    current: { period: f.period, from: f.from, to: f.to, tz: f.tz, currency: f.currency, account: f.account, offer: f.offer, platform: f.platform },
  };
  return { sp, lang, t, settings, data, f, engine, money, num, pct, ratio, filterProps };
}
