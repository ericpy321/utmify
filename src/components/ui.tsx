// Piezas visuales reutilizables (componentes de servidor).
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatPct } from "@/lib/currency";

export function PageHeader({ title, sample, sampleLabel, children }: { title: string; sample?: boolean; sampleLabel?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {sample && <SampleBadge label={sampleLabel ?? ""} />}
      </div>
      {children}
    </div>
  );
}

export function SampleBadge({ label }: { label: string }) {
  return <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-warn">{label}</span>;
}

export function Kpi({
  label, value, delta, goodWhenUp = true, sub, deltaLabel, lang,
}: { label: string; value: string; delta: number | null; goodWhenUp?: boolean | null; sub?: string; deltaLabel: string; lang: string }) {
  const up = delta != null && delta > 0;
  const color = delta == null || goodWhenUp == null || delta === 0 ? "text-muted" : up === goodWhenUp ? "text-good" : "text-bad";
  return (
    <div className="card flex flex-col gap-1 p-4">
      <span className="text-sm text-muted">{label}</span>
      <span className="tnum text-2xl font-semibold tracking-tight md:text-3xl">{value}</span>
      <span className={`tnum flex items-center gap-1 text-xs ${color}`} title={deltaLabel}>
        {delta != null && (up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />)}
        {delta == null ? "—" : formatPct(delta, lang)}
        <span className="text-muted">{deltaLabel}</span>
      </span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

export function StatusPill({ status, label }: { status: string; label: string }) {
  const map: Record<string, string> = {
    active: "bg-good/10 text-good", approved: "bg-good/10 text-good", champion: "bg-accent-soft text-accent",
    validated: "bg-good/10 text-good", testing: "bg-soft text-muted", paused: "bg-soft text-muted",
    refunded: "bg-warn-soft text-warn", chargeback: "bg-bad/10 text-bad", rejected: "bg-bad/10 text-bad",
    finished: "bg-soft text-ink",
  };
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-soft text-muted"}`}>{label}</span>;
}
