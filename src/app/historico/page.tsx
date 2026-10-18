import Link from "next/link";
import { prisma } from "@/lib/db";
import { profitSeries, rankScore, tipsterStats } from "@/lib/stats";
import { MARKET_LABEL, SELECTION_LABEL, money, moneySigned, odds, pct, pctSigned, shortDate } from "@/lib/format";
import { ProfitChart, type Series } from "@/components/ProfitChart";
import { KindTag, Stat, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const PERIODS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

// Colour follows the source, never its rank: one fixed slot per kind.
const KIND_COLOR: Record<string, string> = {
  AI: "var(--series-1)",
  MODEL: "var(--series-2)",
  API: "var(--series-3)",
  HUMAN: "var(--series-4)",
};

export default async function History({ searchParams }: { searchParams: Promise<{ d?: string; t?: string }> }) {
  const sp = await searchParams;
  const days = PERIODS.some((p) => String(p.days) === sp.d) ? Number(sp.d) : 30;
  const tipsterId = sp.t ? Number(sp.t) : undefined;
  const since = new Date(Date.now() - days * 86_400_000);

  const stats = await tipsterStats(days);
  // One line per system source, plus the best-ranked human tipster: four at most.
  const system = stats.filter((s) => s.kind !== "HUMAN" && s.settled > 0);
  const bestHuman = stats.filter((s) => s.kind === "HUMAN" && s.settled > 0).sort((a, b) => rankScore(b) - rankScore(a))[0];
  const shown = [...system, ...(bestHuman ? [bestHuman] : [])].slice(0, 4);
  const series: Series[] = shown.map((s) => ({ name: s.name, color: KIND_COLOR[s.kind] }));
  const data = await profitSeries(shown.map((s) => s.name), days);

  const [picks, accas] = await Promise.all([
    prisma.pick.findMany({
      where: { status: { not: "PENDING" }, fixture: { date: { gte: since } }, ...(tipsterId ? { tipsterId } : {}) },
      include: { fixture: true, tipster: true },
      orderBy: { fixture: { date: "desc" } },
      take: 60,
    }),
    prisma.accumulator.findMany({ where: { status: { not: "PENDING" }, createdAt: { gte: since } } }),
  ]);

  const ai = stats.filter((s) => s.kind === "AI");
  const aiProfit = ai.reduce((a, s) => a + s.profit, 0);
  const aiStaked = ai.reduce((a, s) => a + s.staked, 0);
  const aiSettled = ai.reduce((a, s) => a + s.settled, 0);
  const aiWon = ai.reduce((a, s) => a + s.won, 0);
  const accaProfit = accas.reduce((a, x) => a + (x.profit ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Histórico</h1>
        <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.days}
              href={`/historico?d=${p.days}${tipsterId ? `&t=${tipsterId}` : ""}`}
              className={`rounded-md px-3 py-1 text-sm ${p.days === days ? "bg-accent-soft font-medium text-accent" : "text-muted"}`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Lucro IA" value={moneySigned(aiProfit)} tone={aiProfit >= 0 ? "good" : "bad"} sub={`${aiSettled} apostas resolvidas`} />
        <Stat label="ROI IA" value={pctSigned(aiStaked ? aiProfit / aiStaked : null)} tone={aiProfit >= 0 ? "good" : "bad"} sub={`${money(aiStaked)} apostados`} />
        <Stat label="Taxa de acerto IA" value={pct(aiSettled ? aiWon / aiSettled : null, 0)} />
        <Stat label="Múltiplas" value={moneySigned(accaProfit)} tone={accaProfit >= 0 ? "good" : "bad"} sub={`${accas.filter((a) => a.status === "WON").length}/${accas.length} ganhas`} />
      </div>

      <section className="card">
        <h2 className="mb-1 font-semibold">Lucro acumulado por fonte</h2>
        <p className="mb-3 text-xs text-muted">Stakes da IA e do modelo por Kelly; fornecedor e tipsters a 1 unidade (1% da banca).</p>
        <ProfitChart data={data} series={series} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-lg font-semibold">Últimas apostas resolvidas</h2>
          <Link href={`/historico?d=${days}`} className={`rounded-md px-2 py-1 text-xs ${!tipsterId ? "bg-accent-soft text-accent" : "text-muted"}`}>
            Todas
          </Link>
          {stats.map((s) => (
            <Link
              key={s.id}
              href={`/historico?d=${days}&t=${s.id}`}
              className={`rounded-md px-2 py-1 text-xs ${tipsterId === s.id ? "bg-accent-soft text-accent" : "text-muted"}`}
            >
              {s.name}
            </Link>
          ))}
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Fonte</th>
                <th>Jogo</th>
                <th>Aposta</th>
                <th className="text-right">Odd</th>
                <th className="text-right">Stake</th>
                <th className="text-right">Lucro</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {picks.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap text-muted">{shortDate(p.fixture.date)}</td>
                  <td className="whitespace-nowrap">
                    <KindTag kind={p.tipster.kind} /> <span className="text-xs">{p.tipster.name}</span>
                  </td>
                  <td>
                    {p.fixture.homeTeam} – {p.fixture.awayTeam}
                    {p.fixture.homeGoals != null && (
                      <span className="ml-1 text-faint">
                        ({p.fixture.homeGoals}–{p.fixture.awayGoals})
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="text-xs text-faint">{MARKET_LABEL[p.market]}:</span> {SELECTION_LABEL[p.selection]}
                  </td>
                  <td className="text-right">{odds(p.odds)}</td>
                  <td className="text-right">{money(p.stake)}</td>
                  <td className={`text-right font-medium ${(p.profit ?? 0) > 0 ? "text-good" : (p.profit ?? 0) < 0 ? "text-bad" : ""}`}>{moneySigned(p.profit ?? 0)}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
              {picks.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted">
                    Sem apostas resolvidas neste período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
