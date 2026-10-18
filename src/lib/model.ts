// Poisson goal model blended with de-vigged market prices.

export type Market = "1X2" | "OU25" | "BTTS";
export type Selection = "HOME" | "DRAW" | "AWAY" | "OVER" | "UNDER" | "YES" | "NO";

export interface MarketOdds {
  oddsHome?: number | null;
  oddsDraw?: number | null;
  oddsAway?: number | null;
  oddsOver25?: number | null;
  oddsUnder25?: number | null;
  oddsBttsYes?: number | null;
  oddsBttsNo?: number | null;
}

export type Probabilities = Record<Selection, number>;

export interface Outcome {
  market: Market;
  selection: Selection;
  odds: number;
  probability: number;
  edge: number;
}

const MAX_GOALS = 10;

function poissonPmf(lambda: number, k: number): number {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

export function poissonProbabilities(xgHome: number, xgAway: number): Probabilities {
  const ph = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poissonPmf(xgHome, k));
  const pa = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poissonPmf(xgAway, k));
  const p: Probabilities = { HOME: 0, DRAW: 0, AWAY: 0, OVER: 0, UNDER: 0, YES: 0, NO: 0 };
  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const v = ph[h] * pa[a];
      if (h > a) p.HOME += v;
      else if (h === a) p.DRAW += v;
      else p.AWAY += v;
      if (h + a >= 3) p.OVER += v;
      else p.UNDER += v;
      if (h > 0 && a > 0) p.YES += v;
      else p.NO += v;
    }
  }
  return p;
}

export function oddsFor(o: MarketOdds, s: Selection): number | null {
  const map: Record<Selection, number | null | undefined> = {
    HOME: o.oddsHome,
    DRAW: o.oddsDraw,
    AWAY: o.oddsAway,
    OVER: o.oddsOver25,
    UNDER: o.oddsUnder25,
    YES: o.oddsBttsYes,
    NO: o.oddsBttsNo,
  };
  const v = map[s];
  return v && v > 1 ? v : null;
}

export const MARKET_SELECTIONS: Record<Market, Selection[]> = {
  "1X2": ["HOME", "DRAW", "AWAY"],
  OU25: ["OVER", "UNDER"],
  BTTS: ["YES", "NO"],
};

export function marketOf(s: Selection): Market {
  return s === "OVER" || s === "UNDER" ? "OU25" : s === "YES" || s === "NO" ? "BTTS" : "1X2";
}

/** Proportional de-vig of a market's prices. Null if any price is missing. */
export function impliedProbabilities(o: MarketOdds, market: Market): Partial<Probabilities> | null {
  const sels = MARKET_SELECTIONS[market];
  const prices = sels.map((s) => oddsFor(o, s));
  if (prices.some((p) => p === null)) return null;
  const raw = prices.map((p) => 1 / (p as number));
  const total = raw.reduce((a, b) => a + b, 0);
  return Object.fromEntries(sels.map((s, i) => [s, raw[i] / total]));
}

/**
 * Every priced outcome with its blended probability and edge.
 * `modelWeight` shrinks the Poisson estimate toward the market, which keeps
 * edges realistic when the xG inputs are noisy.
 */
export function evaluateFixture(
  xgHome: number,
  xgAway: number,
  odds: MarketOdds,
  modelWeight = 0.5,
): Outcome[] {
  const model = poissonProbabilities(xgHome, xgAway);
  const out: Outcome[] = [];
  for (const market of Object.keys(MARKET_SELECTIONS) as Market[]) {
    const implied = impliedProbabilities(odds, market);
    for (const selection of MARKET_SELECTIONS[market]) {
      const price = oddsFor(odds, selection);
      if (!price) continue;
      const marketP = implied?.[selection];
      const probability =
        marketP === undefined ? model[selection] : modelWeight * model[selection] + (1 - modelWeight) * marketP;
      out.push({ market, selection, odds: price, probability, edge: probability * price - 1 });
    }
  }
  return out;
}

/** Fractional Kelly stake in euros, capped at maxStakePct of the bankroll. */
export function kellyStake(
  probability: number,
  odds: number,
  bankroll: number,
  fraction: number,
  maxStakePct: number,
): number {
  const b = odds - 1;
  const full = (b * probability - (1 - probability)) / b;
  if (full <= 0) return 0;
  const stake = Math.min(full * fraction, maxStakePct) * bankroll;
  return Math.round(stake * 2) / 2; // round to €0.50
}

export function settleSelection(selection: Selection, home: number, away: number): boolean {
  switch (selection) {
    case "HOME":
      return home > away;
    case "DRAW":
      return home === away;
    case "AWAY":
      return away > home;
    case "OVER":
      return home + away >= 3;
    case "UNDER":
      return home + away < 3;
    case "YES":
      return home > 0 && away > 0;
    case "NO":
      return home === 0 || away === 0;
  }
}
