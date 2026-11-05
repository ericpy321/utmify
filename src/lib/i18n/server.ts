import "server-only";
import { cookies, headers } from "next/headers";
import { dictionaries, LANGS, type Lang } from "./dictionaries";

// Idioma: cookie "lang"; si no existe, el del navegador; si no, español.
export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get("lang")?.value as Lang | undefined;
  if (c && LANGS.includes(c)) return c;
  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase() as Lang;
    if (LANGS.includes(code)) return code;
  }
  return "es";
}

export async function getDict() {
  const lang = await getLang();
  return { lang, t: dictionaries[lang] };
}
