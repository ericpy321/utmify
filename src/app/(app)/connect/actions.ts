"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { serviceConfigured } from "@/lib/env";
import { admin } from "@/lib/supabase/admin";
import { discoverMetaAccounts } from "@/lib/sync/meta";
import { discoverTikTokAccounts } from "@/lib/sync/tiktok";
import { runSync } from "@/lib/sync/run";
import { reprocessEvents } from "@/lib/webhooks/reprocess";

// Todas las acciones verifican al usuario: son endpoints públicos.
type Result = { ok: boolean; message: string };
const fail = (e: unknown): Result => ({ ok: false, message: e instanceof Error ? e.message : String(e) });

export async function findMetaAccounts(): Promise<Result> {
  await requireUser();
  try {
    const n = await discoverMetaAccounts();
    revalidatePath("/connect");
    return { ok: true, message: String(n) };
  } catch (e) { return fail(e); }
}

export async function findTikTokAccounts(): Promise<Result> {
  await requireUser();
  try {
    const n = await discoverTikTokAccounts();
    revalidatePath("/connect");
    return { ok: true, message: String(n) };
  } catch (e) { return fail(e); }
}

export async function setTracked(id: string, tracked: boolean): Promise<Result> {
  await requireUser();
  if (!serviceConfigured) return { ok: false, message: "Supabase no configurado" };
  const { error } = await admin().from("ad_accounts").update({ tracked }).eq("id", id);
  revalidatePath("/", "layout");
  return error ? fail(error.message) : { ok: true, message: "" };
}

export async function syncNow(): Promise<Result> {
  await requireUser();
  try {
    const r = await runSync();
    revalidatePath("/", "layout");
    const bad = r.filter((x) => !x.ok);
    return { ok: bad.length === 0, message: bad.map((b) => `${b.source}: ${b.detail}`).join(" · ") };
  } catch (e) { return fail(e); }
}

export async function reprocess(): Promise<Result & { counts?: { ok: number; failed: number } }> {
  await requireUser();
  try {
    const counts = await reprocessEvents({ onlyErrors: true });
    revalidatePath("/", "layout");
    return { ok: true, message: "", counts };
  } catch (e) { return fail(e); }
}
