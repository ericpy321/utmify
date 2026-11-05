import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/env";

// Vuelta del enlace mágico. Acepta el flujo con `code` (PKCE) y el de `token_hash`.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;

  if (ok) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && isAllowedEmail(user.email)) return NextResponse.redirect(new URL("/", url.origin));
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login?error=1", url.origin));
}
