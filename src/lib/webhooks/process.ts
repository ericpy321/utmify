import "server-only";
import { admin } from "../supabase/admin";
import type { ProductKind } from "../types";
import type { NormalizedEvent } from "./types";
import { attributionFrom } from "./attribution";

const DAY = 86_400_000;

/**
 * Procesa un evento ya validado y guardado en `webhook_events`.
 * - Aprobada: crea la venta (una sola vez por gateway + transacción).
 * - Reembolso / chargeback: cambia el estado de la venta (y la descuenta de la facturación).
 * - Boleto o Pix generados: no cuentan como venta hasta que se pagan.
 * - Bumps y upsells: se ligan al pedido principal y heredan su anuncio de origen.
 */
export async function processEvent(gateway: string, ev: NormalizedEvent, rawEventId: number) {
  const db = admin();
  if (ev.kind === "test" || ev.kind === "ignored" || ev.kind === "pending") return ev.kind;

  const product = ev.productExternalId ? await resolveProduct(gateway, ev) : null;

  if (ev.kind === "checkout") {
    await db.from("checkout_events").insert({ gateway, offer_id: product?.offer_id ?? null, created_at_utc: new Date(ev.occurredAt).toISOString(), raw_event_id: rawEventId });
    return "checkout";
  }

  if (ev.kind === "refunded" || ev.kind === "chargeback") {
    const sale = await findSale(gateway, ev);
    if (sale) {
      const { error } = await db.from("sales").update({ status: ev.kind, refunded_at: new Date(ev.occurredAt).toISOString(), updated_at: new Date().toISOString() }).eq("id", sale.id);
      if (error) throw new Error(error.message);
      return `${ev.kind}: venta actualizada`;
    }
    // Llegó el reembolso de una venta que no teníamos: se guarda igual, con su estado.
  }

  if (ev.gross == null) throw new Error("El evento no trae el valor de la venta");

  // Leona: la venta del flujo no trae id; si ya existe una del mismo cliente y valor en ±30 min, es la misma.
  if (gateway === "leona" && ev.email) {
    const { data: dup } = await db.from("sales").select("id").eq("gateway", "leona").eq("buyer_email", ev.email).eq("gross", ev.gross)
      .gte("created_at_utc", new Date(ev.occurredAt - 30 * 60_000).toISOString())
      .lte("created_at_utc", new Date(ev.occurredAt + 30 * 60_000).toISOString()).limit(1).maybeSingle();
    if (dup) return "duplicada: ya registrada";
  }

  const kind: ProductKind = ev.kindHint ?? product?.kind ?? "main";
  let attr = attributionFrom(ev.tracking);
  let parentOrderId = ev.parentOrderId ?? null;

  if (kind !== "main") {
    // Pedido principal: el que manda el gateway, o la última compra principal del mismo e-mail en 24 horas.
    let parent: Record<string, unknown> | null = null;
    if (parentOrderId && /^[\w.:-]{1,120}$/.test(parentOrderId)) {
      const { data } = await db.from("sales").select("*").eq("gateway", gateway).or(`order_id.eq.${parentOrderId},transaction_id.eq.${parentOrderId}`).eq("product_kind", "main").limit(1).maybeSingle();
      parent = data;
    }
    if (!parent && ev.email) {
      const { data } = await db.from("sales").select("*").eq("buyer_email", ev.email).eq("product_kind", "main")
        .lte("created_at_utc", new Date(ev.occurredAt + 60_000).toISOString())
        .gte("created_at_utc", new Date(ev.occurredAt - DAY).toISOString())
        .order("created_at_utc", { ascending: false }).limit(1).maybeSingle();
      parent = data;
    }
    if (parent) {
      parentOrderId = String(parent.order_id);
      if (!attr.adId) {
        attr = { platform: parent.platform as typeof attr.platform, campaignId: parent.campaign_id as string, adsetId: parent.adset_id as string, adId: parent.ad_id as string, sourcePage: parent.source_page as string };
      }
    }
  }

  const row = {
    gateway, transaction_id: ev.transactionId, order_id: ev.orderId || ev.transactionId, parent_order_id: parentOrderId,
    offer_id: product?.offer_id ?? null, product_id: product?.id ?? null, product_kind: kind,
    product_name: ev.productName || null, product_external_id: ev.productExternalId || null,
    status: ev.kind === "approved" ? "approved" : ev.kind, currency: ev.currency, gross: ev.gross,
    fee: ev.fee ?? null, net: ev.net ?? null, buyer_email: ev.email ?? null,
    created_at_utc: new Date(ev.occurredAt).toISOString(),
    refunded_at: ev.kind === "approved" ? null : new Date(ev.occurredAt).toISOString(),
    platform: attr.platform, campaign_id: attr.campaignId, adset_id: attr.adsetId, ad_id: attr.adId,
    tracking: ev.tracking, source_page: attr.sourcePage, raw_event_id: rawEventId, updated_at: new Date().toISOString(),
  };
  // Si la venta ya existe (reenvío del gateway), no se duplica ni se pisa un reembolso posterior.
  const { error } = await db.from("sales").upsert(row, { onConflict: "gateway,transaction_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return `${row.status}: ${kind}`;
}

async function findSale(gateway: string, ev: NormalizedEvent) {
  const db = admin();
  const byTx = await db.from("sales").select("id").eq("gateway", gateway).eq("transaction_id", ev.transactionId).maybeSingle();
  if (byTx.data) return byTx.data;
  if (!ev.orderId) return null;
  let q = db.from("sales").select("id").eq("gateway", gateway).eq("order_id", ev.orderId);
  if (ev.productExternalId) q = q.eq("product_external_id", ev.productExternalId);
  const byOrder = await q.limit(1).maybeSingle();
  return byOrder.data;
}

/** Busca el producto del gateway; si es nuevo lo crea "sin asignar" para que elijas oferta y tipo en Configuración. */
async function resolveProduct(gateway: string, ev: NormalizedEvent): Promise<{ id: string; offer_id: string | null; kind: ProductKind } | null> {
  const db = admin();
  const { data } = await db.from("products").select("id,offer_id,kind").eq("gateway", gateway).eq("gateway_product_id", ev.productExternalId).maybeSingle();
  if (data) return data as { id: string; offer_id: string | null; kind: ProductKind };
  const { data: created, error } = await db.from("products").insert({
    gateway, gateway_product_id: ev.productExternalId, name: ev.productName || ev.productExternalId,
    kind: ev.kindHint ?? "main", price: ev.gross ?? 0, currency: ev.currency, offer_id: null,
  }).select("id,offer_id,kind").single();
  if (error) {
    // Dos eventos simultáneos del mismo producto: el otro ya lo creó.
    const again = await db.from("products").select("id,offer_id,kind").eq("gateway", gateway).eq("gateway_product_id", ev.productExternalId).maybeSingle();
    return (again.data as { id: string; offer_id: string | null; kind: ProductKind }) ?? null;
  }
  return created as { id: string; offer_id: string | null; kind: ProductKind };
}
