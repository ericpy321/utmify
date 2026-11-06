// Utilidades de zona horaria sin dependencias: usan Intl, que ya conoce todas las zonas IANA.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(tz, f);
  }
  return f;
}

export interface LocalParts {
  date: string; // YYYY-MM-DD en la zona pedida
  hour: number; // 0-23
  minute: number;
}

// Cache por zona y por instante (redondeado al minuto) para no recalcular en miles de filas.
const partsCache = new Map<string, Map<number, LocalParts>>();

/** Convierte un instante UTC en fecha y hora locales de la zona `tz`. */
export function localParts(utcMs: number, tz: string): LocalParts {
  const key = Math.floor(utcMs / 60_000);
  let byTz = partsCache.get(tz);
  if (!byTz) {
    byTz = new Map();
    partsCache.set(tz, byTz);
  }
  const hit = byTz.get(key);
  if (hit) return hit;
  const p: Record<string, string> = {};
  for (const part of formatterFor(tz).formatToParts(new Date(utcMs))) p[part.type] = part.value;
  const res: LocalParts = {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour),
    minute: Number(p.minute),
  };
  if (byTz.size > 200_000) byTz.clear();
  byTz.set(key, res);
  return res;
}

/** Diferencia en ms entre la hora local de `tz` y UTC en ese instante. */
export function tzOffsetMs(utcMs: number, tz: string): number {
  const p = localParts(utcMs, tz);
  const [y, m, d] = p.date.split("-").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, p.hour, p.minute);
  return asUtc - Math.floor(utcMs / 60_000) * 60_000;
}

/**
 * Convierte una fecha y hora "de pared" en la zona `tz` a un instante UTC.
 * Se usa para guardar el gasto por hora que Meta/TikTok entregan en el huso de la cuenta.
 */
export function zonedToUtc(date: string, hour: number, tz: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour);
  // Dos pasadas para acertar también cerca de cambios de horario de verano.
  let utc = guess - tzOffsetMs(guess, tz);
  utc = guess - tzOffsetMs(utc, tz);
  return utc;
}

export function todayIn(tz: string, nowMs = Date.now()): string {
  return localParts(nowMs, tz).date;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + n * DAY;
  return new Date(t).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(to + "T00:00:00Z");
  return Math.round((b - a) / DAY);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Zonas más usadas por operaciones de LATAM, Brasil, EE. UU. y Europa. */
export const COMMON_TIMEZONES = [
  "America/Asuncion",
  "America/Sao_Paulo",
  "America/Montevideo",
  "America/La_Paz",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Caracas",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/Madrid",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Berlin",
  "UTC",
];

export { HOUR, DAY };
