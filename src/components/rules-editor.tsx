"use client";
import { useTransition } from "react";
import { useI18n } from "./i18n";
import { saveSettings } from "@/app/actions";
import type { CreativeRules, Settings } from "@/lib/types";

// Regla editable: cada cambio recalcula al instante (estado local); "Guardar" la deja por defecto.
export function RulesEditor({ rules, onChange, settings }: { rules: CreativeRules; onChange: (r: CreativeRules) => void; settings: Settings }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const set = (k: "validated" | "champion", f: "sales" | "roas", v: string) =>
    onChange({ ...rules, [k]: { ...rules[k], [f]: v === "" ? 0 : Math.max(0, Number(v)) } });
  return (
    <div className="card flex flex-wrap items-end gap-4 p-4">
      {(["validated", "champion"] as const).map((k) => (
        <div key={k} className="flex items-end gap-2">
          <span className={`mb-2 text-sm font-medium ${k === "champion" ? "text-accent" : "text-good"}`}>
            {k === "validated" ? t.creatives.ruleValidated : t.creatives.ruleChampion}
          </span>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t.creatives.minSales}
            <input type="number" min={0} className="input w-24" value={rules[k].sales} onChange={(e) => set(k, "sales", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t.creatives.minRoas}
            <input type="number" min={0} step="0.05" className="input w-24" value={rules[k].roas} onChange={(e) => set(k, "roas", e.target.value)} />
          </label>
        </div>
      ))}
      <button className="btn" disabled={pending} onClick={() => start(async () => { await saveSettings({ ...settings, rules }); })}>
        {t.common.save}
      </button>
      <span className="basis-full text-xs text-muted">{t.creatives.rulesHelp} {t.creatives.rejectedHelp}</span>
    </div>
  );
}
