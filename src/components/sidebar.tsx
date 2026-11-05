"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { BarChart3, Gauge, Layers, LogOut, Moon, Plug, Receipt, Settings, Sparkles, Sun } from "lucide-react";
import { useI18n } from "./i18n";
import { LANG_LABEL, LANGS } from "@/lib/i18n/dictionaries";
import { setLang } from "@/app/actions";

// Parámetros que se conservan al navegar entre pantallas.
const KEEP = ["platform", "period", "from", "to", "tz", "cur", "account", "offer"];

export function Sidebar({ email, demo }: { email: string | null; demo: boolean }) {
  const { t, lang } = useI18n();
  const path = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const [, start] = useTransition();
  const platform = sp.get("platform") ?? "all";

  const qs = (patch: Record<string, string | null> = {}) => {
    const p = new URLSearchParams();
    for (const k of KEEP) {
      const v = sp.get(k);
      if (v) p.set(k, v);
    }
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  const setPlatform = (v: string) => {
    // Al cambiar de plataforma, la cuenta elegida puede dejar de existir: se limpia.
    router.push(`${path}${qs({ platform: v === "all" ? null : v, account: null })}`);
  };

  const toggleTheme = () => {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {}
  };

  const nav = [
    { href: "/", label: t.nav.dashboard, icon: Gauge },
    { href: "/campaigns", label: t.nav.campaigns, icon: BarChart3 },
    { href: "/sales", label: t.nav.sales, icon: Receipt },
    { href: "/creatives", label: t.nav.creativeHub, icon: Sparkles },
    { href: "/connect", label: t.nav.connect, icon: Plug },
    { href: "/settings", label: t.nav.settings, icon: Settings },
  ];

  return (
    <aside className="flex w-full flex-col gap-4 border-b border-line bg-card p-4 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
      <div className="flex items-center gap-2 px-1">
        <Layers className="size-5 text-accent" />
        <span className="font-semibold">{t.app.name}</span>
      </div>

      {/* Cambio de plataforma: arriba de todo, como pediste */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-soft p-1 text-sm">
        {(["all", "meta", "tiktok"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={`rounded-lg px-2 py-1.5 font-medium ${platform === p ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {p === "all" ? t.nav.allPlatforms : p === "meta" ? t.nav.meta : t.nav.tiktok}
          </button>
        ))}
      </div>

      <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={`${href}${qs()}`}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-soft hover:text-ink"}`}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 text-sm">
        <div className="flex gap-2">
          <select
            aria-label={t.common.language}
            className="input flex-1"
            value={lang}
            onChange={(e) => start(() => setLang(e.target.value).then(() => router.refresh()))}
          >
            {LANGS.map((l) => (
              <option key={l} value={l}>{LANG_LABEL[l]}</option>
            ))}
          </select>
          <button className="btn" onClick={toggleTheme} aria-label={t.common.theme} title={t.common.theme}>
            <Sun className="hidden size-4 dark:block" />
            <Moon className="size-4 dark:hidden" />
          </button>
        </div>
        {!demo && (
          <form action="/auth/signout" method="post" className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-muted" title={email ?? ""}>{email}</span>
            <button className="btn" type="submit" title={t.nav.logout}>
              <LogOut className="size-4" />
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
