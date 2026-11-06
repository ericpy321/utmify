"use client";
import { ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";
import { useI18n } from "./i18n";
import { formatMoney, formatNumber, formatPct } from "@/lib/currency";
import { platformLabel } from "@/lib/platforms";

interface M { spend: number; revenue: number; sales: number; profit: number; roas: number | null; roi: number | null; cpa: number | null }
interface AdRow { id: string; name: string; status: string; m: M }
interface SetRow { id: string; name: string; status: string; budget: number | null; m: M; ads: AdRow[] }
export interface CampRow { id: string; name: string; status: string; platform: string; budget: number | null; currency: string; account: string; m: M; sets: SetRow[] }

export function CampaignTable({ rows, currency }: { rows: CampRow[]; currency: string }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const money = (v: number | null) => (v == null ? t.common.noData : formatMoney(v, currency, lang));
  const status = (s: string) => (s === "active" ? t.common.active : t.common.paused);

  const cells = (m: M) => (
    <>
      <td className="px-3 py-2 text-right">{money(m.spend)}</td>
      <td className="px-3 py-2 text-right">{formatNumber(m.sales, lang)}</td>
      <td className="px-3 py-2 text-right">{money(m.revenue)}</td>
      <td className="px-3 py-2 text-right">{money(m.cpa)}</td>
      <td className="px-3 py-2 text-right">{m.roas == null ? t.common.noData : formatNumber(m.roas, lang, 2)}</td>
      <td className="px-3 py-2 text-right">{m.roi == null ? t.common.noData : formatPct(m.roi, lang)}</td>
      <td className={`px-3 py-2 text-right font-medium ${m.profit >= 0 ? "text-good" : "text-bad"}`}>{money(m.profit)}</td>
    </>
  );

  if (!rows.length) return <div className="card p-6 text-sm text-muted">{t.campaigns.empty}</div>;

  return (
    <div className="card overflow-x-auto">
      <table className="tnum w-full min-w-[960px] text-sm">
        <thead className="border-b border-line text-left text-xs text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">{t.campaigns.name}</th>
            <th className="px-3 py-2 font-medium">{t.common.status}</th>
            <th className="px-3 py-2 text-right font-medium">{t.campaigns.budget}</th>
            <th className="px-3 py-2 text-right font-medium">{t.kpi.spend}</th>
            <th className="px-3 py-2 text-right font-medium">{t.kpi.sales}</th>
            <th className="px-3 py-2 text-right font-medium">{t.kpi.revenue}</th>
            <th className="px-3 py-2 text-right font-medium">{t.kpi.cpa}</th>
            <th className="px-3 py-2 text-right font-medium">{t.kpi.roas}</th>
            <th className="px-3 py-2 text-right font-medium">{t.kpi.roi}</th>
            <th className="px-3 py-2 text-right font-medium">{t.kpi.profit}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <Fragment key={c.id}>
              <tr className="border-b border-line hover:bg-soft">
                <td className="px-3 py-2">
                  <button onClick={() => toggle(c.id)} className="flex items-center gap-1 text-left font-medium">
                    <ChevronRight className={`size-4 shrink-0 transition ${open[c.id] ? "rotate-90" : ""}`} />
                    <span>{c.name}</span>
                  </button>
                  <div className="pl-5 text-xs text-muted">{platformLabel(c.platform)} · {c.account}</div>
                </td>
                <td className="px-3 py-2 text-xs">{status(c.status)}</td>
                <td className="px-3 py-2 text-right text-xs text-muted">{c.budget == null ? "—" : formatMoney(c.budget, c.currency, lang, true)}</td>
                {cells(c.m)}
              </tr>
              {open[c.id] &&
                c.sets.map((s) => (
                  <Fragment key={s.id}>
                    <tr className="border-b border-line bg-soft/50">
                      <td className="px-3 py-2 pl-8">
                        <button onClick={() => toggle(s.id)} className="flex items-center gap-1 text-left">
                          <ChevronRight className={`size-4 shrink-0 transition ${open[s.id] ? "rotate-90" : ""}`} />
                          {s.name}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-xs">{status(s.status)}</td>
                      <td className="px-3 py-2 text-right text-xs text-muted">{s.budget == null ? "—" : formatMoney(s.budget, c.currency, lang, true)}</td>
                      {cells(s.m)}
                    </tr>
                    {open[s.id] &&
                      s.ads.map((a) => (
                        <tr key={a.id} className="border-b border-line text-xs">
                          <td className="px-3 py-2 pl-16 font-mono">{a.name}</td>
                          <td className="px-3 py-2">{status(a.status)}</td>
                          <td className="px-3 py-2" />
                          {cells(a.m)}
                        </tr>
                      ))}
                  </Fragment>
                ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
