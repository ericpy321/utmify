"use client";
import { useState, useTransition } from "react";
import { RefreshCw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "./i18n";
import { fmt } from "@/lib/i18n/dictionaries";
import { findGoogleAccounts, findMetaAccounts, findTikTokAccounts, reprocess, setTracked, syncNow } from "@/app/(app)/connect/actions";

type Act = () => Promise<{ ok: boolean; message: string; counts?: { ok: number; failed: number } }>;

function ActionButton({ action, label, busy, icon, done }: { action: Act; label: string; busy?: string; icon?: React.ReactNode; done?: (r: Awaited<ReturnType<Act>>) => string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn" disabled={pending} onClick={() => start(async () => {
        const r = await action();
        setMsg({ ok: r.ok, text: r.ok ? (done ? done(r) : "") : r.message });
        router.refresh();
      })}>
        {icon}
        {pending ? busy ?? label : label}
      </button>
      {msg?.text && <span className={`text-xs ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</span>}
    </div>
  );
}

export function FindAccountsButton({ platform }: { platform: "meta" | "tiktok" | "google" }) {
  const { t } = useI18n();
  const action = platform === "meta" ? findMetaAccounts : platform === "google" ? findGoogleAccounts : findTikTokAccounts;
  return <ActionButton action={action} label={t.integ.findAccounts} icon={<Search className="size-4" />} done={(r) => `${t.integ.accounts}: ${r.message}`} />;
}

export function SyncButton() {
  const { t } = useI18n();
  return <ActionButton action={syncNow} label={t.integ.syncNow} busy={t.integ.syncing} icon={<RefreshCw className="size-4" />} done={() => t.integ.ok} />;
}

export function ReprocessButton() {
  const { t } = useI18n();
  return <ActionButton action={reprocess} label={t.integ.reprocess} done={(r) => fmt(t.integ.reprocessed, { ok: r.counts?.ok ?? 0, failed: r.counts?.failed ?? 0 })} />;
}

export function TrackToggle({ id, tracked }: { id: string; tracked: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [on, setOn] = useState(tracked);
  const [pending, start] = useTransition();
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={on} disabled={pending}
        onChange={(e) => { const v = e.target.checked; setOn(v); start(async () => { await setTracked(id, v); router.refresh(); }); }} />
      {t.integ.track}
    </label>
  );
}
