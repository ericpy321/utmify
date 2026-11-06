import type { Platform } from "./types";

// Plataformas de anuncios del tracker y su nombre en pantalla (igual en los tres idiomas).
export const PLATFORMS: Platform[] = ["meta", "tiktok", "google"];
export const PLATFORM_LABEL: Record<Platform, string> = { meta: "Meta", tiktok: "TikTok", google: "Google" };
export const platformLabel = (p: string | null | undefined) => (p && p in PLATFORM_LABEL ? PLATFORM_LABEL[p as Platform] : "—");
