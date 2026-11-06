import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { siteUrl, tiktokAppId } from "@/lib/env";
import { tiktokAuthUrl } from "@/lib/sync/tiktok";

// Botón "Conectar TikTok": te lleva a autorizar la app en TikTok for Business.
export async function GET(req: NextRequest) {
  await requireUser();
  if (!tiktokAppId) return NextResponse.redirect(new URL("/connect?tiktok=sin_app", req.url));
  const state = randomBytes(16).toString("hex");
  const redirect = `${siteUrl(req.headers.get("host"))}/api/tiktok/callback`;
  const res = NextResponse.redirect(tiktokAuthUrl(redirect, state));
  res.cookies.set("tt_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
