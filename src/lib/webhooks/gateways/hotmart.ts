import type { GatewayAdapter, NormalizedEvent } from "../types";
import { collectTracking, first, lower, numOrNull, parseDate, pick, readJson, safeEqual, str } from "../util";

// Hotmart Webhook 2.0.0 (JSON). Se valida el hottok de la cabecera X-HOTMART-HOTTOK (o del cuerpo).
const KIND: Record<string, NormalizedEvent["kind"]> = {
  PURCHASE_APPROVED: "approved",
  PURCHASE_REFUNDED: "refunded",
  PURCHASE_CHARGEBACK: "chargeback",
  PURCHASE_PROTEST: "ignored", // pedido de reembolso en análisis: aún no se descuenta
  PURCHASE_CANCELED: "ignored",
  PURCHASE_COMPLETE: "ignored", // fin de la garantía, la venta ya se contó
  PURCHASE_BILLET_PRINTED: "pending",
  PURCHASE_DELAYED: "pending",
  PURCHASE_EXPIRED: "ignored",
  PURCHASE_OUT_OF_SHOPPING_CART: "checkout", // abandono de carrito = checkout iniciado
};

export const hotmart: GatewayAdapter = {
  read: (raw) => readJson(raw),
  verify(_raw, p, h, _u, secret) {
    const got = h.get("x-hotmart-hottok") ?? str(p.hottok);
    return !!secret && !!got && safeEqual(got, secret);
  },
  parse(p) {
    const event = str(p.event);
    const d = p.data as Record<string, unknown> | undefined;
    const purchase = (d?.purchase ?? {}) as Record<string, unknown>;
    const commissions = (Array.isArray(d?.commissions) ? d?.commissions : []) as Record<string, unknown>[];
    const producer = commissions.find((c) => str(c.source).toUpperCase() === "PRODUCER");
    const market = commissions.find((c) => str(c.source).toUpperCase() === "MARKETPLACE");
    const isBump = Boolean(first(purchase, "order_bump.is_order_bump", "is_order_bump"));
    const tx = str(first(purchase, "transaction") ?? p.id);
    return [{
      kind: KIND[event] ?? "ignored",
      eventType: event,
      transactionId: tx,
      orderId: tx,
      parentOrderId: str(first(purchase, "order_bump.parent_purchase_transaction")) || null,
      productExternalId: str(pick(d, "product.id")),
      productName: str(pick(d, "product.name")),
      kindHint: isBump ? "bump" : undefined,
      currency: str(first(purchase, "price.currency_value", "full_price.currency_value") ?? producer?.currency_value).toUpperCase() || "BRL",
      gross: numOrNull(first(purchase, "price.value", "full_price.value")),
      net: numOrNull(producer?.value),
      fee: numOrNull(market?.value),
      email: lower(pick(d, "buyer.email")),
      occurredAt: parseDate(first(purchase, "approved_date", "order_date")) ?? parseDate(p.creation_date) ?? Date.now(),
      tracking: collectTracking(purchase.origin, purchase),
    }];
  },
};
