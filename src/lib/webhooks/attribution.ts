import type { Platform } from "../types";

// Lee el anuncio de origen de los parámetros que devolvió el gateway.
// El script de rastreo manda la origen compacta como "f_<id del anuncio>" (Meta) o "t_<id>" (TikTok)
// en los campos que cada gateway devuelve (custom, sck, client_reference_id, tid…).
export interface Attribution {
  platform: Platform | null;
  campaignId: string | null;
  adsetId: string | null;
  adId: string | null;
  sourcePage: string | null;
}

const COMPACT = /(?:^|[^a-z0-9])([ft])_(\d{5,25})(?:_(\d{5,25}))?(?:_(\d{5,25}))?/i;
const isId = (s?: string) => !!s && /^\d{5,25}$/.test(s);

export function decodeCompact(v?: string | null): { platform: Platform; adId: string; adsetId?: string; campaignId?: string } | null {
  if (!v) return null;
  const m = COMPACT.exec(v);
  if (!m) return null;
  return { platform: m[1].toLowerCase() === "f" ? "meta" : "tiktok", adId: m[2], adsetId: m[3], campaignId: m[4] };
}

export function platformFromSource(src?: string): Platform | null {
  const s = (src ?? "").toLowerCase();
  if (/^(fb|facebook|ig|instagram|meta)/.test(s)) return "meta";
  if (/^(tiktok|tt)/.test(s)) return "tiktok";
  return null;
}

export function attributionFrom(t: Record<string, string>): Attribution {
  const page = t.page ?? null;
  for (const k of ["custom", "sck", "trackingkey", "client_reference_id", "tid", "utm_id", "src"]) {
    const c = decodeCompact(t[k]);
    if (c) return { platform: c.platform, adId: c.adId, adsetId: c.adsetId ?? null, campaignId: c.campaignId ?? null, sourcePage: page };
  }
  const platform = platformFromSource(t.utm_source) ?? platformFromSource(t.src);
  if (isId(t.utm_content)) {
    return {
      platform, adId: t.utm_content,
      adsetId: isId(t.utm_medium) ? t.utm_medium : null,
      campaignId: isId(t.utm_campaign) ? t.utm_campaign : null,
      sourcePage: page,
    };
  }
  return { platform: null, campaignId: null, adsetId: null, adId: null, sourcePage: page };
}
