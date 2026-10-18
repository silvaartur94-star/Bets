// Client for API-Football v3 (https://www.api-football.com/documentation-v3).
// The free plan allows 100 requests/day, so every call here is counted.
import { leaguePriority } from "./leagues";
import type { Selection } from "./model";
import type { ApiTip, FixtureInput, FixtureResult } from "./sources";
import { TZ } from "./dates";

const BASE = "https://v3.football.api-sports.io";
const BOOKMAKER = 8; // Bet365

export class ApiFootball {
  requests = 0;
  constructor(private key: string) {}

  private async get<T>(path: string, params: Record<string, string | number>): Promise<T[]> {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
    this.requests++;
    const res = await fetch(`${BASE}${path}?${qs}`, {
      headers: { "x-apisports-key": this.key },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`API-Football ${path} HTTP ${res.status}`);
    const json = (await res.json()) as { response: T[]; errors: unknown };
    const errors = json.errors && typeof json.errors === "object" ? Object.values(json.errors) : [];
    if (errors.length) throw new Error(`API-Football ${path}: ${errors.join("; ")}`);
    return json.response;
  }

  async fixturesForDay(day: string, leagues: number[] | "ALL", limit: number): Promise<FixtureInput[]> {
    const raw = await this.get<RawFixture>("/fixtures", { date: day, timezone: TZ });
    return raw
      .filter((f) => f.fixture.status.short === "NS" || f.fixture.status.short === "TBD")
      .filter((f) => leagues === "ALL" || leagues.includes(f.league.id))
      .sort((a, b) => leaguePriority(a.league.id) - leaguePriority(b.league.id) || a.fixture.timestamp - b.fixture.timestamp)
      .slice(0, limit)
      .map(toFixtureInput);
  }

  /** Adds Bet365 odds for 1X2, O/U 2.5 and BTTS. One request per fixture. */
  async addOdds(f: FixtureInput): Promise<void> {
    const [entry] = await this.get<RawOdds>("/odds", { fixture: f.id, bookmaker: BOOKMAKER });
    const bets = entry?.bookmakers?.[0]?.bets ?? [];
    const val = (betId: number, value: string) => {
      const odd = bets.find((b) => b.id === betId)?.values.find((v) => v.value === value)?.odd;
      return odd ? Number(odd) : null;
    };
    f.oddsHome = val(1, "Home");
    f.oddsDraw = val(1, "Draw");
    f.oddsAway = val(1, "Away");
    f.oddsOver25 = val(5, "Over 2.5");
    f.oddsUnder25 = val(5, "Under 2.5");
    f.oddsBttsYes = val(8, "Yes");
    f.oddsBttsNo = val(8, "No");
  }

  /** Adds the provider's prediction, form and an xG estimate. One request per fixture. */
  async addPrediction(f: FixtureInput): Promise<void> {
    const [p] = await this.get<RawPrediction>("/predictions", { fixture: f.id });
    if (!p) return;
    const home = p.teams.home;
    const away = p.teams.away;
    f.formHome = home.league?.form?.slice(-5) ?? null;
    f.formAway = away.league?.form?.slice(-5) ?? null;

    const num = (s: string | number | null | undefined) => (s === null || s === undefined || s === "" ? NaN : Number(s));
    const avg = (...xs: number[]) => {
      const ok = xs.filter(Number.isFinite);
      return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : NaN;
    };
    // Home attack at home vs away defence away, and vice versa.
    let xgHome = avg(num(home.league?.goals?.for?.average?.home), num(away.league?.goals?.against?.average?.away));
    let xgAway = avg(num(away.league?.goals?.for?.average?.away), num(home.league?.goals?.against?.average?.home));
    if (!Number.isFinite(xgHome)) xgHome = avg(num(home.last_5?.goals?.for?.average), num(away.last_5?.goals?.against?.average));
    if (!Number.isFinite(xgAway)) xgAway = avg(num(away.last_5?.goals?.for?.average), num(home.last_5?.goals?.against?.average));
    const clamp = (x: number) => Math.min(3.5, Math.max(0.3, x));
    if (Number.isFinite(xgHome) && Number.isFinite(xgAway)) {
      f.xgHome = clamp(xgHome);
      f.xgAway = clamp(xgAway);
    }

    const tips: ApiTip[] = [];
    const pct = p.predictions.percent;
    if (pct) {
      const entries: [Selection, number][] = [
        ["HOME", parseFloat(pct.home) / 100],
        ["DRAW", parseFloat(pct.draw) / 100],
        ["AWAY", parseFloat(pct.away) / 100],
      ];
      const [sel, prob] = entries.sort((a, b) => b[1] - a[1])[0];
      if (Number.isFinite(prob)) tips.push({ selection: sel, probability: prob, note: p.predictions.advice ?? undefined });
    }
    const uo = p.predictions.under_over;
    if (uo === "+2.5") tips.push({ selection: "OVER", note: p.predictions.advice ?? undefined });
    if (uo === "-2.5") tips.push({ selection: "UNDER", note: p.predictions.advice ?? undefined });
    f.providerTips = tips;
  }

  /** Results for up to 20 fixtures per request. */
  async results(ids: number[]): Promise<FixtureResult[]> {
    const out: FixtureResult[] = [];
    for (let i = 0; i < ids.length; i += 20) {
      const chunk = ids.slice(i, i + 20);
      const raw = await this.get<RawFixture>("/fixtures", { ids: chunk.join("-") });
      for (const f of raw) {
        out.push({
          id: f.fixture.id,
          status: f.fixture.status.short,
          // Bets settle on 90 minutes, so prefer the full-time score over extra time.
          homeGoals: f.score?.fulltime?.home ?? f.goals.home,
          awayGoals: f.score?.fulltime?.away ?? f.goals.away,
        });
      }
    }
    return out;
  }
}

function toFixtureInput(f: RawFixture): FixtureInput {
  return {
    id: f.fixture.id,
    date: new Date(f.fixture.date),
    leagueId: f.league.id,
    leagueName: f.league.name,
    country: f.league.country,
    homeTeam: f.teams.home.name,
    awayTeam: f.teams.away.name,
    homeLogo: f.teams.home.logo,
    awayLogo: f.teams.away.logo,
    status: f.fixture.status.short,
  };
}

interface RawFixture {
  fixture: { id: number; date: string; timestamp: number; status: { short: string } };
  league: { id: number; name: string; country: string };
  teams: { home: { name: string; logo: string }; away: { name: string; logo: string } };
  goals: { home: number | null; away: number | null };
  score?: { fulltime?: { home: number | null; away: number | null } };
}

interface RawOdds {
  bookmakers: { id: number; bets: { id: number; name: string; values: { value: string; odd: string }[] }[] }[];
}

interface RawTeamStats {
  last_5?: { goals?: { for?: { average?: string }; against?: { average?: string } } };
  league?: {
    form?: string | null;
    goals?: {
      for?: { average?: { home?: string; away?: string } };
      against?: { average?: { home?: string; away?: string } };
    };
  };
}

interface RawPrediction {
  predictions: {
    under_over: string | null;
    advice: string | null;
    percent?: { home: string; draw: string; away: string };
  };
  teams: { home: RawTeamStats; away: RawTeamStats };
}
