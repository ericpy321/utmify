import type { GatewayAdapter, NormalizedEvent } from "../types";
import { collectTracking, first, hashHex, lower, numOrNull, readForm, safeEqual, str } from "../util";

// Digistore24 IPN. Firma `sha_sign`: SHA-512 en mayúsculas de, por cada parámetro (sin sha_sign/SHASIGN y sin
// valores vacíos), ordenado por nombre: "nombre=valor" + frase-senha del IPN. La documentación no deja claro si el
// orden distingue mayúsculas, así que se aceptan las dos variantes. La ruta TIENE que responder exactamente "OK".
function sign(p: Record<string, unknown>, pass: string, caseInsensitive: boolean) {
  const keys = Object.keys(p).filter((k) => !["sha_sign", "shasign"].includes(k.toLowerCase()) && str(p[k]) !== "");
  keys.sort(caseInsensitive ? (a, b) => a.toLowerCase().localeCompare(b.toLowerCase()) : undefined);
  return hashHex("sha512", keys.map((k) => `${k}=${str(p[k])}${pass}`).join("")).toUpperCase();
}

const KIND: Record<string, NormalizedEvent["kind"]> = {
  connection_test: "test",
  on_payment: "approved",
  on_refund: "refunded",
  on_chargeback: "chargeback",
  on_payment_missed: "ignored",
  on_rebill_cancelled: "ignored",
  on_rebill_resumed: "ignored",
  last_paid_day: "ignored",
};

export const digistore24: GatewayAdapter = {
  read: (raw, _ct, url) => readForm(raw, url),
  verify(_raw, p, _h, _u, secret) {
    const got = str(p.sha_sign ?? p.SHASIGN).toUpperCase();
    if (!got) return str(p.event) === "connection_test" && !secret; // sin frase-senha configurada solo pasa el test
    return safeEqual(got, sign(p, secret, false)) || safeEqual(got, sign(p, secret, true));
  },
  parse(p) {
    const event = str(p.event);
    const kind = KIND[event] ?? "ignored";
    const upsellNo = Number(p.upsell_no ?? 0);
    return [{
      kind, eventType: event,
      transactionId: str(first(p, "transaction_id", "order_id")),
      orderId: str(p.order_id),
      productExternalId: str(p.product_id),
      productName: str(p.product_name),
      kindHint: upsellNo >= 2 ? "upsell2" : upsellNo === 1 ? "upsell1" : undefined,
      currency: str(first(p, "transaction_currency", "currency")).toUpperCase() || "USD",
      gross: numOrNull(first(p, "transaction_amount", "amount")),
      net: numOrNull(first(p, "vendor_earnings", "earnings", "amount_vendor", "transaction_vendor_amount")),
      fee: numOrNull(first(p, "transaction_fee", "fee")),
      email: lower(first(p, "email", "address_email", "buyer_email")),
      occurredAt: Date.now(),
      tracking: collectTracking(p),
    }];
  },
  ok: () => new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } }),
};
