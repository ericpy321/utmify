import "server-only";
import { redirect } from "next/navigation";
import { demoWithoutAuth, isAllowedEmail } from "./env";
import { createClient } from "./supabase/server";

// Segunda barrera (además del proxy): cada pantalla vuelve a verificar al usuario en el servidor.
export async function requireUser(): Promise<{ email: string | null; demo: boolean }> {
  if (demoWithoutAuth) return { email: null, demo: true };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) redirect("/login");
  return { email: user.email ?? null, demo: false };
}
