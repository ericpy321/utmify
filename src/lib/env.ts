// Lectura central de variables de entorno. Nunca se imprimen ni se envían al navegador (salvo las NEXT_PUBLIC_).
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

/** Correos que pueden entrar al panel, separados por coma en ALLOWED_EMAILS. */
export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string | null | undefined) {
  if (!email) return false;
  return allowedEmails().includes(email.toLowerCase());
}

/** Solo en `next dev` y sin Supabase: deja ver el panel en local para desarrollar. Nunca en producción. */
export const demoWithoutAuth = !supabaseConfigured && process.env.NODE_ENV === "development";

// --- Claves solo de servidor (nunca NEXT_PUBLIC_) ---------------------------------------
/** Clave secreta de Supabase (sb_secret_… o service_role). Salta RLS: solo se usa en el servidor. */
export const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const serviceConfigured = Boolean(supabaseUrl && supabaseSecretKey);

/** Token del usuario del sistema de Meta (no vence). Permiso: ads_read. */
export const metaToken = process.env.META_ACCESS_TOKEN ?? "";
/** Versión de la Marketing API. Se puede subir sin tocar código cambiando la variable. */
export const metaApiVersion = process.env.META_API_VERSION || "v25.0";

/** App de TikTok for Business (portal de desarrolladores). */
export const tiktokAppId = process.env.TIKTOK_APP_ID ?? "";
export const tiktokSecret = process.env.TIKTOK_APP_SECRET ?? "";

/** Secreto que protege /api/sync (lo usa pg_cron desde Supabase). */
export const syncSecret = process.env.SYNC_SECRET ?? "";

/** Secretos de cada gateway, para validar que el evento vino de ahí. */
export const gatewaySecrets = {
  hotmart: process.env.HOTMART_HOTTOK ?? "",
  stripe: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  whop: process.env.WHOP_WEBHOOK_SECRET ?? "",
  digistore24: process.env.DIGISTORE24_IPN_PASSPHRASE ?? "",
  kiwify: process.env.KIWIFY_WEBHOOK_TOKEN ?? "",
  clickbank: process.env.CLICKBANK_SECRET_KEY ?? "",
  generic: process.env.WEBHOOK_SECRET ?? "",
};
export type GatewayId = keyof typeof gatewaySecrets;
export const GATEWAYS = Object.keys(gatewaySecrets) as GatewayId[];

export function siteUrl(fallbackHost?: string | null) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return fallbackHost ? `https://${fallbackHost}` : "";
}

/** Google Ads API: token de desarrollador (Centro de API de tu MCC) y cliente OAuth (Google Cloud). */
export const googleDevToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
export const googleClientId = process.env.GOOGLE_ADS_CLIENT_ID ?? "";
export const googleClientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET ?? "";
/** Opcional: id de tu cuenta administradora (MCC), solo números. */
export const googleLoginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(/\D/g, "");
export const googleApiVersion = process.env.GOOGLE_ADS_API_VERSION || "v24";
export const googleConfigured = Boolean(googleDevToken && googleClientId && googleClientSecret);
