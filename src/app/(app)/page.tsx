import { Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { loadPage } from "@/lib/page-context";
import { pctChange } from "@/lib/metrics";
import { fmt } from "@/lib/i18n/dictionaries";
import { formatNumber, localeFor } from "@/lib/currency";
import { FilterBar } from "@/components/filter-bar";
import { HourlyChart } from "@/components/hourly-chart";
import { RefreshButton } from "@/components/refresh-button";
import { Kpi, PageHeader } from "@/components/ui";

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const { t, lang, data, f, engine, money, num, pct, ratio, filterProps } = await loadPage(searchParams);
  const cur = engine.totals(f.from, f.to);
  const prev = engine.totals(f.prevFrom, f.prevTo);
  const hourly = engine.hourly(f.from, f.to);
  const funnel = engine.funnel(f.from, f.to);
  const fx = engine.fxUsed(f.to);
  const lost = cur.attributedPct != null && cur.attributedPct < 0.8 ? engine.unattributedBreakdown(f.from, f.to) : null;
  const d = t.common.vsPrev;
  const lastSync = data.lastSyncUtc
    ? new Intl.DateTimeFormat(localeFor(lang), { timeZone: f.tz, dateStyle: "short", timeStyle: "short" }).format(data.lastSyncUtc)
    : t.dashboard.never;

  const funnelRows = [
    { label: t.dashboard.checkout, v: funnel.checkout },
    { label: t.dashboard.purchase, v: funnel.purchase },
    { label: t.dashboard.upsell1, v: funnel.upsell1 },
    { label: t.dashboard.upsell2, v: funnel.upsell2 },
  ];
  const funnelMax = Math.max(1, ...funnelRows.map((r) => r.v ?? 0));

  return (
    <>
      <PageHeader title={t.nav.dashboard} sample={data.isSample} sampleLabel={t.common.sample} />
      <Suspense>
        <FilterBar {...filterProps} />
      </Suspense>

      {/* Línea de transparencia: zona del recorte, cotización usada y última sincronización */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="tnum">
          {t.dashboard.cutIn} <b className="text-ink">{f.tz}</b>
          {" · "}
          {t.dashboard.fxUsed}:{" "}
          {fx.pairs.length === 0
            ? "—"
            : fx.pairs.map((p) => `1 ${p.from} = ${p.rate == null ? t.common.noData : formatNumber(p.rate, lang, 4)} ${p.to}`).join(" · ")}
          {fx.date && ` (${fx.date}${fx.source ? `, ${fx.source}` : ""})`}
          {" · "}
          {t.dashboard.lastSync}: <b className="text-ink">{lastSync}</b>
        </span>
        <RefreshButton />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t.kpi.revenue} value={money(cur.revenue)} delta={pctChange(cur.revenue, prev.revenue)} deltaLabel={d} lang={lang} />
        <Kpi label={t.kpi.spend} value={money(cur.spend)} delta={pctChange(cur.spend, prev.spend)} goodWhenUp={null} deltaLabel={d} lang={lang} />
        <Kpi label={t.kpi.profit} value={money(cur.profit)} delta={pctChange(cur.profit, prev.profit)} deltaLabel={d} lang={lang} sub={t.dashboard.taxesNote} />
        <Kpi label={t.kpi.roas} value={ratio(cur.roas)} delta={pctChange(cur.roas, prev.roas)} deltaLabel={d} lang={lang} />
        <Kpi label={t.kpi.roi} value={pct(cur.roi)} delta={pctChange(cur.roi, prev.roi)} deltaLabel={d} lang={lang} />
        <Kpi label={t.kpi.sales} value={num(cur.sales)} delta={pctChange(cur.sales, prev.sales)} deltaLabel={d} lang={lang} sub={`${t.kpi.orders}: ${num(cur.orders)}`} />
        <Kpi label={t.kpi.cpa} value={money(cur.cpa)} delta={pctChange(cur.cpa, prev.cpa)} goodWhenUp={false} deltaLabel={d} lang={lang} />
        <Kpi label={t.kpi.aov} value={money(cur.aov)} delta={pctChange(cur.aov, prev.aov)} deltaLabel={d} lang={lang} />
      </div>

      {cur.netMissing > 0 && <p className="text-xs text-warn">{fmt(t.dashboard.netMissing, { n: cur.netMissing })}</p>}

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h2 className="mb-2 font-medium">{t.dashboard.salesByHour} <span className="text-xs font-normal text-muted">({f.tz})</span></h2>
          <HourlyChart data={hourly} currency={f.currency} />
        </div>
        <div className="card flex flex-col gap-3 p-4">
          <h2 className="font-medium">{t.dashboard.funnel}</h2>
          {funnelRows.map((r, i) => {
            const base = i === 0 ? null : funnelRows[i === 1 ? 0 : 1].v;
            return (
              <div key={r.label} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span>{r.label}</span>
                  <span className="tnum font-medium">
                    {r.v == null ? <span className="text-muted">{t.common.noData}</span> : num(r.v)}
                    {r.v != null && base ? <span className="ml-2 text-xs text-muted">{pct(r.v / base)}</span> : null}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-soft">
                  <div className="h-2 rounded-full bg-accent" style={{ width: `${((r.v ?? 0) / funnelMax) * 100}%` }} />
                </div>
                {i === 0 && r.v == null && <span className="text-xs text-muted">{t.dashboard.checkoutNotSent}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 font-medium">{t.dashboard.refundsChargebacks}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-sm text-muted">{t.kpi.refunds}</div>
              <div className="tnum text-xl font-semibold">{num(cur.refunds.count)}</div>
              <div className="tnum text-sm text-muted">{money(cur.refunds.amount)}</div>
            </div>
            <div>
              <div className="text-sm text-muted">{t.kpi.chargebacks}</div>
              <div className="tnum text-xl font-semibold">{num(cur.chargebacks.count)}</div>
              <div className="tnum text-sm text-muted">{money(cur.chargebacks.amount)}</div>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <h2 className="mb-1 font-medium">{t.kpi.attribution}</h2>
          {cur.attributedPct == null ? (
            <p className="text-sm text-muted">{engine.attributionFilterActive ? t.dashboard.attributionFiltered : t.common.noData}</p>
          ) : (
            <>
              <div className={`tnum text-3xl font-semibold ${cur.attributedPct < 0.8 ? "text-warn" : "text-good"}`}>{pct(cur.attributedPct)}</div>
              {lost && (
                <div className="mt-2 flex gap-2 text-sm text-warn">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    {fmt(t.dashboard.attributionLow, { pct: pct(cur.attributedPct) })}
                    <ul className="mt-1 list-disc pl-5 text-ink">
                      {lost.pages.slice(0, 4).map((p) => (
                        <li key={p.page}><code>{p.page === "?" ? t.dashboard.unknownPage : p.page}</code> — {num(p.count)}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
