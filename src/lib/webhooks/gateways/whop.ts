import { createHmac } from "node:crypto";
import type { GatewayAdapter, NormalizedEvent } from "../types";
import { collectTracking, first, lower, numOrNull, parseDate, readJson, safeEqual, str } from "../util";

// Whop: webhooks con el estándar "Standard Webhooks". Cabeceras webhook-id, webhook-timestamp y webhook-signature
// ("v1,<base64>"). Firma = HMAC-SHA256 en base64 de "id.timestamp.cuerpo". Hay reportes de que Whop usa el secreto
// tal cual (no decodificado), así que se prueban las dos formas.
function keysFor(secret: string): Buffer[] {
  const keys = [Buffer.from(secret, "utf8")];
  const b64 = secret.replace(/^(whsec_|ws_)/, "");
  try {
    const dec = Buffer.from(b64, "base64");
    if (dec.length >= 16) keys.push(dec);
  } catch {}
  return keys;
}

const KIND: Record<string, NormalizedEvent["kind"]> = {
  "payment.succeeded": "approved",
  "payment.failed": "ignored",
  "payment.pending": "pending",
  "refund.created": "refunded",
  "refund.updated": "ignored",
  "payment.refunded": "refunded",
  "dispute.created": "chargeback",
  "payment.disputed": "chargeback",
};

export const whop: GatewayAdapter = {
  read: (raw) => readJson(raw),
  verify(raw, _p, h, _u, secret) {
    const id = h.get("webhook-id") ?? "", ts = h.get("webhook-timestamp") ?? "", sig = h.get("webhook-signature") ?? "";
    if (!secret || !id || !ts || !sig) return false;
    if (Math.abs(Date.now() / 1000 - Number(ts)) > 600) return false; // evita reenvíos viejos
    const given = sig.split(" ").map((s) => s.split(",")[1]).filter(Boolean);
    return keysFor(secret).some((k) => {
      const expected = createHmac("sha256", k).update(`${id}.${ts}.${raw}`, "utf8").digest("base64");
      return given.some((g) => safeEqual(g, expected));
    });
  },
  parse(p) {
    const type = str(p.type ?? p.action ?? p.event);
    const d = (p.data ?? {}) as Record<string, unknown>;
    const kind = KIND[type] ?? "ignored";
    // En reembolsos y disputas, la venta original es el pago al que apuntan.
    const paymentId = kind === "approved" || kind === "pending"
      ? str(first(d, "id", "payment_id"))
      : str(first(d, "payment.id", "payment_id", "id"));
    const pay = (kind === "approved" || kind === "pending" ? d : (d.payment as Record<string, unknown>) ?? d);
    return [{
      kind, eventType: type,
      transactionId: paymentId,
      orderId: paymentId,
      productExternalId: str(first(pay, "product.id", "product_id", "plan.product_id", "plan.id", "plan_id")),
      productName: str(first(pay, "product.title", "product.name", "plan.title", "product_title")),
      currency: str(first(pay, "currency", "settlement_currency")).toUpperCase() || "USD",
      gross: numOrNull(first(pay, "total", "final_amount", "amount", "subtotal", "usd_total")),
      net: numOrNull(first(pay, "amount_after_fees", "net_amount")),
      fee: numOrNull(first(pay, "fees", "fee_amount")),
      email: lower(first(pay, "user.email", "user_email", "email", "billing_address.email", "member.email")),
      occurredAt: parseDate(first(pay, "paid_at", "created_at") ?? p.timestamp) ?? Date.now(),
      tracking: collectTracking(pay.metadata, pay.checkout_metadata, pay),
    }];
  },
};
