import type { GatewayAdapter, NormalizedEvent } from "../types";
import { collectTracking, first, hmacHex, lower, numOrNull, parseDate, readJson, safeEqual, str } from "../util";

// Kiwify (JSON). Firma: parámetro `signature` en la URL = HMAC-SHA1 (hex) del cuerpo crudo con el token del webhook.
// Montos de Commissions en centavos.
const KIND: Record<string, NormalizedEvent["kind"]> = {
  order_approved: "approved", paid: "approved", approved: "approved",
  order_refunded: "refunded", refunded: "refunded",
  chargeback: "chargeback", chargedback: "chargeback",
  billet_created: "pending", pix_created: "pending", waiting_payment: "pending",
  order_rejected: "ignored", refused: "ignored",
  abandoned_cart: "checkout",
};
const cents = (v: unknown) => {
  const n = numOrNull(v);
  return n == null ? null : n / 100;
};

export const kiwify: GatewayAdapter = {
  read: (raw) => readJson(raw),
  verify(raw, _p, _h, url, secret) {
    const got = (url.searchParams.get("signature") ?? "").toLowerCase();
    return !!secret && !!got && safeEqual(got, hmacHex("sha1", secret, raw));
  },
  parse(p) {
    // El carrito abandonado llega con otro formato (sin webhook_event_type ni order_status).
    const event = str(p.webhook_event_type ?? p.order_status) || (p.checkout_link ? "abandoned_cart" : "");
    const c = (p.Commissions ?? {}) as Record<string, unknown>;
    const id = str(first(p, "order_id", "id"));
    return [{
      kind: KIND[event] ?? "ignored",
      eventType: event,
      transactionId: id,
      orderId: str(first(p, "order_ref", "order_id", "id")),
      parentOrderId: str(first(p, "parent_order_id", "upsell.parent_order_id")) || null,
      productExternalId: str(first(p, "Product.product_id", "product_id")),
      productName: str(first(p, "Product.product_name", "product_name")),
      currency: str(first(c, "currency", "product_base_price_currency") ?? "BRL").toUpperCase(),
      gross: cents(first(c, "charge_amount", "product_base_price")),
      net: cents(c.my_commission),
      fee: cents(c.kiwify_fee),
      email: lower(first(p, "Customer.email", "email")),
      occurredAt: parseDate(first(p, "approved_date", "created_at"), "America/Sao_Paulo") ?? Date.now(),
      tracking: collectTracking(p.TrackingParameters, p),
    }];
  },
};
