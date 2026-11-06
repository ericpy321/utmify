import type { GatewayAdapter, NormalizedEvent } from "../types";
import { collectTracking, lower, numOrNull, parseDate, readJson, safeEqual, str } from "../util";

// Webhook genérico para cualquier otro gateway (o un Zapier/Make en el medio).
// Seguridad mínima: secreto en la URL (?key=…). Formato JSON:
// { event: "approved"|"refunded"|"chargeback", transaction_id, order_id, parent_order_id, product_id, product_name,
//   product_kind, currency, gross, net, fee, email, created_at, utm_source, utm_medium, utm_campaign, utm_content, sck }
export const generic: GatewayAdapter = {
  read: (raw) => readJson(raw),
  verify(_raw, _p, h, url, secret) {
    const got = url.searchParams.get("key") ?? h.get("x-webhook-secret") ?? "";
    return !!secret && !!got && safeEqual(got, secret);
  },
  parse(p) {
    const e = str(p.event).toLowerCase();
    const kind: NormalizedEvent["kind"] = ["approved", "refunded", "chargeback", "pending", "checkout", "test"].includes(e) ? (e as NormalizedEvent["kind"]) : "ignored";
    const pk = str(p.product_kind);
    return [{
      kind, eventType: e,
      transactionId: str(p.transaction_id ?? p.order_id), orderId: str(p.order_id ?? p.transaction_id),
      parentOrderId: str(p.parent_order_id) || null,
      productExternalId: str(p.product_id), productName: str(p.product_name),
      kindHint: ["main", "bump", "upsell1", "upsell2", "downsell"].includes(pk) ? (pk as NormalizedEvent["kindHint"]) : undefined,
      currency: str(p.currency).toUpperCase() || "USD",
      gross: numOrNull(p.gross), net: numOrNull(p.net), fee: numOrNull(p.fee),
      email: lower(p.email), occurredAt: parseDate(p.created_at) ?? Date.now(),
      tracking: collectTracking(p, p.tracking),
    }];
  },
};
