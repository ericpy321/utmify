"use client";
import { createContext, useContext } from "react";
import type { Dict, Lang } from "@/lib/i18n/dictionaries";

const Ctx = createContext<{ lang: Lang; t: Dict } | null>(null);

export function I18nProvider({ lang, t, children }: { lang: Lang; t: Dict; children: React.ReactNode }) {
  return <Ctx.Provider value={{ lang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n fuera de I18nProvider");
  return v;
}
