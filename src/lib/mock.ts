// Deterministic sample data used when API_FOOTBALL_KEY is not set.
// The same day always produces the same fixtures, odds and results.
import { poissonProbabilities, type Selection } from "./model";
import type { FixtureInput, FixtureResult } from "./sources";

const TEAMS: Record<number, { league: string; country: string; teams: [string, number][] }> = {
  94: { league: "Primeira Liga", country: "Portugal", teams: [["Benfica", 1.9], ["FC Porto", 1.85], ["Sporting CP", 1.95], ["SC Braga", 1.5], ["Vitória SC", 1.25], ["Gil Vicente", 1.0], ["Famalicão", 1.05], ["Rio Ave", 0.95]] },
  39: { league: "Premier League", country: "Inglaterra", teams: [["Arsenal", 1.9], ["Liverpool", 1.95], ["Manchester City", 1.9], ["Chelsea", 1.6], ["Newcastle", 1.5], ["Aston Villa", 1.45], ["Brighton", 1.35], ["Everton", 1.0]] },
  140: { league: "La Liga", country: "Espanha", teams: [["Real Madrid", 1.95], ["Barcelona", 2.0], ["Atlético Madrid", 1.6], ["Athletic Club", 1.4], ["Villarreal", 1.4], ["Real Sociedad", 1.25], ["Sevilla", 1.1], ["Getafe", 0.9]] },
  135: { league: "Serie A", country: "Itália", teams: [["Inter", 1.85], ["Napoli", 1.7], ["Juventus", 1.55], ["Milan", 1.55], ["Atalanta", 1.6], ["Roma", 1.4], ["Lazio", 1.35], ["Torino", 1.05]] },
  78: { league: "Bundesliga", country: "Alemanha", teams: [["Bayern München", 2.2], ["Bayer Leverkusen", 1.8], ["Borussia Dortmund", 1.7], ["RB Leipzig", 1.6], ["Eintracht Frankfurt", 1.5], ["Stuttgart", 1.5], ["Freiburg", 1.25], ["Wolfsburg", 1.15]] },
  61: { league: "Ligue 1", country: "França", teams: [["Paris Saint-Germain", 2.1], ["Marseille", 1.6], ["Monaco", 1.6], ["Lille", 1.45], ["Lyon", 1.45], ["Nice", 1.3], ["Lens", 1.3], ["Nantes", 0.95]] },
  71: { league: "Brasileirão Série A", country: "Brasil", teams: [["Flamengo", 1.75], ["Palmeiras", 1.7], ["Botafogo", 1.5], ["São Paulo", 1.35], ["Corinthians", 1.25], ["Fluminense", 1.25], ["Grêmio", 1.2], ["Internacional", 1.3]] },
  2: { league: "UEFA Champions League", country: "World", teams: [["Real Madrid", 1.95], ["Manchester City", 1.9], ["Bayern München", 2.1], ["Benfica", 1.6], ["Inter", 1.8], ["Arsenal", 1.85], ["Sporting CP", 1.6], ["PSV", 1.5]] },
};

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function dayNumber(day: string): number {
  return Math.round(new Date(`${day}T00:00:00Z`).getTime() / 86_400_000);
}

function poissonSample(lambda: number, r: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > L);
  return k - 1;
}

function price(p: number, margin: number, r: () => number): number {
  const noisy = p * (1 + margin) * (1 + (r() - 0.5) * 0.08);
  return Math.max(1.03, Math.round((1 / noisy) * 100) / 100);
}

const FORM = "WDLWWDLWLW";

interface MockMatch extends FixtureInput {
  trueXgHome: number;
  trueXgAway: number;
}

export function mockFixtures(day: string, leagues: number[] | "ALL", limit: number): FixtureInput[] {
  return buildDay(day)
    .filter((f) => leagues === "ALL" || leagues.includes(f.leagueId))
    .slice(0, limit)
    .map(({ trueXgHome: _h, trueXgAway: _a, ...f }) => f);
}

function buildDay(day: string): MockMatch[] {
  const n = dayNumber(day);
  const r = rng(n * 7919);
  const out: MockMatch[] = [];
  let idx = 0;
  for (const [leagueId, info] of Object.entries(TEAMS)) {
    // European cups only play midweek; leagues mostly at weekends.
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    const isCup = Number(leagueId) === 2;
    if (isCup !== (weekday === 2 || weekday === 3)) continue;
    const pool = [...info.teams].sort(() => r() - 0.5);
    const matches = 2 + Math.floor(r() * 2);
    for (let m = 0; m < matches && pool.length >= 2; m++) {
      const [home, hs] = pool.pop()!;
      const [away, as] = pool.pop()!;
      const trueXgHome = Math.max(0.35, (hs / as) * 1.45 + (r() - 0.5) * 0.2);
      const trueXgAway = Math.max(0.3, (as / hs) * 1.1 + (r() - 0.5) * 0.2);
      const p = poissonProbabilities(trueXgHome, trueXgAway);
      const hour = 12 + Math.floor(r() * 9);
      const minute = r() < 0.5 ? 0 : 30;
      const f: MockMatch = {
        id: -(n * 100 + idx++),
        date: new Date(`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`),
        leagueId: Number(leagueId),
        leagueName: info.league,
        country: info.country,
        homeTeam: home,
        awayTeam: away,
        status: "NS",
        trueXgHome,
        trueXgAway,
        oddsHome: price(p.HOME, 0.05, r),
        oddsDraw: price(p.DRAW, 0.05, r),
        oddsAway: price(p.AWAY, 0.05, r),
        oddsOver25: price(p.OVER, 0.05, r),
        oddsUnder25: price(p.UNDER, 0.05, r),
        oddsBttsYes: price(p.YES, 0.05, r),
        oddsBttsNo: price(p.NO, 0.05, r),
        // What our model "sees": the truth plus estimation noise.
        xgHome: Math.round((trueXgHome + (r() - 0.5) * 0.5) * 100) / 100,
        xgAway: Math.round((trueXgAway + (r() - 0.5) * 0.4) * 100) / 100,
        formHome: FORM.slice(Math.floor(r() * 5)).slice(0, 5),
        formAway: FORM.slice(Math.floor(r() * 5)).slice(0, 5),
      };
      const noisy: [Selection, number][] = [
        ["HOME", p.HOME + (r() - 0.5) * 0.15],
        ["DRAW", p.DRAW + (r() - 0.5) * 0.1],
        ["AWAY", p.AWAY + (r() - 0.5) * 0.15],
      ];
      const [sel, prob] = noisy.sort((a, b) => b[1] - a[1])[0];
      f.providerTips = [
        { selection: sel, probability: Math.round(prob * 100) / 100, note: "Previsão do fornecedor (simulada)" },
        { selection: p.OVER + (r() - 0.5) * 0.15 > 0.5 ? "OVER" : "UNDER" },
      ];
      out.push(f);
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Simulated full-time results, available two hours after kickoff. */
export function mockResults(ids: number[], days: string[]): FixtureResult[] {
  const byId = new Map(days.flatMap((d) => buildDay(d)).map((f) => [f.id, f]));
  const now = Date.now();
  return ids.flatMap((id) => {
    const f = byId.get(id);
    if (!f || f.date.getTime() + 2 * 3_600_000 > now) return [];
    const r = rng(Math.abs(id) * 104729);
    return [{ id, status: "FT", homeGoals: poissonSample(f.trueXgHome, r), awayGoals: poissonSample(f.trueXgAway, r) }];
  });
}
