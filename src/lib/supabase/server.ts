import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseKey, supabaseUrl } from "../env";

// Cliente de Supabase para componentes de servidor, acciones y rutas. Usa la sesión del usuario (RLS aplica).
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // En componentes de servidor no se pueden escribir cookies; el proxy ya renueva la sesión.
        }
      },
    },
  });
}
