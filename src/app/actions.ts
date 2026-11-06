"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LANGS, type Lang } from "@/lib/i18n/dictionaries";
import { requireUser } from "@/lib/auth";
import { persistSettings, sanitizeSettings } from "@/lib/settings";
import type { Settings } from "@/lib/types";

const YEAR = 60 * 60 * 24 * 365;

export async function setLang(lang: string) {
  if (!LANGS.includes(lang as Lang)) return;
  (await cookies()).set("lang", lang, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

// Las acciones de servidor son endpoints públicos: siempre verifican al usuario.
export async function saveSettings(input: Partial<Settings>) {
  await requireUser();
  const clean = sanitizeSettings(input);
  // Con la base conectada se guarda en la tabla `settings`; si no, en una cookie.
  if (await persistSettings(clean)) {
    revalidatePath("/", "layout");
    return clean;
  }
  (await cookies()).set("settings", JSON.stringify(clean), {
    path: "/", maxAge: YEAR, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/", "layout");
  return clean;
}

/** Botón "Actualizar". Con datos de ejemplo solo vuelve a leer; en la etapa 4 dispara la sincronización. */
export async function refreshData() {
  await requireUser();
  revalidatePath("/", "layout");
  return { ok: true, at: Date.now() };
}
