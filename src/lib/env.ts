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
