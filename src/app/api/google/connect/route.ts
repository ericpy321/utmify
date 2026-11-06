import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { googleConfigured, siteUrl } from "@/lib/env";
import { googleAuthUrl } from "@/lib/sync/google";

// Botón "Conectar Google Ads": autorizas con tu cuenta de Google (permiso de solo lectura de anuncios).
export async function GET(req: NextRequest) {
  await requireUser();
  if (!googleConfigured) return NextResponse.redirect(new URL("/connect?google=sin_app", req.url));
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(googleAuthUrl(`${siteUrl(req.headers.get("host"))}/api/google/callback`, state));
  res.cookies.set("g_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
