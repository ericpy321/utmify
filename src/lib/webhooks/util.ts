import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { zonedToUtc } from "../time";

export const str = (v: unknown) => (v == null ? "" : String(v));
export const numOrNull = (v: unknown) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
export const lower = (v: unknown) => str(v).trim().toLowerCase() || null;

/** Lee una ruta tipo "data.purchase.price.value" sin romperse si falta algo. */
export function pick(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const k of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}
export const first = (obj: unknown, ...paths: string[]) => {
  for (const p of paths) {
    const v = pick(obj, p);
    if (v != null && v !== "") return v;
  }
  return undefined;
};

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export const hmacHex = (algo: string, key: string, data: string) => createHmac(algo, key).update(data, "utf8").digest("hex");
export const hashHex = (algo: string, data: string) => createHash(algo).update(data, "utf8").digest("hex");

export function readForm(raw: string, url: URL): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of url.searchParams) if (k !== "signature" && k !== "key") out[k] = v;
  for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
  return out;
}
export function readJson(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Fecha "YYYY-MM-DD HH:mm[:ss]" en una zona dada → epoch ms. Acepta también ISO y epoch (s o ms). */
export function parseDate(v: unknown, tz = "UTC"): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" || /^\d{10,13}$/.test(String(v))) {
    const n = Number(v);
    return n < 1e12 ? n * 1000 : n;
  }
  const s = String(v).trim();
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m) return zonedToUtc(m[1], Number(m[2]), tz) + Number(m[3]) * 60_000 + Number(m[4] ?? 0) * 1000;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

/** Junta los parámetros de rastreo que vengan sueltos o en un objeto. */
export function collectTracking(...sources: unknown[]): Record<string, string> {
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id", "src", "sck", "xcod", "custom", "trackingkey", "campaignkey", "client_reference_id", "tid", "fbclid", "ttclid", "gclid", "page"];
  const out: Record<string, string> = {};
  for (const s of sources) {
    if (!s || typeof s !== "object") continue;
    for (const [k, v] of Object.entries(s as Record<string, unknown>)) {
      const kk = k.toLowerCase();
      if (keys.includes(kk) && v != null && v !== "" && !out[kk]) out[kk] = String(v);
    }
  }
  return out;
}
