// Daily job: settle finished bets, ingest today's fixtures, and generate picks
// from the value model, the data provider, and the AI analyst.
import type { Prisma } from "@prisma/client";
import { prisma, getSettings } from "./db";
import { ApiFootball } from "./apiFootball";
import { mockFixtures, mockResults } from "./mock";
import { parseLeagueSetting } from "./leagues";
import { dayKey, dayRange } from "./dates";
import { evaluateFixture, kellyStake, marketOf, oddsFor, settleSelection, type Selection } from "./model";
import { FINISHED, VOIDED, type FixtureInput } from "./sources";
import { systemTipster } from "./tipsters";
import { analyseHeuristically, analyseWithClaude, type AiResult, type Candidate } from "./ai";
import { tipsterStats } from "./stats";

export interface RunReport {
  day: string;
  source: "api" | "mock";
  fixtures: number;
  settled: number;
  picks: number;
  aiEngine: AiResult["engine"];
  apiRequests: number;
  warnings: string[];
}

/**
 * `backfill` replays a past day with mock data (for demo history): it skips the
 * kickoff-time filter, never calls Claude, and settles straight away.
 */
// Only one run at a time: a second click on "Atualizar" (or the cron firing
// mid-run) waits for the run in progress and gets its report.
let running: Promise<RunReport> | null = null;

export async function runDaily(opts: { day?: string; refetch?: boolean; backfill?: boolean } = {}): Promise<RunReport> {
  if (running) return running;
  running = run(opts);
  try {
    return await running;
  } finally {
    running = null;
  }
}

async function run(opts: { day?: string; refetch?: boolean; backfill?: boolean }): Promise<RunReport> {
  const day = opts.day ?? dayKey();
  const key = process.env.API_FOOTBALL_KEY?.trim();
  const api = key && !opts.backfill ? new ApiFootball(key) : null;
  const report: RunReport = {
    day,
    source: api ? "api" : "mock",
    fixtures: 0,
    settled: 0,
    picks: 0,
    aiEngine: "heuristic",
    apiRequests: 0,
    warnings: [],
  };

  report.settled = await settlePending(api, report.warnings);

  const settings = await getSettings();
  const { start, end } = dayRange(day);
  const existing = await prisma.fixture.count({ where: { date: { gte: start, lte: end }, id: api ? { gt: 0 } : { lt: 0 } } });
  if (existing === 0 || opts.refetch) {
    const fixtures = await ingest(api, day, settings, report.warnings);
    report.fixtures = fixtures.length;
  } else {
    report.fixtures = existing;
  }

  const { picks, engine } = await generatePicks(day, settings, report.warnings, !!opts.backfill);
  if (opts.backfill) report.settled += await settlePending(null, report.warnings);
  report.picks = picks;
  report.aiEngine = engine;
  report.apiRequests = api?.requests ?? 0;

  await prisma.runLog.create({
    data: {
      day,
      source: report.source,
      message: `${report.fixtures} jogos, ${report.picks} apostas, ${report.settled} resolvidas, ${report.apiRequests} pedidos API${report.warnings.length ? ` — avisos: ${report.warnings.join(" | ")}` : ""}`,
    },
  });
  return report;
}

async function ingest(
  api: ApiFootball | null,
  day: string,
  settings: Awaited<ReturnType<typeof getSettings>>,
  warnings: string[],
): Promise<FixtureInput[]> {
  const leagues = parseLeagueSetting(settings.leagues);
  let fixtures: FixtureInput[];
  if (api) {
    fixtures = await api.fixturesForDay(day, leagues, settings.maxFixtures);
    for (const f of fixtures) {
      try {
        await api.addOdds(f);
        await api.addPrediction(f);
      } catch (e) {
        warnings.push(`${f.homeTeam}–${f.awayTeam}: ${(e as Error).message}`);
      }
    }
  } else {
    fixtures = mockFixtures(day, leagues, settings.maxFixtures);
  }

  for (const f of fixtures) {
    const { providerTips: _tips, ...data } = f;
    await prisma.fixture.upsert({ where: { id: f.id }, update: data, create: data });
  }
  // Provider tips are stored straight away as picks from the provider tipster.
  const provider = await systemTipster("provider");
  for (const f of fixtures) {
    for (const tip of f.providerTips ?? []) {
      const odds = oddsFor(f, tip.selection);
      if (!odds) continue;
      await prisma.pick.upsert({
        where: { fixtureId_tipsterId_market_selection: { fixtureId: f.id, tipsterId: provider.id, market: marketOf(tip.selection), selection: tip.selection } },
        update: { odds },
        create: {
          fixtureId: f.id,
          tipsterId: provider.id,
          market: marketOf(tip.selection),
          selection: tip.selection,
          odds,
          probability: tip.probability ?? null,
          edge: tip.probability ? tip.probability * odds - 1 : null,
          stake: unit(settings.bankroll),
          reasoning: tip.note ?? null,
        },
      });
    }
  }
  return fixtures;
}

