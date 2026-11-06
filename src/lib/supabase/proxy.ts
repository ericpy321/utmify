import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { demoWithoutAuth, isAllowedEmail, supabaseConfigured, supabaseKey, supabaseUrl } from "../env";

// Rutas que no piden login: la pantalla de login, la vuelta del enlace mágico,
// los webhooks de los gateways (tienen su propia validación), la sincronización (protegida por secreto)
// y el script de rastreo /t.js que se pega en las páginas del embudo.
const PUBLIC_PREFIXES = ["/login", "/auth/", "/api/webhooks/", "/api/sync", "/t.js"];

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next({ request });
  if (demoWithoutAuth) return NextResponse.next({ request });

  const toLogin = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  };
  // Sin Supabase configurado en producción, el panel queda cerrado.
  if (!supabaseConfigured) return toLogin();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) return toLogin();
  return response;
}
