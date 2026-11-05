"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "./i18n";
import { saveSettings } from "@/app/actions";
import { COMMON_TIMEZONES } from "@/lib/time";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import type { Settings } from "@/lib/types";

export function SettingsForm({ initial }: { initial: Settings }) {
  const { t } = useI18n();
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const n = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setS(await saveSettings(s));
          setSaved(true);
          router.refresh();
        });
      }}
    >
      <div className="card grid gap-3 p-4 md:grid-cols-2">
        <h2 className="font-medium md:col-span-2">{t.settings.defaults}</h2>
        <label className="flex flex-col gap-1 text-sm">
          {t.filters.timezone}
          <select className="input" value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })}>
            {COMMON_TIMEZONES.map((z) => <option key={z}>{z}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t.filters.currency}
          <select className="input" value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })}>
            {SUPPORTED_CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      </div>

      <div className="card grid gap-3 p-4 md:grid-cols-3">
        <h2 className="font-medium md:col-span-3">{t.settings.costs}</h2>
        <label className="flex flex-col gap-1 text-sm">
          {t.settings.revenueTax}
          <input className="input" type="number" min={0} max={100} step="0.01" value={s.revenueTaxPct} onChange={(e) => setS({ ...s, revenueTaxPct: n(e.target.value) })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t.settings.spendTax}
          <input className="input" type="number" min={0} max={100} step="0.01" value={s.adSpendTaxPct} onChange={(e) => setS({ ...s, adSpendTaxPct: n(e.target.value) })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t.settings.costPerSale}
          <input className="input" type="number" min={0} step="0.01" value={s.costPerSale} onChange={(e) => setS({ ...s, costPerSale: n(e.target.value) })} />
        </label>
        <p className="text-xs text-muted md:col-span-3">{t.settings.feeNote}</p>
      </div>

      <div className="card grid gap-3 p-4 md:grid-cols-4">
        <h2 className="font-medium md:col-span-4">{t.settings.rules}</h2>
        {(["validated", "champion"] as const).map((k) => (
          <div key={k} className="contents">
            <label className="flex flex-col gap-1 text-sm">
              {k === "validated" ? t.creatives.ruleValidated : t.creatives.ruleChampion} · {t.creatives.minSales}
              <input className="input" type="number" min={0} value={s.rules[k].sales} onChange={(e) => setS({ ...s, rules: { ...s.rules, [k]: { ...s.rules[k], sales: n(e.target.value) } } })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {k === "validated" ? t.creatives.ruleValidated : t.creatives.ruleChampion} · {t.creatives.minRoas}
              <input className="input" type="number" min={0} step="0.01" value={s.rules[k].roas} onChange={(e) => setS({ ...s, rules: { ...s.rules, [k]: { ...s.rules[k], roas: n(e.target.value) } } })} />
            </label>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>{t.common.save}</button>
        {saved && !pending && <span className="text-sm text-good">{t.common.saved}</span>}
        <span className="text-xs text-muted">{t.settings.stored}</span>
      </div>
    </form>
  );
}
