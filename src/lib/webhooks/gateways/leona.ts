import type { GatewayAdapter, NormalizedEvent } from "../types";
import { collectTracking, first, numOrNull, parseDate, readJson, safeEqual, str } from "../util";

// Leona Flow (bot de WhatsApp). El bloque "Integración HTTP" del flujo de venta llama a
// /api/webhooks/leona?key=<LEONA_WEBHOOK_SECRET> justo después de "Venta aprobada".
// La venta trae el id del anuncio de Meta (source_id) cuando el cliente vino de un anuncio "clic a WhatsApp".
const isAdId = (v: string) => /^\d{10,25}$/.test(v); // descarta variables que Leona no reemplazó, ej "{customer.x}"

export const leona: GatewayAdapter = {
  read: (raw) => readJson(raw),
  verify(_raw, _p, h, url, secret) {
    const got = url.searchParams.get("key") ?? h.get("x-webhook-secret") ?? "";
    return !!secret && !!got && safeEqual(got, secret);
  },
  parse(p) {
    const phone = str(first(p, "phone", "lead_number")).replace(/\D/g, "");
    // Acepta "35000", "35.000", "Gs. 35.000" o "35.000,50": se lee desde el primer número.
    const rawAmount = str(p.amount).replace(/^[^\d]+/, "").replace(/[^\d.,]/g, "");
    const amount = numOrNull(rawAmount.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    const occurredAt = parseDate(first(p, "sold_at", "created_at")) ?? Date.now();
    // La venta importada trae su id de Leona; la del flujo no, así que se arma con teléfono + minuto.
    const id = str(p.sale_id) || `${phone}-${Math.floor(occurredAt / 60_000)}`;
    const sourceId = [p.source_id, p.ad_id, p.ctwa_source_id].map(str).find(isAdId) ?? "";
    const kind: NormalizedEvent["kind"] = str(p.event || "approved") === "approved" ? "approved" : "ignored";
    return [{
      kind, eventType: "approved",
      transactionId: `leona-${id}`, orderId: `leona-${id}`,
      productExternalId: str(first(p, "product_id", "product")) || "leona",
      productName: str(first(p, "product", "product_name")) || "Leona",
      currency: str(p.currency).toUpperCase().replace(/[^A-Z]/g, "") || "PYG",
      gross: amount, net: null, fee: null,
      // Cliente de WhatsApp: se guarda el teléfono como identificador (sirve para ligar upsells en 24 h).
      email: phone ? `${phone}@whatsapp` : null,
      occurredAt,
      tracking: { ...collectTracking(p), ...(sourceId ? { utm_source: "fb", utm_content: sourceId } : {}), ...(p.flow ? { page: `leona:${str(p.flow)}` } : {}) },
    }];
  },
};
