import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { isRealMode } from "@/lib/data";
import { I18nProvider } from "@/components/i18n";
import { Sidebar } from "@/components/sidebar";

// Las sincronizaciones manuales (botón "Actualizar") pueden tardar: hasta 5 minutos.
export const maxDuration = 300;

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [user, { lang, t }, real] = await Promise.all([requireUser(), getDict(), isRealMode()]);
  return (
    <I18nProvider lang={lang} t={t}>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Suspense>
          <Sidebar email={user.email} demo={user.demo} />
        </Suspense>
        <main className="min-w-0 flex-1 p-4 md:p-6">
          {!real && (
            <div className="mb-4 rounded-xl border border-warn/40 bg-warn-soft px-4 py-2 text-sm font-medium text-warn">
              {t.common.sampleBanner}
            </div>
          )}
          {user.demo && (
            <div className="mb-4 rounded-xl border border-line bg-soft px-4 py-2 text-xs text-muted">{t.common.demoNoAuth}</div>
          )}
          <div className="mx-auto flex max-w-7xl flex-col gap-4">{children}</div>
        </main>
      </div>
    </I18nProvider>
  );
}
