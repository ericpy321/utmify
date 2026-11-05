"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "./i18n";
import { RulesEditor } from "./rules-editor";
import { summarizeBatches, type CreativeNumbers } from "@/lib/creative-status";
import { formatMoney, formatNumber, formatPct } from "@/lib/currency";
import type { Settings } from "@/lib/types";

interface Props {
  offer: { id: string; name: string; code: string };
  creatives: CreativeNumbers[];
  batches: { code: string; createdAt: string; status: "testing" | "finished" }[];
  settings: Settings;
  currency: string;
  query: string;
}

export function OfferHub({ offer, creatives, batches, settings, currency, query }: Props) {
  const { t, lang } = useI18n();
  const [rules, setRules] = useState(settings.rules);
  const [mode, setMode] = useState<"validated" | "champions">("validated");
  const rows = useMemo(() => summarizeBatches(creatives, batches, rules), [creatives, batches, rules]);
  const chart = rows.map((b) => ({
    name: `${offer.code}${b.code}`,
    value: b.tested ? (mode === "validated" ? b.validated : b.champions) / b.tested : 0,
    hasData: b.tested > 0,
  }));
  const money = (v: number) => formatMoney(v, currency, lang, true);

  return (
    <>
      <RulesEditor rules={rules} onChange={setRules} settings={settings} />

      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">{t.creatives.evolution}</h2>
          <div className="flex gap-1 rounded-lg bg-soft p-1 text-sm">
            {(["validated", "champions"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`rounded-md px-2.5 py-1 ${mode === m ? "bg-card font-medium shadow-sm" : "text-muted"}`}>
                {m === "validated" ? t.creatives.modeValidated : t.creatives.modeChampions}
              </button>
            ))}
          </div>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <BarChart data={chart} margin={{ top: 24, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "var(--soft)" }}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }}
                formatter={(v) => [formatPct(Number(v), lang), t.creatives.assertiveness]}
              />
              <Bar dataKey="value" fill={mode === "validated" ? "var(--good)" : "var(--accent)"} radius={[6, 6, 0, 0]}>
                <LabelList
                  dataKey="value"
                  position="top"
                  fill="var(--ink)"
                  fontSize={12}
                  formatter={(v: unknown) => formatPct(Number(v), lang, 0)}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="tnum w-full min-w-[900px] text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{t.creatives.batch}</th>
              <th className="px-3 py-2 font-medium">{t.creatives.date}</th>
              <th className="px-3 py-2 text-right font-medium">{t.creatives.creatives}</th>
              <th className="px-3 py-2 text-right font-medium">{t.creatives.validated}</th>
              <th className="px-3 py-2 text-right font-medium">{t.creatives.champions}</th>
              <th className="px-3 py-2 text-right font-medium">{t.creatives.assertiveness}</th>
              <th className="px-3 py-2 text-right font-medium">{t.creatives.invested}</th>
              <th className="px-3 py-2 text-right font-medium">{t.kpi.profit}</th>
              <th className="px-3 py-2 text-right font-medium">{t.kpi.roas}</th>
              <th className="px-3 py-2 font-medium">{t.common.status}</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((b) => (
              <tr key={b.code} className="border-b border-line hover:bg-soft">
                <td className="px-3 py-2 font-medium">
                  <Link className="text-accent hover:underline" href={`/creatives/${offer.id}/${b.code}${query}`}>{offer.code}{b.code}</Link>
                </td>
                <td className="px-3 py-2">{b.createdAt}</td>
                <td className="px-3 py-2 text-right">{formatNumber(b.creatives, lang)}</td>
                <td className="px-3 py-2 text-right">{formatNumber(b.validated, lang)}</td>
                <td className="px-3 py-2 text-right">{formatNumber(b.champions, lang)}</td>
                <td className="px-3 py-2 text-right font-medium">
                  {b.tested ? formatPct((mode === "validated" ? b.validated : b.champions) / b.tested, lang, 0) : t.common.noData}
                </td>
                <td className="px-3 py-2 text-right">{money(b.spend)}</td>
                <td className={`px-3 py-2 text-right ${b.profit >= 0 ? "text-good" : "text-bad"}`}>{money(b.profit)}</td>
                <td className="px-3 py-2 text-right">{b.roas == null ? t.common.noData : formatNumber(b.roas, lang, 2)}</td>
                <td className="px-3 py-2 text-xs">{b.status === "finished" ? t.creatives.finished : t.creatives.inTesting}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
