"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useI18n } from "./i18n";
import { COMMON_TIMEZONES } from "@/lib/time";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

interface Props {
  accounts: { id: string; name: string; platform: string }[];
  offers: { id: string; name: string }[];
  current: { period: string; from: string; to: string; tz: string; currency: string; account: string; offer: string; platform: string };
  show?: { period?: boolean; account?: boolean; offer?: boolean };
}

export function FilterBar({ accounts, offers, current, show = { period: true, account: true, offer: true } }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [from, setFrom] = useState(current.from);
  const [to, setTo] = useState(current.to);

  const push = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "" || v === "all") p.delete(k);
      else p.set(k, v);
    }
    router.push(`${path}?${p.toString()}`);
  };

  const periods = [
    ["today", t.filters.today], ["yesterday", t.filters.yesterday], ["7d", t.filters.last7],
    ["30d", t.filters.last30], ["custom", t.filters.custom],
  ] as const;
  const visibleAccounts = accounts.filter((a) => current.platform === "all" || a.platform === current.platform);
  const tzs = COMMON_TIMEZONES.includes(current.tz) ? COMMON_TIMEZONES : [current.tz, ...COMMON_TIMEZONES];

  return (
    <div className="card flex flex-wrap items-end gap-3 p-3">
      {show.period !== false && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">{t.filters.period}</span>
          <div className="flex flex-wrap gap-1 rounded-lg bg-soft p-1">
            {periods.map(([k, label]) => (
              <button
                key={k}
                onClick={() => push(k === "custom" ? { period: k, from, to } : { period: k === "today" ? null : k, from: null, to: null })}
                className={`rounded-md px-2.5 py-1 text-sm ${current.period === k ? "bg-card font-medium shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {show.period !== false && current.period === "custom" && (
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t.filters.from}
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t.filters.to}
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button className="btn-primary" onClick={() => push({ period: "custom", from, to })}>{t.filters.apply}</button>
        </div>
      )}
      {show.account !== false && (
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t.filters.account}
          <select className="input" value={current.account} onChange={(e) => push({ account: e.target.value })}>
            <option value="all">{t.filters.allAccounts}</option>
            {visibleAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
      )}
      {show.offer !== false && (
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t.filters.offer}
          <select className="input" value={current.offer} onChange={(e) => push({ offer: e.target.value })}>
            <option value="all">{t.filters.allOffers}</option>
            {offers.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t.filters.timezone}
        <select className="input" value={current.tz} onChange={(e) => push({ tz: e.target.value })}>
          {tzs.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t.filters.currency}
        <select className="input" value={current.currency} onChange={(e) => push({ cur: e.target.value })}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