/** Tracking stake for tipsters whose picks we follow but don't size: 1% of bankroll. */
function unit(bankroll: number) {
  return Math.round(bankroll * 0.01 * 2) / 2;
}

async function generatePicks(
  day: string,
  settings: Awaited<ReturnType<typeof getSettings>>,
  warnings: string[],
  backfill = false,
): Promise<{ picks: number; engine: AiResult["engine"] }> {
  const { start, end } = dayRange(day);
  const fixtures = await prisma.fixture.findMany({
    where: { date: backfill ? { gte: start, lte: end } : { gte: start, lte: end, gt: new Date() }, status: "NS" },
    include: { picks: { include: { tipster: true } } },
    orderBy: { date: "asc" },
  });
  const fixtureIds = fixtures.map((f) => f.id);

  const [model, claude, heuristic] = await Promise.all([
    systemTipster("model"),
    systemTipster("claude"),
    systemTipster("heuristic"),
  ]);
  // Regenerate our own pending picks for upcoming fixtures; leave settled ones alone.
  await prisma.pick.deleteMany({
    where: { fixtureId: { in: fixtureIds }, tipsterId: { in: [model.id, claude.id, heuristic.id] }, status: "PENDING" },
  });
  await prisma.accumulator.deleteMany({ where: { day, status: "PENDING" } });

  const stats = new Map((await tipsterStats()).map((s) => [s.id, s]));
  const candidates: Candidate[] = [];
  let created = 0;

  for (const f of fixtures) {
    if (f.xgHome == null || f.xgAway == null) continue;
    const outcomes = evaluateFixture(f.xgHome, f.xgAway, f).map((o) => ({
      ...o,
      probability: round(o.probability, 3),
      edge: round(o.edge, 3),
    }));
    if (!outcomes.length) continue;

    // Model: the single best-value outcome per fixture.
    const best = outcomes
      .filter((o) => o.edge >= settings.minEdge && o.odds >= settings.minOdds && o.odds <= settings.maxOdds)
      .sort((a, b) => b.edge - a.edge)[0];
    if (best) {
      const stake = kellyStake(best.probability, best.odds, settings.bankroll, settings.kellyFraction, settings.maxStakePct);
      if (stake > 0) {
        await savePick({
          fixtureId: f.id,
          tipsterId: model.id,
          market: best.market,
          selection: best.selection,
          odds: best.odds,
          probability: best.probability,
          edge: best.edge,
          stake,
          confidence: Math.min(5, 1 + Math.floor(best.edge * 25)),
        });
        created++;
      }
    }

    candidates.push({
      fixtureId: f.id,
      match: `${f.homeTeam} vs ${f.awayTeam}`,
      league: `${f.leagueName} (${f.country})`,
      kickoff: f.date.toISOString(),
      xg: { home: f.xgHome, away: f.xgAway },
      form: { home: f.formHome, away: f.formAway },
      outcomes,
      tipsterPicks: f.picks
        .filter((p) => p.tipster.kind === "API" || p.tipster.kind === "HUMAN")
        .map((p) => {
          const s = stats.get(p.tipsterId);
          return {
            tipster: p.tipster.name,
            kind: p.tipster.kind,
            selection: p.selection as Selection,
            hitRate: s?.hitRate ?? null,
            roi: s?.roi ?? null,
            settled: s?.settled ?? 0,
          };
        }),
    });
  }

  let ai: AiResult;
  if (!backfill && process.env.ANTHROPIC_API_KEY?.trim() && candidates.length) {
    try {
      ai = await analyseWithClaude(candidates);
    } catch (e) {
      warnings.push(`Claude: ${(e as Error).message} — a usar análise heurística`);
      ai = analyseHeuristically(candidates, settings.minEdge, settings.minOdds, settings.maxOdds);
    }
  } else {
    ai = analyseHeuristically(candidates, settings.minEdge, settings.minOdds, settings.maxOdds);
  }

  const aiTipster = ai.engine === "claude" ? claude : heuristic;
  const aiPicks = [];
  for (const p of ai.picks) {
    const c = candidates.find((c) => c.fixtureId === p.fixtureId)!;
    const o = c.outcomes.find((o) => o.selection === p.selection)!;
    // Size on the more conservative of the AI and model probabilities.
    const prob = Math.min(p.probability, Math.max(o.probability, p.probability - 0.05));
    const stake = kellyStake(prob, o.odds, settings.bankroll, settings.kellyFraction, settings.maxStakePct) || unit(settings.bankroll) / 2;
    aiPicks.push(
      await savePick({
        fixtureId: p.fixtureId,
        tipsterId: aiTipster.id,
        market: o.market,
        selection: o.selection,
        odds: o.odds,
        probability: round(p.probability, 3),
        edge: round(p.probability * o.odds - 1, 3),
        stake,
        confidence: p.confidence,
        reasoning: p.reasoning,
      }),
    );
    created++;
  }

  await prisma.runLog.create({ data: { day, source: `summary:${ai.engine}`, message: ai.summary } });

  // Accumulator: the three most likely AI picks priced between 1.30 and 2.20.
  const legs = aiPicks
    .filter((p) => p.odds >= 1.3 && p.odds <= 2.2)
    .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
    .slice(0, 3);
  if (legs.length === 3) {
    const odds = round(legs.reduce((acc, p) => acc * p.odds, 1), 2);
    await prisma.accumulator.create({
      data: {
        day,
        odds,
        stake: Math.round(settings.bankroll * 0.005 * 2) / 2,
        legs: { create: legs.map((l) => ({ pickId: l.id })) },
      },
    });
  }

  return { picks: created, engine: ai.engine };
}

