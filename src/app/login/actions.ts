"use server";
import { headers } from "next/headers";
import { isAllowedEmail, supabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error" | "not_configured" };

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!supabaseConfigured) return { status: "not_configured" };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  // Misma respuesta para correos autorizados y no autorizados: no revelamos quién tiene acceso.
  if (!isAllowedEmail(email)) return { status: "sent" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback`, shouldCreateUser: true },
  });
  if (error) return { status: "error" };
  return { status: "sent" };
}
