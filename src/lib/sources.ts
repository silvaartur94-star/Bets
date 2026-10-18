import type { MarketOdds, Selection } from "./model";

export interface ApiTip {
  selection: Selection;
  probability?: number;
  note?: string;
}

export interface FixtureInput extends MarketOdds {
  id: number;
  date: Date;
  leagueId: number;
  leagueName: string;
  country: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  status: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
  xgHome?: number | null;
  xgAway?: number | null;
  formHome?: string | null;
  formAway?: string | null;
  /** Picks published by the data provider's own prediction engine. */
  providerTips?: ApiTip[];
}

export interface FixtureResult {
  id: number;
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
}

export const FINISHED = ["FT", "AET", "PEN"];
export const VOIDED = ["PST", "CANC", "ABD", "AWD", "WO"];
