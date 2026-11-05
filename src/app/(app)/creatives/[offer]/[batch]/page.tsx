import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadPage } from "@/lib/page-context";
import { parseCreativeCode } from "@/lib/creative";
import { FilterBar } from "@/components/filter-bar";
import { BatchView } from "@/components/batch-view";
import { PageHeader } from "@/components/ui";

export default async function BatchPage({ params, searchParams }: PageProps<"/creatives/[offer]/[batch]">) {
  const [{ offer: offerId, batch: code }, ctx] = await Promise.all([params, loadPage(searchParams)]);
  const { t, data, engine, settings, f, filterProps, sp } = ctx;
  const offer = data.offers.find((o) => o.id === offerId);
  const batch = data.batches.find((b) => b.offerId === offerId && b.code === code);
  if (!offer || !batch) notFound();
  const meta = new Map(data.creatives.map((c) => [c.code, c]));
  const creatives = engine
    .creativeStats()
    .filter((c) => c.offerCode === offer.code && c.batch === code)
    .map((c) => {
      const p = parseCreativeCode(c.code)!;
      return {
        code: c.code, batch: c.batch, spend: c.spend, revenue: c.revenue, sales: c.sales, profit: c.profit, roas: c.roas, cpa: c.cpa,
        platforms: c.platforms, hook: p.hook, copy: p.copy, format: p.format,
        copywriter: meta.get(c.code)?.copywriter ?? null, editor: meta.get(c.code)?.editor ?? null,
      };
    });
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();

  return (
    <>
      <Link href={`/creatives/${offer.id}${qs ? `?${qs}` : ""}`} className="text-sm text-muted hover:text-ink">← {offer.name}</Link>
      <PageHeader title={`${t.creatives.batch} ${offer.code}${code}`} sample={data.isSample} sampleLabel={t.common.sample}>
        <span className="text-sm text-muted">{batch.createdAt} · {batch.status === "finished" ? t.creatives.finished : t.creatives.inTesting}</span>
      </PageHeader>
      <Suspense>
        <FilterBar {...filterProps} show={{ period: false, account: true, offer: false }} />
      </Suspense>
      <BatchView creatives={creatives} finished={batch.status === "finished"} settings={settings} currency={f.currency} />
    </>
  );
}
