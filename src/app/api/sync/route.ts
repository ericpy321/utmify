import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serviceConfigured, syncSecret } from "@/lib/env";
import { runSync } from "@/lib/sync/run";

// La llama pg_cron (Supabase) cada 15 minutos con el secreto guardado en el Vault.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!syncSecret || !got) return false;
  const a = Buffer.from(got), b = Buffer.from(syncSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  if (!serviceConfigured) return NextResponse.json({ error: "Supabase no configurado" }, { status: 500 });
  const results = await runSync();
  return NextResponse.json({ ok: results.every((r) => r.ok), results });
}

export const GET = handle;
export const POST = handle;
