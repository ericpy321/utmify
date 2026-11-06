import type { GatewayAdapter, NormalizedEvent } from "../types";
import { minorFactor } from "../../currency";
import { collectTracking, hmacHex, lower, readJson, safeEqual, str } from "../util";

// Stripe. Firma en la cabecera Stripe-Signature: "t=…,v1=…" = HMAC-SHA256 de "t.cuerpo" con el secreto whsec_.
// Montos en unidades mínimas (centavos), salvo monedas sin decimales como el guaraní.
export const stripe: GatewayAdapter = {
  read: (raw) => readJson(raw),
  verify(raw, _p, h, _u, secret) {
    const header = h.get("stripe-signature") ?? "";
    const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
    const t = parts.t;
    const v1 = header.split(",").filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
    if (!secret || !t || !v1.length) return false;
    if (Math.abs(Date.now() / 1000 - Number(t)) > 600) return false; // evita reenvíos viejos
    const expected = hmacHex("sha256", secret, `${t}.${raw}`);
    return v1.some((s) => safeEqual(s, expected));
  },
  parse(p) {
    const type = str(p.type);
    const o = ((p.data as Record<string, unknown>)?.object ?? {}) as Record<string, unknown>;
    const cur = str(o.currency).toUpperCase() || "USD";
    const amount = (v: unknown) => (v == null ? null : Number(v) / minorFactor(cur));
    const base = { eventType: type, currency: cur, occurredAt: Number(p.created ?? 0) * 1000 || Date.now(), productName: "", productExternalId: "stripe" };
    if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
      const paid = o.payment_status === "paid" || o.payment_status === "no_payment_required";
      const meta = (o.metadata ?? {}) as Record<string, unknown>;
      const tx = str(o.payment_intent ?? o.id);
      return [{
        ...base, kind: paid ? "approved" : "pending",
        transactionId: tx, orderId: tx,
        productExternalId: str(meta.product_id ?? o.payment_link ?? "stripe"),
        productName: str(meta.product_name ?? "Stripe"),
        gross: amount(o.amount_total), fee: null, net: null,
        email: lower((o.customer_details as Record<string, unknown> | undefined)?.email ?? o.customer_email),
        tracking: collectTracking(meta, { client_reference_id: o.client_reference_id }),
      }];
    }
    if (type === "charge.refunded") {
      const full = Number(o.amount_refunded) >= Number(o.amount);
      return [{ ...base, kind: full ? "refunded" : "ignored", transactionId: str(o.payment_intent ?? o.id), orderId: str(o.payment_intent ?? o.id), gross: amount(o.amount), tracking: {} }];
    }
    if (type === "charge.dispute.created") {
      return [{ ...base, kind: "chargeback", transactionId: str(o.payment_intent ?? o.charge), orderId: str(o.payment_intent ?? o.charge), gross: amount(o.amount), tracking: {} }];
    }
    return [{ ...base, kind: "ignored" as NormalizedEvent["kind"], transactionId: str(o.id ?? p.id), orderId: str(o.id ?? p.id), gross: null, tracking: {} }];
  },
};
