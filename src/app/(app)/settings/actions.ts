"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { serviceConfigured } from "@/lib/env";
import { admin } from "@/lib/supabase/admin";
import type { ProductKind } from "@/lib/types";

const KINDS: ProductKind[] = ["main", "bump", "upsell1", "upsell2", "downsell"];
type Result = { ok: boolean; message: string };

async function guard(): Promise<Result | null> {
  await requireUser();
  return serviceConfigured ? null : { ok: false, message: "Supabase no configurado" };
}

export async function createOffer(code: string, name: string): Promise<Result> {
  const g = await guard(); if (g) return g;
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{2,4}$/.test(c)) return { ok: false, message: "El código debe tener de 2 a 4 letras (ej: AT)" };
  const { error } = await admin().from("offers").insert({ code: c, name: name.trim() || c });
  revalidatePath("/", "layout");
  return error ? { ok: false, message: error.message } : { ok: true, message: "" };
}

export async function deleteOffer(id: string): Promise<Result> {
  const g = await guard(); if (g) return g;
  const db = admin();
  await db.from("products").update({ offer_id: null }).eq("offer_id", id);
  await db.from("sales").update({ offer_id: null }).eq("offer_id", id);
  const { error } = await db.from("offers").delete().eq("id", id);
  revalidatePath("/", "layout");
  return error ? { ok: false, message: error.message } : { ok: true, message: "" };
}

/** Asigna oferta y tipo a un producto, y lo aplica también a las ventas que ya llegaron de él. */
export async function updateProduct(id: string, offerId: string | null, kind: ProductKind): Promise<Result> {
  const g = await guard(); if (g) return g;
  if (!KINDS.includes(kind)) return { ok: false, message: "tipo inválido" };
  const db = admin();
  const { error } = await db.from("products").update({ offer_id: offerId || null, kind }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  await db.from("sales").update({ offer_id: offerId || null, product_kind: kind }).eq("product_id", id);
  revalidatePath("/", "layout");
  return { ok: true, message: "" };
}

export async function setBatchStatus(offerId: string, code: string, status: "testing" | "finished", createdAt: string): Promise<Result> {
  const g = await guard(); if (g) return g;
  const { error } = await admin().from("batches").upsert(
    { offer_id: offerId, code, status, ...( /^\d{4}-\d{2}-\d{2}$/.test(createdAt) ? { created_at: createdAt } : {}) },
    { onConflict: "offer_id,code" },
  );
  revalidatePath("/creatives", "layout");
  return error ? { ok: false, message: error.message } : { ok: true, message: "" };
}

export async function setCreativeMeta(code: string, offerId: string, field: "copywriter" | "editor", value: string): Promise<Result> {
  const g = await guard(); if (g) return g;
  const { error } = await admin().from("creatives").upsert({ code, offer_id: offerId, [field]: value.trim() || null }, { onConflict: "code" });
  revalidatePath("/creatives", "layout");
  return error ? { ok: false, message: error.message } : { ok: true, message: "" };
}
