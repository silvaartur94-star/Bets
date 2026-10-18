import { prisma } from "./db";
import { dayKey } from "./dates";

export interface TipsterStat {
  id: number;
  name: string;
  kind: string;
  settled: number;
  pending: number;
  won: number;
  staked: number;
  profit: number;
  roi: number | null;
  hitRate: number | null;
  avgOdds: number | null;
  last10: string[];
}

export async function tipsterStats(sinceDays?: number): Promise<TipsterStat[]> {
  const since = sinceDays ? new Date(Date.now() - sinceDays * 86_400_000) : undefined;
  const tipsters = await prisma.tipster.findMany({
    include: {
      picks: {
        where: since ? { fixture: { date: { gte: since } } } : undefined,
        include: { fixture: { select: { date: true } } },
      },
    },
  });
  return tipsters
    .map((t) => {
      const settled = t.picks.filter((p) => p.status === "WON" || p.status === "LOST");
      const staked = settled.reduce((a, p) => a + p.stake, 0);
      const profit = settled.reduce((a, p) => a + (p.profit ?? 0), 0);
      const won = settled.filter((p) => p.status === "WON").length;
      return {
        id: t.id,
        name: t.name,
        kind: t.kind,
        settled: settled.length,
        pending: t.picks.filter((p) => p.status === "PENDING").length,
        won,
        staked,
        profit,
        roi: staked ? profit / staked : null,
        hitRate: settled.length ? won / settled.length : null,
        avgOdds: settled.length ? settled.reduce((a, p) => a + p.odds, 0) / settled.length : null,
        last10: settled
          .sort((a, b) => b.fixture.date.getTime() - a.fixture.date.getTime())
          .slice(0, 10)
          .map((p) => p.status),
      };
    })
    .filter((t) => t.settled + t.pending > 0 || t.kind === "HUMAN");
}

/** Ranking score: ROI shrunk toward zero for small samples. */
export function rankScore(s: TipsterStat): number {
  if (s.roi === null) return -Infinity;
  return s.roi * (s.settled / (s.settled + 30));
}

export interface ProfitPoint {
  day: string;
  [tipster: string]: number | string;
}

/** Cumulative profit per tipster per day, for the history chart. */
export async function profitSeries(names: string[], sinceDays = 60): Promise<ProfitPoint[]> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const picks = await prisma.pick.findMany({
    where: { status: { in: ["WON", "LOST"] }, tipster: { name: { in: names } }, fixture: { date: { gte: since } } },
    include: { fixture: { select: { date: true } }, tipster: { select: { name: true } } },
  });
  const byDay = new Map<string, Record<string, number>>();
  for (const p of picks) {
    const d = dayKey(p.fixture.date);
    const row = byDay.get(d) ?? {};
    row[p.tipster.name] = (row[p.tipster.name] ?? 0) + (p.profit ?? 0);
    byDay.set(d, row);
  }
  const days = [...byDay.keys()].sort();
  const running: Record<string, number> = Object.fromEntries(names.map((n) => [n, 0]));
  return days.map((day) => {
    const row = byDay.get(day)!;
    for (const n of names) running[n] = Math.round((running[n] + (row[n] ?? 0)) * 100) / 100;
    return { day, ...running };
  });
}
