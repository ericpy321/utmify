import { Suspense } from "react";
import { loadPage } from "@/lib/page-context";
import { FilterBar } from "@/components/filter-bar";
import { CampaignTable } from "@/components/campaign-table";
import { PageHeader } from "@/components/ui";

export default async function CampaignsPage({ searchParams }: PageProps<"/campaigns">) {
  const { t, data, f, engine, filterProps } = await loadPage(searchParams);
  const rows = engine.hasSpendSource ? engine.campaignTree(f.from, f.to) : [];
  return (
    <>
      <PageHeader title={t.campaigns.title} sample={data.isSample} sampleLabel={t.common.sample} />
      <Suspense>
        <FilterBar {...filterProps} />
      </Suspense>
      <p className="text-xs text-muted">{t.campaigns.note}</p>
      <CampaignTable rows={rows} currency={f.currency} />
    </>
  );
}
