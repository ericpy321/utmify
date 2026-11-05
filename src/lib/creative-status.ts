// Clasificación de creativos según la regla (pura: se usa en el servidor y en el navegador).
import type { CreativeRules } from "./types";

export type CreativeStatus = "champion" | "validated" | "testing" | "rejected";

export interface CreativeNumbers {
  code: string;
  batch: string;
  spend: number;
  revenue: number;
  sales: number;
  profit: number;
  roas: number | null;
  cpa: number | null;
}

export function classify(c: CreativeNumbers, rules: CreativeRules, batchFinished: boolean): CreativeStatus {
  const roas = c.roas ?? 0;
  if (c.sales >= rules.champion.sales && roas >= rules.champion.roas) return "champion";
  if (c.sales >= rules.validated.sales && roas >= rules.validated.roas) return "validated";
  return batchFinished ? "rejected" : "testing";
}

export interface BatchSummary {
  code: string;
  createdAt: string;
  status: "testing" | "finished";
  creatives: number;
  tested: number;
  validated: number; // incluye campeones: un campeón también está validado
  champions: number;
  spend: number;
  revenue: number;
  profit: number;
  roas: number | null;
}

export function summarizeBatches(
  creatives: CreativeNumbers[],
  batches: { code: string; createdAt: string; status: "testing" | "finished" }[],
  rules: CreativeRules,
): BatchSummary[] {
  return batches
    .map((b) => {
      const list = creatives.filter((c) => c.batch === b.code);
      const st = list.map((c) => classify(c, rules, b.status === "finished"));
      const spend = list.reduce((a, c) => a + c.spend, 0);
      const revenue = list.reduce((a, c) => a + c.revenue, 0);
      return {
        code: b.code,
        createdAt: b.createdAt,
        status: b.status,
        creatives: list.length,
        tested: list.filter((c) => c.spend > 0).length,
        validated: st.filter((s) => s === "validated" || s === "champion").length,
        champions: st.filter((s) => s === "champion").length,
        spend,
        revenue,
        profit: list.reduce((a, c) => a + c.profit, 0),
        roas: spend > 0 ? revenue / spend : null,
      };
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
