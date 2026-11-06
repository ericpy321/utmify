import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { discoverGoogleAccounts, exchangeGoogleCode } from "@/lib/sync/google";

// Vuelta de la autorización de Google: guarda el refresh token en una tabla que solo lee el servidor.
export async function GET(req: NextRequest) {
  await requireUser();
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const back = (q: string) => {
    const r = NextResponse.redirect(new URL(`/connect?google=${q}`, url.origin));
    r.cookies.delete("g_state");
    return r;
  };
  if (!code || !state || state !== req.cookies.get("g_state")?.value) return back("estado_invalido");
  try {
    await exchangeGoogleCode(code, `${siteUrl(req.headers.get("host"))}/api/google/callback`);
    await discoverGoogleAccounts();
    return back("ok");
  } catch (e) {
    console.error("Google callback", e instanceof Error ? e.message : e);
    return back("error");
  }
}
