import type { ProductKind } from "../types";

/** Qué significa el evento para el tracker. */
export type EventKind = "approved" | "refunded" | "chargeback" | "pending" | "checkout" | "test" | "ignored";

/** Evento de cualquier gateway, ya traducido a un formato único. */
export interface NormalizedEvent {
  kind: EventKind;
  eventType: string; // nombre original del evento en el gateway
  transactionId: string; // id único de esta venta en el gateway
  orderId: string; // pedido (puede agrupar principal + bump)
  parentOrderId?: string | null; // pedido principal, si el gateway lo manda
  productExternalId: string;
  productName: string;
  kindHint?: ProductKind; // si el gateway avisa que es bump/upsell
  currency: string;
  gross: number | null; // valor bruto en unidades normales (no centavos)
  fee?: number | null;
  net?: number | null;
  email?: string | null;
  occurredAt: number; // epoch ms
  tracking: Record<string, string>; // utm_*, sck, src, custom, etc. tal como llegaron
}

/** Cada gateway: valida el origen y traduce el contenido. */
export interface GatewayAdapter {
  /** Lee el cuerpo crudo como objeto (JSON o formulario). */
  read(raw: string, contentType: string, url: URL): Record<string, unknown>;
  /** true si la firma o el token son válidos. */
  verify(raw: string, payload: Record<string, unknown>, headers: Headers, url: URL, secret: string): boolean;
  /** Traduce el contenido a uno o más eventos (ClickBank manda varios productos en uno). */
  parse(payload: Record<string, unknown>): NormalizedEvent[];
  /** Qué se guarda como evento bruto (ClickBank: el mensaje ya descifrado). Por defecto, el contenido tal cual. */
  toStore?(payload: Record<string, unknown>, secret: string): Record<string, unknown>;
  /** Respuesta que espera el gateway cuando todo salió bien. */
  ok?: () => Response;
}
