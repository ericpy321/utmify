import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { discoverTikTokAccounts, exchangeTikTokCode } from "@/lib/sync/tiktok";

// Vuelta de la autorización de TikTok. El código vale una vez y expira en una hora:
// se cambia de inmediato por el token de largo plazo y se guarda en una tabla que solo lee el servidor.
export async function GET(req: NextRequest) {
  await requireUser();
  const url = req.nextUrl;
  const code = url.searchParams.get("auth_code") ?? url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const back = (q: string) => {
    const r = NextResponse.redirect(new URL(`/connect?tiktok=${q}`, url.origin));
    r.cookies.delete("tt_state");
    return r;
  };
  if (!code || !state || state !== req.cookies.get("tt_state")?.value) return back("estado_invalido");
  try {
    const ids = await exchangeTikTokCode(code);
    await discoverTikTokAccounts(ids);
    return back("ok");
  } catch (e) {
    console.error("TikTok callback", e instanceof Error ? e.message : e);
    return back("error");
  }
}
