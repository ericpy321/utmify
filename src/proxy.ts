import type { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/proxy";

// Todo el panel pasa por aquí: sin sesión válida de un correo autorizado, va al login.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
