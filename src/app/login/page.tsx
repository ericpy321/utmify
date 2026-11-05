import { Layers } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { supabaseConfigured } from "@/lib/env";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [{ t }, sp] = await Promise.all([getDict(), searchParams]);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-4 flex items-center gap-2">
          <Layers className="size-5 text-accent" />
          <span className="font-semibold">{t.app.name}</span>
        </div>
        <h1 className="text-xl font-semibold">{t.login.title}</h1>
        <p className="mb-4 mt-1 text-sm text-muted">{t.login.subtitle}</p>
        <LoginForm t={t.login} configured={supabaseConfigured} failed={sp.error === "1"} />
      </div>
    </main>
  );
}
