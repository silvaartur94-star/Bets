// API-Football league ids, in display priority order.
export const LEAGUES: { id: number; name: string; country: string; flag: string }[] = [
  { id: 2, name: "Liga dos Campeões", country: "Europa", flag: "🇪🇺" },
  { id: 3, name: "Liga Europa", country: "Europa", flag: "🇪🇺" },
  { id: 848, name: "Liga Conferência", country: "Europa", flag: "🇪🇺" },
  { id: 94, name: "Primeira Liga", country: "Portugal", flag: "🇵🇹" },
  { id: 39, name: "Premier League", country: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: 140, name: "La Liga", country: "Espanha", flag: "🇪🇸" },
  { id: 135, name: "Serie A", country: "Itália", flag: "🇮🇹" },
  { id: 78, name: "Bundesliga", country: "Alemanha", flag: "🇩🇪" },
  { id: 61, name: "Ligue 1", country: "França", flag: "🇫🇷" },
  { id: 71, name: "Brasileirão Série A", country: "Brasil", flag: "🇧🇷" },
  { id: 95, name: "Liga Portugal 2", country: "Portugal", flag: "🇵🇹" },
  { id: 40, name: "Championship", country: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: 88, name: "Eredivisie", country: "Países Baixos", flag: "🇳🇱" },
  { id: 144, name: "Jupiler Pro League", country: "Bélgica", flag: "🇧🇪" },
  { id: 203, name: "Süper Lig", country: "Turquia", flag: "🇹🇷" },
  { id: 179, name: "Premiership", country: "Escócia", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { id: 72, name: "Brasileirão Série B", country: "Brasil", flag: "🇧🇷" },
  { id: 128, name: "Liga Profesional", country: "Argentina", flag: "🇦🇷" },
  { id: 253, name: "MLS", country: "EUA", flag: "🇺🇸" },
  { id: 262, name: "Liga MX", country: "México", flag: "🇲🇽" },
];

/** "ALL" means every league the API returns, ranked by the order above. */
export function parseLeagueSetting(value: string): number[] | "ALL" {
  if (value.trim().toUpperCase() === "ALL") return "ALL";
  return value
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function leaguePriority(id: number): number {
  const i = LEAGUES.findIndex((l) => l.id === id);
  return i === -1 ? LEAGUES.length : i;
}

export function leagueFlag(id: number): string {
  return LEAGUES.find((l) => l.id === id)?.flag ?? "🌍";
}
