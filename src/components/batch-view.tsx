"use client";
import { useMemo, useState } from "react";
import { useI18n } from "./i18n";
import { RulesEditor } from "./rules-editor";
import { StatusPillClient } from "./status-pill-client";
import { classify, type CreativeNumbers, type CreativeStatus } from "@/lib/creative-status";
import { formatMoney, formatNumber } from "@/lib/currency";
import { platformLabel } from "@/lib/platforms";
import type { Settings } from "@/lib/types";
import { setCreativeMeta } from "@/app/(app)/settings/actions";

export interface BatchCreative extends CreativeNumbers {
  copywriter: string | null;
  editor: string | null;
  platforms: string[];
  hook: number;
  copy: number;
  format: number;
}

// Campo editable (copy / editor): se guarda al salir del campo. Solo con la base conectada.
function MetaInput({ code, offerId, field, value }: { code: string; offerId: string; field: "copywriter" | "editor"; value: string | null }) {
  const [v, setV] = useState(value ?? "");
  return (
    <input className="input h-8 w-28" value={v} onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== (value ?? "")) void setCreativeMeta(code, offerId, field, v); }} />
  );
}

export function BatchView({ creatives, finished, settings, currency, offerId, editable }: { creatives: BatchCreative[]; finished: boolean; settings: Settings; currency: string; offerId: string; editable: boolean }) {
  const { t, lang } = useI18n();
  const [rules, setRules] = useState(settings.rules);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<CreativeStatus | "all">("all");
  const label: Record<CreativeStatus, string> = {
    champion: t.creatives.champion, validated: t.creatives.validatedOne, testing: t.creatives.testing, rejected: t.creatives.rejected,
  };

  const rows = useMemo(
    () =>
      creatives
        .map((c) => ({ ...c, status: classify(c, rules, finished) }))
        .filter((c) => status === "all" || c.status === status)
        .filter((c) => {
          if (!q) return true;
          const hay = `${c.code} ${c.copywriter ?? ""} ${c.editor ?? ""} ${c.platforms.join(" ")}`.toLowerCase();
          return hay.includes(q.toLowerCase());
        })
        .sort((a, b) => b.sales - a.sales),
    [creatives, rules, finished, status, q],
  );
  const money = (v: number | null) => (v == null ? t.common.noData : formatMoney(v, currency, lang));

  return (
    <>
      <RulesEditor rules={rules} onChange={setRules} settings={settings} />
      <div className="flex flex-wrap gap-2">
        <input className="input w-64" placeholder={t.common.search} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as CreativeStatus | "all")}>
          <option value="all">{t.common.all}</option>
          {(Object.keys(label) as CreativeStatus[]).map((s) => <option key={s} value={s}>{label[s]}</option>)}
        </select>
      </div>
      <div className="card overflow-x-auto">
        <table className="tnum w-full min-w-[960px] text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{t.creatives.creatives}</th>
              <th className="px-3 py-2 font-medium">{t.creatives.copy}</th>
              <th className="px-3 py-2 font-medium">{t.creatives.editor}</th>
              <th className="px-3 py-2 font-medium">{t.sales.platform}</th>
              <th className="px-3 py-2 text-right font-medium">{t.kpi.sales}</th>
              <th className="px-3 py-2 text-right font-medium">{t.kpi.cpa}</th>
              <th className="px-3 py-2 text-right font-medium">{t.creatives.invested}</th>
              <th className="px-3 py-2 text-right font-medium">{t.kpi.roas}</th>
              <th className="px-3 py-2 text-right font-medium">{t.kpi.profit}</th>
              <th className="px-3 py-2 font-medium">{t.common.status}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.code} className="border-b border-line">
                <td className="px-3 py-2">
                  <div className="font-mono text-xs font-medium">{c.code}</div>
                  <div className="text-xs text-muted">{t.creatives.hook} {c.hook} · {t.creatives.format} {c.format}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">C{c.copy}
                    {editable ? <MetaInput code={c.code} offerId={offerId} field="copywriter" value={c.copywriter} /> : c.copywriter ? ` · ${c.copywriter}` : ""}
                  </div>
                </td>
                <td className="px-3 py-2">{editable ? <MetaInput code={c.code} offerId={offerId} field="editor" value={c.editor} /> : c.editor ?? <span className="text-muted">—</span>}</td>
                <td className="px-3 py-2">{c.platforms.map(platformLabel).join(", ")}</td>
                <td className="px-3 py-2 text-right">{formatNumber(c.sales, lang)}</td>
                <td className="px-3 py-2 text-right">{money(c.cpa)}</td>
                <td className="px-3 py-2 text-right">{money(c.spend)}</td>
                <td className="px-3 py-2 text-right">{c.roas == null ? t.common.noData : formatNumber(c.roas, lang, 2)}</td>
                <td className={`px-3 py-2 text-right ${c.profit >= 0 ? "text-good" : "text-bad"}`}>{money(c.profit)}</td>
                <td className="px-3 py-2"><StatusPillClient status={c.status} label={label[c.status]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
