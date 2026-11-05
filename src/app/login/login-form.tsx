"use client";
import { useActionState } from "react";
import { Mail } from "lucide-react";
import { sendMagicLink, type LoginState } from "./actions";
import type { Dict } from "@/lib/i18n/dictionaries";

export function LoginForm({ t, configured, failed }: { t: Dict["login"]; configured: boolean; failed: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: failed ? "error" : "idle" });
  if (!configured || state.status === "not_configured") {
    return <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn">{t.notConfigured}</p>;
  }
  if (state.status === "sent") return <p className="rounded-lg bg-accent-soft p-3 text-sm text-accent">{t.sent}</p>;
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        {t.email}
        <input name="email" type="email" required autoComplete="email" className="input h-10" />
      </label>
      {state.status === "error" && <p className="text-sm text-bad">{t.error}</p>}
      <button className="btn-primary h-10 justify-center" disabled={pending}>
        <Mail className="size-4" /> {t.send}
      </button>
    </form>
  );
}
