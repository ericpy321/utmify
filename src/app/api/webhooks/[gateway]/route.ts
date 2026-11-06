import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { gatewaySecrets, GATEWAYS, serviceConfigured, type GatewayId } from "@/lib/env";
import { adapters } from "@/lib/webhooks/gateways";
import { processEvent } from "@/lib/webhooks/process";
import { admin } from "@/lib/supabase/admin";

// Webhook público por gateway: /api/webhooks/digistore24, /hotmart, /kiwify, /stripe, /clickbank, /generic.
// 1) valida que vino del gateway, 2) guarda el evento bruto ANTES de procesar, 3) no cuenta dos veces el mismo evento.
export const dynamic = "force-dynamic";

async function handle(req: NextRequest, ctx: RouteContext<"/api/webhooks/[gateway]">) {
  const { gateway } = await ctx.params;
  if (!GATEWAYS.includes(gateway as GatewayId)) return NextResponse.json({ error: "gateway desconocido" }, { status: 404 });
  if (!serviceConfigured) return NextResponse.json({ error: "base no configurada" }, { status: 503 });
  const g = gateway as GatewayId;
  if (req.method === "GET" && g !== "digistore24") return NextResponse.json({ ok: true, gateway: g }, { status: 200 });
  const adapter = adapters[g];
  const secret = gatewaySecrets[g];
  const raw = req.method === "GET" ? "" : await req.text();
  const url = req.nextUrl;
  const payload = adapter.read(raw, req.headers.get("content-type") ?? "", url);
  const valid = adapter.verify(raw, payload, req.headers, url, secret);
  const db = admin();

  if (!valid) {
    // Se guarda para poder revisarlo, pero no se procesa.
    await db.from("webhook_events").insert({ gateway: g, event_type: null, transaction_id: null, dedupe_key: `invalido:${randomUUID()}`, signature_valid: false, payload, error: secret ? "firma inválida" : "falta el secreto del gateway en Vercel" });
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }

  const stored = adapter.toStore ? adapter.toStore(payload, secret) : payload;
  const events = adapter.parse(stored);
  for (const ev of events) {
    const dedupe = `${g}:${ev.transactionId || randomUUID()}:${ev.eventType}`;
    const { data: row, error } = await db.from("webhook_events").insert({
      gateway: g, event_type: ev.eventType, transaction_id: ev.transactionId, dedupe_key: dedupe, signature_valid: true, payload: stored,
    }).select("id").single();
    if (error) {
      if (error.code === "23505") continue; // mismo evento ya recibido: no se cuenta otra vez
      console.error("webhook_events", error.message);
      return NextResponse.json({ error: "no se pudo guardar" }, { status: 500 }); // el gateway reintenta
    }
    try {
      const result = await processEvent(g, ev, row.id);
      await db.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("id", row.id);
      console.log(`webhook ${g} ${ev.eventType}: ${result}`);
    } catch (e) {
      // El evento bruto queda guardado con el error y se puede reprocesar desde Conectar.
      await db.from("webhook_events").update({ error: e instanceof Error ? e.message : String(e) }).eq("id", row.id);
    }
  }
  return adapter.ok ? adapter.ok() : NextResponse.json({ ok: true });
}

export const POST = handle;
// Digistore24 puede enviar el IPN por GET.
export const GET = handle;
