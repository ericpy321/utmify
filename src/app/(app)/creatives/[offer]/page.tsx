import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadPage } from "@/lib/page-context";
import { FilterBar } from "@/components/filter-bar";
import { OfferHub } from "@/components/offer-hub";
import { PageHeader } from "@/components/ui";

export default async function OfferPage({ params, searchParams }: PageProps<"/creatives/[offer]">) {
  const [{ offer: offerId }, ctx] = await Promise.all([params, loadPage(searchParams)]);
  const { t, data, engine, settings, f, filterProps, sp } = ctx;
  const offer = data.offers.find((o) => o.id === offerId);
  if (!offer) notFound();
  const creatives = engine.creativeStats().filter((c) => c.offerCode === offer.code);
  const batches = data.batches.filter((b) => b.offerId === offer.id).map(({ code, createdAt, status }) => ({ code, createdAt, status }));
  const qsRaw = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();
  const query = qsRaw ? `?${qsRaw}` : "";

  return (
    <>
      <Link href={`/creatives${query}`} className="text-sm text-muted hover:text-ink">← {t.creatives.back}</Link>
      <PageHeader title={`${t.creatives.title} · ${offer.name}`} sample={data.isSample} sampleLabel={t.common.sample} />
      <Suspense>
        <FilterBar {...filterProps} show={{ period: false, account: true, offer: false }} />
      </Suspense>
      <p className="text-xs text-muted">{t.creatives.lifetime}</p>
      <OfferHub
        offer={{ id: offer.id, name: offer.name, code: offer.code }}
        creatives={creatives.map(({ code, batch, spend, revenue, sales, profit, roas, cpa }) => ({ code, batch, spend, revenue, sales, profit, roas, cpa }))}
        batches={batches}
        settings={settings}
        currency={f.currency}
        query={query}
      />
    </>
  );
}
