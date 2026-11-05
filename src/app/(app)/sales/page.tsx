import Link from "next/link";
import { Suspense } from "react";
import { loadPage } from "@/lib/page-context";
import { fmt } from "@/lib/i18n/dictionaries";
import { formatMoney, localeFor } from "@/lib/currency";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader, StatusPill } from "@/components/ui";

const PAGE_SIZE = 100;

/** Oculta parte del correo en la tabla: el completo queda solo en la base. */
function maskEmail(e: string) {
  const [u, d] = e.split("@");
  return `${u.slice(0, 2)}***@${d ?? ""}`;
}

export default async function SalesPage({ searchParams }: PageProps<"/sales">) {
  const { sp, t, lang, data, f, engine, money, num, filterProps } = await loadPage(searchParams);
  const tab = sp.tab === "unattributed" ? "unattributed" : "all";
  const page = Math.max(1, Number(sp.page) || 1);

  const rows = [...engine.saleRows(f.from, f.to)].filter((r) => (tab === "all" ? true : !r.sale.adId));
  const slice = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const unattributedCount = [...engine.saleRows(f.from, f.to)].filter((r) => !r.sale.adId).length;
  const breakdown = tab === "unattributed" ? engine.unattributedBreakdown(f.from, f.to) : null;

  const camp = new Map(data.campaigns.map((c) => [c.id, c.name]));
  const ads = new Map(data.ads.map((a) => [a.id, a.name]));
  const prod = new Map(data.products.map((p) => [p.id, p.name]));
  const time = new Intl.DateTimeFormat(localeFor(lang), { timeZone: f.tz, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string") p.set(k, v);
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) p.delete(k);
      else p.set(k, v);
    }
    return `/sales?${p.toString()}`;
  };
  const statusLabel = { approved: t.sales.approved, refunded: t.sales.refunded, chargeback: t.sales.chargeback };

  return (
    <>
      <PageHeader title={t.sales.title} sample={data.isSample} sampleLabel={t.common.sample} />
      <Suspense>
        <FilterBar {...filterProps} />
      </Suspense>

      <div className="flex gap-1 border-b border-line text-sm">
        {(["all", "unattributed"] as const).map((k) => (
          <Link
            key={k}
            href={href({ tab: k === "all" ? null : k, page: null })}
            className={`-mb-px border-b-2 px-3 py-2 ${tab === k ? "border-accent font-medium text-accent" : "border-transparent text-muted hover:text-ink"}`}
          >
            {k === "all" ? t.sales.all : `${t.sales.unattributed} (${num(unattributedCount)})`}
          </Link>
        ))}
      </div>

      {breakdown && (
        <div className="card p-4 text-sm">
          <p className="text-muted">{t.sales.unattributedHelp}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {breakdown.pages.map((p) => (
              <span key={p.page} className="rounded-lg bg-soft px-2 py-1">
                <code>{p.page === "?" ? t.dashboard.unknownPage : p.page}</code> · {num(p.count)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="tnum w-full min-w-[1000px] text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{t.sales.time}</th>
              <th className="px-3 py-2 font-medium">{t.sales.product}</th>
              <th className="px-3 py-2 text-right font-medium">{t.sales.value}</th>
              <th className="px-3 py-2 font-medium">{t.sales.status}</th>
              <th className="px-3 py-2 font-medium">{t.sales.platform}</th>
              <th className="px-3 py-2 font-medium">{tab === "all" ? t.sales.campaign : t.sales.sourcePage}</th>
              {tab === "all" && <th className="px-3 py-2 font-medium">{t.sales.ad}</th>}
              <th className="px-3 py-2 font-medium">{t.sales.gateway}</th>
              <th className="px-3 py-2 font-medium">{t.sales.buyer}</th>
            </tr>
          </thead>
          <tbody>
            {slice.map(({ sale: s, gross }) => (
              <tr key={s.id} className="border-b border-line">
                <td className="whitespace-nowrap px-3 py-2">{time.format(s.createdAtUtc)}</td>
                <td className="px-3 py-2">
                  {prod.get(s.productId)}
                  <div className="text-xs text-muted">{t.sales.kind[s.productKind]}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {money(gross)}
                  {s.currency !== f.currency && <div className="text-xs text-muted">{formatMoney(s.gross, s.currency, lang)}</div>}
                </td>
                <td className="px-3 py-2"><StatusPill status={s.status} label={statusLabel[s.status]} /></td>
                <td className="px-3 py-2">{s.platform === "meta" ? "Meta" : s.platform === "tiktok" ? "TikTok" : "—"}</td>
                {tab === "all" ? (
                  <>
                    <td className="px-3 py-2">{s.campaignId ? camp.get(s.campaignId) : <span className="text-muted">{t.sales.unattributed}</span>}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.adId ? ads.get(s.adId) : "—"}</td>
                  </>
                ) : (
                  <td className="px-3 py-2 font-mono text-xs">{s.sourcePage ?? t.dashboard.unknownPage}</td>
                )}
                <td className="px-3 py-2 text-xs">{s.gateway}</td>
                <td className="px-3 py-2 text-xs text-muted">{maskEmail(s.buyerEmail)}</td>
              </tr>
            ))}
            {!slice.length && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-muted">{t.sales.empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{fmt(t.sales.showing, { n: num(slice.length), total: num(rows.length) })}</span>
        <div className="flex gap-2">
          {page > 1 && <Link className="btn" href={href({ page: String(page - 1) })}>←</Link>}
          {page * PAGE_SIZE < rows.length && <Link className="btn" href={href({ page: String(page + 1) })}>→</Link>}
        </div>
      </div>
    </>
  );
}
