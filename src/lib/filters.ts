// Lectura y validación de los filtros que viajan en la URL.
import type { PlatformFilter, Settings } from "./types";
import { addDays, daysBetween, isValidTimeZone, todayIn } from "./time";
import { SUPPORTED_CURRENCIES } from "./currency";

export type Period = "today" | "yesterday" | "7d" | "30d" | "custom";

export interface Filters {
  period: Period;
  from: string; // YYYY-MM-DD en la zona del panel (incluido)
  to: string; // YYYY-MM-DD (incluido)
  prevFrom: string;
  prevTo: string;
  tz: string;
  currency: string;
  account: string; // "all" o id de cuenta
  offer: string; // "all" o id de oferta
  platform: PlatformFilter;
}

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

export function parseFilters(sp: SP, settings: Settings, nowMs = Date.now()): Filters {
  const tzRaw = one(sp.tz);
  const tz = tzRaw && isValidTimeZone(tzRaw) ? tzRaw : settings.timezone;
  const curRaw = one(sp.cur)?.toUpperCase();
  const currency = curRaw && SUPPORTED_CURRENCIES.includes(curRaw) ? curRaw : settings.currency;
  const p = one(sp.period) as Period | undefined;
  const period: Period = p && ["today", "yesterday", "7d", "30d", "custom"].includes(p) ? p : "today";
  const today = todayIn(tz, nowMs);

  let from = today;
  let to = today;
  if (period === "yesterday") from = to = addDays(today, -1);
  if (period === "7d") from = addDays(today, -6);
  if (period === "30d") from = addDays(today, -29);
  if (period === "custom") {
    const f = one(sp.from);
    const t = one(sp.to);
    if (isDate(f) && isDate(t) && f <= t) {
      from = f;
      to = t > today ? today : t;
    }
  }
  const len = daysBetween(from, to) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(len - 1));

  const plat = one(sp.platform);
  const platform: PlatformFilter = plat === "meta" || plat === "tiktok" || plat === "google" ? plat : "all";

  return {
    period, from, to, prevFrom, prevTo, tz, currency,
    account: one(sp.account) || "all",
    offer: one(sp.offer) || "all",
    platform,
  };
}
