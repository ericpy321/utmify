"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "./i18n";
import { formatMoney } from "@/lib/currency";

export function HourlyChart({ data, currency }: { data: { hour: number; sales: number; revenue: number }[]; currency: string }) {
  const { t, lang } = useI18n();
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="hour" tickFormatter={(h) => `${String(h).padStart(2, "0")}h`} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} interval={2} />
          <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--soft)" }}
            contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }}
            labelFormatter={(h) => `${String(h).padStart(2, "0")}:00 – ${String(h).padStart(2, "0")}:59`}
            formatter={(v, _n, item) => [
              `${v} · ${formatMoney((item?.payload as { revenue: number }).revenue, currency, lang)}`,
              t.kpi.sales,
            ]}
          />
          <Bar dataKey="sales" fill="var(--accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