/** Creates a pick, or refreshes it if this tipster already has the same pick on the fixture. */
function savePick(data: Prisma.PickUncheckedCreateInput) {
  const { fixtureId, tipsterId, market, selection } = data;
  return prisma.pick.upsert({
    where: { fixtureId_tipsterId_market_selection: { fixtureId, tipsterId, market, selection } },
    update: data,
    create: data,
  });
}

/** Settles every pending pick whose fixture kicked off more than two hours ago. */
export async function settlePending(api: ApiFootball | null, warnings: string[] = []): Promise<number> {
  const cutoff = new Date(Date.now() - 2 * 3_600_000);
  const fixtures = await prisma.fixture.findMany({
    where: { date: { lt: cutoff }, picks: { some: { status: "PENDING" } } },
    select: { id: true, date: true },
  });
  if (!fixtures.length) return 0;

  const realIds = fixtures.filter((f) => f.id > 0).map((f) => f.id);
  const mockIds = fixtures.filter((f) => f.id < 0).map((f) => f.id);
  const results = mockResults(mockIds, [...new Set(fixtures.filter((f) => f.id < 0).map((f) => dayKey(f.date)))]);
  if (realIds.length && api) {
    try {
      results.push(...(await api.results(realIds)));
    } catch (e) {
      warnings.push(`Resultados: ${(e as Error).message}`);
    }
  }

  let settled = 0;
  for (const r of results) {
    const finished = FINISHED.includes(r.status) && r.homeGoals !== null && r.awayGoals !== null;
    const voided = VOIDED.includes(r.status);
    await prisma.fixture.update({
      where: { id: r.id },
      data: { status: r.status, homeGoals: r.homeGoals, awayGoals: r.awayGoals },
    });
    if (!finished && !voided) continue;
    const picks = await prisma.pick.findMany({ where: { fixtureId: r.id, status: "PENDING" } });
    for (const p of picks) {
      const won = finished && settleSelection(p.selection as Selection, r.homeGoals!, r.awayGoals!);
      const status = voided ? "VOID" : won ? "WON" : "LOST";
      const profit = status === "WON" ? round(p.stake * (p.odds - 1), 2) : status === "LOST" ? -p.stake : 0;
      await prisma.pick.update({ where: { id: p.id }, data: { status, profit } });
      settled++;
    }
  }
  await settleAccumulators();
  return settled;
}

async function settleAccumulators() {
  const accas = await prisma.accumulator.findMany({ where: { status: "PENDING" }, include: { legs: { include: { pick: true } } } });
  for (const a of accas) {
    const statuses = a.legs.map((l) => l.pick.status);
    if (statuses.includes("LOST")) {
      await prisma.accumulator.update({ where: { id: a.id }, data: { status: "LOST", profit: -a.stake } });
    } else if (!statuses.includes("PENDING")) {
      const live = a.legs.filter((l) => l.pick.status === "WON");
      const odds = live.reduce((acc, l) => acc * l.pick.odds, 1);
      const status = live.length ? "WON" : "VOID";
      await prisma.accumulator.update({ where: { id: a.id }, data: { status, profit: live.length ? round(a.stake * (odds - 1), 2) : 0 } });
    }
  }
}

function round(x: number, d: number) {
  const m = 10 ** d;
  return Math.round(x * m) / m;
}
