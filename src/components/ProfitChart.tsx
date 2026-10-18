"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";

export interface Series {
  name: string;
  color: string;
}

const eur = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eurSigned = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", signDisplay: "exceptZero" });
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-muted">{dayLabel(String(label))}</div>
      {[...payload]
        .sort((a, b) => Number(b.value) - Number(a.value))
        .map((p) => (
          <div key={p.dataKey as string} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-medium tabular-nums">{eurSigned.format(Number(p.value))}</span>
          </div>
        ))}
    </div>
  );
}

export function ProfitChart({ data, series }: { data: Record<string, number | string>[]; series: Series[] }) {
  if (data.length < 2) return <p className="py-10 text-center text-sm text-muted">Ainda não há histórico suficiente para o gráfico.</p>;
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="day" tickFormatter={dayLabel} tick={{ fontSize: 11, fill: "var(--faint)" }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tickFormatter={(v) => eur.format(v)} tick={{ fontSize: 11, fill: "var(--faint)" }} tickLine={false} axisLine={false} width={64} />
          <ReferenceLine y={0} stroke="var(--faint)" />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--faint)", strokeDasharray: "3 3" }} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
          {series.map((s) => (
            <Line key={s.name} dataKey={s.name} name={s.name} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} type="monotone" />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
