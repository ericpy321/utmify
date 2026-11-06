import { createDecipheriv } from "node:crypto";
import type { GatewayAdapter, NormalizedEvent } from "../types";
import { collectTracking, hashHex, lower, numOrNull, parseDate, readJson, str } from "../util";

// ClickBank INS (versión 6 o superior, JSON cifrado). La clave es la "Secret Key" de la cuenta:
// AES-256-CBC con los primeros 32 caracteres del SHA-1 (hex) de la clave y el IV que viene en el mensaje.
// Que se pueda descifrar ya prueba que lo mandó ClickBank.
function decrypt(p: Record<string, unknown>, secret: string): Record<string, unknown> | null {
  try {
    const key = Buffer.from(hashHex("sha1", secret).slice(0, 32), "utf8");
    const iv = Buffer.from(str(p.iv), "base64");
    const d = createDecipheriv("aes-256-cbc", key, iv);
    d.setAutoPadding(false);
    const text = Buffer.concat([d.update(Buffer.from(str(p.notification), "base64")), d.final()]).toString("utf8");
    return JSON.parse(text.replace(/[\u0000-\u001f]+$/g, "").trim());
  } catch {
    return null;
  }
}

const KIND: Record<string, NormalizedEvent["kind"]> = {
  SALE: "approved", BILL: "approved", RFND: "refunded", CGBK: "chargeback", INSF: "ignored",
  TEST: "test", TEST_SALE: "test", TEST_BILL: "test", TEST_RFND: "test", TEST_CGBK: "test",
};

export const clickbank: GatewayAdapter = {
  read: (raw) => readJson(raw),
  verify(_raw, p, _h, _u, secret) {
    return !!secret && decrypt(p, secret) != null;
  },
  toStore: (p, secret) => decrypt(p, secret) ?? p,
  parse(n) {
    const type = str(n.transactionType);
    const items = (Array.isArray(n.lineItems) ? n.lineItems : [{}]) as Record<string, unknown>[];
    const receipt = str(n.receipt);
    const parent = str((n.upsell as Record<string, unknown> | undefined)?.upsellOriginalReceipt) || null;
    return items.map((it, i) => ({
      kind: KIND[type] ?? "ignored",
      eventType: type,
      transactionId: `${receipt}-${str(it.itemNo) || i}`,
      orderId: receipt,
      parentOrderId: parent,
      productExternalId: str(it.itemNo),
      productName: str(it.productTitle),
      kindHint: str(it.lineItemType).toUpperCase() === "BUMP" ? "bump" : str(it.lineItemType).toUpperCase() === "UPSELL" ? "upsell1" : undefined,
      currency: str(n.currency).toUpperCase() || "USD",
      gross: numOrNull(it.customerProductAmount ?? (items.length === 1 ? n.totalOrderAmount : null)),
      net: numOrNull(it.accountAmount),
      fee: null,
      email: lower((n.customer as Record<string, Record<string, unknown>> | undefined)?.billing?.email),
      occurredAt: parseDate(n.transactionTime) ?? Date.now(),
      tracking: collectTracking(n.vendorVariables, { tid: (Array.isArray(n.trackingCodes) ? n.trackingCodes[0] : undefined) }),
    }));
  },
};
