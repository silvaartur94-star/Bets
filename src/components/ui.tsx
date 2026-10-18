import { STATUS_LABEL } from "@/lib/format";

const STATUS_STYLE: Record<string, { cls: string; icon: string }> = {
  WON: { cls: "bg-good-soft text-good", icon: "✓" },
  LOST: { cls: "bg-bad-soft text-bad", icon: "✕" },
  VOID: { cls: "bg-surface-2 text-muted", icon: "↺" },
  PENDING: { cls: "bg-surface-2 text-muted", icon: "•" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${s.cls}`}>
      <span aria-hidden>{s.icon}</span>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** Last results as a compact strip of ✓/✕ marks, newest first. */
export function FormStrip({ results }: { results: string[] }) {
  if (!results.length) return <span className="text-faint">—</span>;
  return (
    <span className="inline-flex gap-0.5" aria-label={`Últimos resultados: ${results.map((r) => (r === "WON" ? "ganha" : "perdida")).join(", ")}`}>
      {results.map((r, i) => (
        <span key={i} className={`flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold ${r === "WON" ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>
          {r === "WON" ? "✓" : "✕"}
        </span>
      ))}
    </span>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="card">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight ${tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-faint">{sub}</div>}
    </div>
  );
}

export function Confidence({ value }: { value: number | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Confiança ${value} de 5`} title={`Confiança ${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-1.5 w-3 rounded-full ${i <= value ? "bg-accent" : "bg-surface-2"}`} />
      ))}
    </span>
  );
}

export function KindTag({ kind }: { kind: string }) {
  const label: Record<string, string> = { AI: "IA", MODEL: "Modelo", API: "Fornecedor", HUMAN: "Tipster" };
  return <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">{label[kind] ?? kind}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card text-center text-sm text-muted">{children}</div>;
}
