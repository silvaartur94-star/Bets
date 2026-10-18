import { TZ } from "./dates";

const eur = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const eurSigned = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", signDisplay: "exceptZero" });

export const money = (v: number) => eur.format(v);
export const moneySigned = (v: number) => eurSigned.format(v);
export const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? "—" : `${(v * 100).toLocaleString("pt-PT", { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;
export const pctSigned = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${pct(v, digits)}`;
export const odds = (v: number | null | undefined) => (v ? v.toFixed(2) : "—");

export const time = (d: Date) => new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
export const shortDate = (d: Date) => new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, day: "2-digit", month: "short" }).format(d);
export const longDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(d);

export const SELECTION_LABEL: Record<string, string> = {
  HOME: "Casa (1)",
  DRAW: "Empate (X)",
  AWAY: "Fora (2)",
  OVER: "Mais 2,5",
  UNDER: "Menos 2,5",
  YES: "Ambas marcam",
  NO: "Não ambas marcam",
};

export const MARKET_LABEL: Record<string, string> = { "1X2": "Resultado", OU25: "Golos 2,5", BTTS: "Ambas marcam" };

export const STATUS_LABEL: Record<string, string> = { PENDING: "Pendente", WON: "Ganha", LOST: "Perdida", VOID: "Anulada" };

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
