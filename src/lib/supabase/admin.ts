import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseSecretKey, supabaseUrl } from "../env";

// Cliente con la clave secreta: salta RLS. Solo para webhooks, sincronización y lecturas del servidor
// después de verificar que el usuario es administrador.
let client: SupabaseClient | null = null;
export function admin(): SupabaseClient {
  if (!client) {
    client = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** Lee todas las filas de una consulta, de a 1000 (límite por pedido de la API de Supabase). */
export async function selectAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}
