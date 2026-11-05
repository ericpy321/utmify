import Link from "next/link";
import { Suspense } from "react";
import { loadPage } from "@/lib/page-context";
import { summarizeBatches } from "@/lib/creative-status";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/ui";

export default async function CreativeHubPage({ searchParams }: PageProps<"/creatives">) {
  const { t, data, engine, settings, money, num, pct, ratio, filterProps, sp } = await loadPage(searchParams);
  const stats = engine.creativeStats();
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();

  return (
    <>
      <PageHeader title={t.creatives.title} sample={data.isSample} sampleLabel={t.common.sample} />
      <Suspense>
        <FilterBar {...filterProps} show={{ period: false, account: true, offer: false }} />
      </Suspense>
      <p className="text-xs text-muted">{t.creatives.lifetime}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {data.offers.map((o) => {
          const list = stats.filter((c) => c.offerCode === o.code);
          const batches = summarizeBatches(list, data.batches.filter((b) => b.offerId === o.id), settings.rules);
          const tested = batches.reduce((a, b) => a + b.tested, 0);
          const validated = batches.reduce((a, b) => a + b.validated, 0);
          const champions = batches.reduce((a, b) => a + b.champions, 0);
          const spend = list.reduce((a, c) => a + c.spend, 0);
          const revenue = list.reduce((a, c) => a + c.revenue, 0);
          return (
            <Link key={o.id} href={`/creatives/${o.id}${qs ? `?${qs}` : ""}`} className="card flex flex-col gap-3 p-4 hover:border-accent">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">{o.name}</span>
                <code className="text-xs text-muted">{o.code}</code>
              </div>
              <div className="tnum grid grid-cols-3 gap-2 text-sm">
                <div><div className="text-xs text-muted">{t.creatives.batches}</div>{num(batches.length)}</div>
                <div><div className="text-xs text-muted">{t.creatives.tested}</div>{num(tested)}</div>
                <div><div className="text-xs text-muted">{t.creatives.assertiveness}</div>{tested ? pct(validated / tested) : t.common.noData}</div>
                <div><div className="text-xs text-muted">{t.creatives.validated}</div>{num(validated)}</div>
                <div><div className="text-xs text-muted">{t.creatives.champions}</div>{num(champions)}</div>
                <div><div className="text-xs text-muted">{t.kpi.roas}</div>{ratio(spend ? revenue / spend : null)}</div>
                <div className="col-span-3"><div className="text-xs text-muted">{t.creatives.invested}</div>{money(spend)}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
